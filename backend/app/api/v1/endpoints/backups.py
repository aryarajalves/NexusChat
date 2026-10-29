"""
Endpoints de API para Gerenciamento de Backups (S3 / Backblaze B2).
Exclusivo para Super Administradores.
"""
import re
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.models.backup import BackupHistory, BackupSchedule
from app.api.v1.endpoints.users import require_superadmin
from app.schemas.backup import (
    BackupManualRequest,
    BackupRenameRequest,
    BackupScheduleUpdate,
    BackupScheduleResponse,
    BackupHistoryResponse,
    BackupDashboardStats,
)
from app.schemas.user import BulkDeleteRequest
from app.services.storage import check_b2_connection, download_backup_file, delete_backup_file, rename_backup_file
from app.services.backup_service import create_backup_record, restore_db_dump
from app.services.scheduler import setup_scheduler, parse_frequency_to_timedelta

router = APIRouter(prefix="/backups", tags=["Backups"])

def format_file_size(size_in_bytes: int) -> str:
    """Formata bytes em B, KB, MB, GB."""
    if size_in_bytes < 1024:
        return f"{size_in_bytes} B"
    elif size_in_bytes < 1024 * 1024:
        return f"{size_in_bytes / 1024:.2f} KB"
    elif size_in_bytes < 1024 * 1024 * 1024:
        return f"{size_in_bytes / (1024 * 1024):.2f} MB"
    return f"{size_in_bytes / (1024 * 1024 * 1024):.2f} GB"

def get_frequency_label(freq: str) -> str:
    labels = {
        "1h": "A cada 1 hora(s)",
        "6h": "A cada 6 hora(s)",
        "12h": "A cada 12 hora(s)",
        "24h": "A cada 24 hora(s)",
        "7d": "A cada 7 dia(s)",
    }
    return labels.get(freq, "A cada 6 hora(s)")

@router.get("/dashboard-stats", response_model=BackupDashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    schedule = db.query(BackupSchedule).first()
    b2_info = check_b2_connection()

    last_backup = db.query(BackupHistory).filter(BackupHistory.status == "success").order_by(BackupHistory.id.desc()).first()
    backups = db.query(BackupHistory).filter(BackupHistory.status == "success").all()

    total_bytes = sum(b.file_size_bytes for b in backups)
    current_count = len(backups)

    frequency_label = get_frequency_label(schedule.frequency) if schedule else "A cada 6 hora(s)"
    retention_max = schedule.retention_max if schedule else 30

    return BackupDashboardStats(
        last_backup_filename=last_backup.filename if last_backup else None,
        last_backup_date=last_backup.created_at if last_backup else None,
        next_backup_date=schedule.next_run_at if schedule and schedule.is_active else None,
        frequency_label=frequency_label,
        current_count=current_count,
        retention_max=retention_max,
        total_bytes_used=total_bytes,
        total_size_formatted=f"{format_file_size(total_bytes)} utilizados",
        b2_connected=b2_info["connected"],
        b2_status=b2_info["status"],
        b2_bucket=b2_info["bucket"],
    )

@router.get("/list", response_model=List[BackupHistoryResponse])
def list_backups(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    backups = db.query(BackupHistory).order_by(BackupHistory.id.desc()).all()
    results = []
    for b in backups:
        dto = BackupHistoryResponse.model_validate(b)
        dto.file_size_formatted = format_file_size(b.file_size_bytes)
        results.append(dto)
    return results

@router.post("/manual", response_model=BackupHistoryResponse, status_code=status.HTTP_201_CREATED)
def trigger_manual_backup(
    payload: Optional[BackupManualRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """Gera um dump imediato compactado e salva no S3/B2 com nome customizado ou padrão."""
    try:
        custom_name = payload.custom_name if payload else None
        history = create_backup_record(db, backup_type="manual", custom_name=custom_name)
        dto = BackupHistoryResponse.model_validate(history)
        dto.file_size_formatted = format_file_size(history.file_size_bytes)
        return dto
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar backup manual: {str(e)}")

@router.post("/import", response_model=BackupHistoryResponse, status_code=status.HTTP_201_CREATED)
async def import_external_backup(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """Recebe um arquivo de dump externo (.dump, .dump.gz, .sql) e envia diretamente para o S3."""
    valid_extensions = [".dump", ".dump.gz", ".sql", ".gz", ".tar"]
    filename = file.filename
    if not any(filename.lower().endswith(ext) for ext in valid_extensions):
        raise HTTPException(
            status_code=400,
            detail="Formato inválido. Apenas arquivos .dump, .dump.gz e .sql são aceitos."
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="O arquivo enviado está vazio.")

    try:
        history = create_backup_record(
            db,
            backup_type="imported",
            custom_bytes=content,
            original_filename=filename
        )
        dto = BackupHistoryResponse.model_validate(history)
        dto.file_size_formatted = format_file_size(history.file_size_bytes)
        return dto
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao importar backup: {str(e)}")

@router.get("/download/{backup_id}")
def download_backup(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """Faz download do arquivo de backup."""
    backup = db.query(BackupHistory).filter(BackupHistory.id == backup_id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup não encontrado.")

    try:
        file_bytes = download_backup_file(backup.s3_key, backup.filename)
        return Response(
            content=file_bytes,
            media_type="application/gzip",
            headers={"Content-Disposition": f'attachment; filename="{backup.filename}"'}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao baixar arquivo: {str(e)}")

@router.post("/restore/{backup_id}")
def restore_backup(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """Restaura o banco de dados a partir do arquivo de backup selecionado."""
    backup = db.query(BackupHistory).filter(BackupHistory.id == backup_id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup não encontrado.")

    try:
        file_bytes = download_backup_file(backup.s3_key, backup.filename)
        db.close()
        from app.core.database import engine
        engine.dispose()
        restore_db_dump(file_bytes)
        return {"message": f"Banco de dados restaurado com sucesso a partir de {backup.filename}!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao restaurar banco de dados: {str(e)}")

@router.patch("/{backup_id}/rename", response_model=BackupHistoryResponse)
def rename_backup(
    backup_id: int,
    payload: BackupRenameRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    """Renomeia um arquivo de backup no S3 e atualiza o registro no banco."""
    backup = db.query(BackupHistory).filter(BackupHistory.id == backup_id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup não encontrado.")

    new_name = payload.new_name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="O novo nome do backup não pode estar vazio.")

    # Higieniza o nome
    clean_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', new_name)
    # Garante que termina com .dump.gz se for dump ou mantém extensão original
    if not clean_name.lower().endswith(('.dump.gz', '.sql', '.dump', '.gz', '.tar')):
        clean_name = f"{clean_name}.dump.gz"

    # Verifica se já existe outro backup com o mesmo nome
    existing = db.query(BackupHistory).filter(
        BackupHistory.filename == clean_name,
        BackupHistory.id != backup_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Já existe um backup registrado com esse nome.")

    schedule = db.query(BackupSchedule).first()
    folder = schedule.destination_folder if schedule else None

    try:
        new_s3_key = rename_backup_file(backup.s3_key, backup.filename, clean_name, folder)
        backup.filename = clean_name
        backup.s3_key = new_s3_key
        db.commit()
        db.refresh(backup)

        dto = BackupHistoryResponse.model_validate(backup)
        dto.file_size_formatted = format_file_size(backup.file_size_bytes)
        return dto
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao renomear backup: {str(e)}")

@router.delete("/{backup_id}")
def delete_backup(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    backup = db.query(BackupHistory).filter(BackupHistory.id == backup_id).first()
    if not backup:
        raise HTTPException(status_code=404, detail="Backup não encontrado.")

    try:
        delete_backup_file(backup.s3_key, backup.filename)
        db.delete(backup)
        db.commit()
        return {"message": "Backup excluído com sucesso."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao excluir backup: {str(e)}")

@router.post("/bulk-delete")
def bulk_delete_backups(
    data: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    if not data.ids:
        raise HTTPException(status_code=400, detail="Nenhum backup selecionado.")

    backups = db.query(BackupHistory).filter(BackupHistory.id.in_(data.ids)).all()
    count = 0
    for b in backups:
        try:
            delete_backup_file(b.s3_key, b.filename)
            db.delete(b)
            count += 1
        except Exception:
            pass
    db.commit()
    return {"message": f"{count} backup(s) excluído(s) com sucesso.", "deleted_count": count}

@router.get("/schedule", response_model=BackupScheduleResponse)
def get_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    schedule = db.query(BackupSchedule).first()
    if not schedule:
        schedule = BackupSchedule(
            is_active=True,
            frequency="6h",
            destination_folder="projetobase/backups/",
            retention_max=30
        )
        db.add(schedule)
        db.commit()
        db.refresh(schedule)
    return schedule

@router.put("/schedule", response_model=BackupScheduleResponse)
def update_schedule(
    data: BackupScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superadmin)
):
    schedule = db.query(BackupSchedule).first()
    if not schedule:
        schedule = BackupSchedule()
        db.add(schedule)

    schedule.is_active = data.is_active
    schedule.frequency = data.frequency
    schedule.destination_folder = data.destination_folder
    schedule.retention_max = max(1, data.retention_max)
    schedule.updated_at = datetime.now(timezone.utc)

    if schedule.is_active:
        delta = parse_frequency_to_timedelta(schedule.frequency)
        schedule.next_run_at = datetime.now(timezone.utc) + delta
    else:
        schedule.next_run_at = None

    db.commit()
    db.refresh(schedule)

    # Reconfigura o scheduler em background
    setup_scheduler()

    return schedule
