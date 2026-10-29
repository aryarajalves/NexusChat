"""
Serviço de Armazenamento S3 (Backblaze B2 / AWS S3) para Backups e Mídias do Discord.
"""
import io
import os
from typing import Optional
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from app.core.config import settings
from app.core.logger import logger

DISCORD_UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "uploads",
    "discord"
)
os.makedirs(DISCORD_UPLOAD_DIR, exist_ok=True)

def get_s3_client():
    """Retorna o cliente S3 configurado para o Backblaze B2."""
    if not settings.B2_ENDPOINT_URL or not settings.B2_KEY_ID or not settings.B2_APPLICATION_KEY:
        return None
    try:
        return boto3.client(
            "s3",
            endpoint_url=settings.B2_ENDPOINT_URL,
            aws_access_key_id=settings.B2_KEY_ID,
            aws_secret_access_key=settings.B2_APPLICATION_KEY,
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
        )
    except Exception as e:
        logger.error(f"Erro ao inicializar cliente S3/B2: {e}")
        return None

def check_b2_connection() -> dict:
    """Verifica se as credenciais do Backblaze B2 estão configuradas e se o bucket está acessível."""
    if not settings.B2_ENDPOINT_URL or not settings.B2_KEY_ID or not settings.B2_APPLICATION_KEY or not settings.B2_BUCKET_NAME:
        return {
            "connected": False,
            "status": "Não Configurado",
            "message": "Credenciais do Backblaze B2 não foram preenchidas no .env",
            "bucket": settings.B2_BUCKET_NAME or "—"
        }
    
    s3 = get_s3_client()
    if not s3:
        return {
            "connected": False,
            "status": "Erro de Cliente",
            "message": "Falha ao instanciar cliente S3",
            "bucket": settings.B2_BUCKET_NAME
        }

    try:
        s3.head_bucket(Bucket=settings.B2_BUCKET_NAME)
        return {
            "connected": True,
            "status": "Conectado",
            "message": "Sincronização em nuvem ativa",
            "bucket": settings.B2_BUCKET_NAME
        }
    except ClientError as e:
        logger.error(f"Erro ao conectar ao bucket {settings.B2_BUCKET_NAME}: {e}")
        return {
            "connected": False,
            "status": "Erro de Conexão",
            "message": str(e),
            "bucket": settings.B2_BUCKET_NAME
        }
    except Exception as e:
        logger.error(f"Erro inesperado no check_b2_connection: {e}")
        return {
            "connected": False,
            "status": "Desconectado",
            "message": str(e),
            "bucket": settings.B2_BUCKET_NAME
        }

def upload_backup_file(file_bytes: bytes, filename: str, folder: str = None) -> str:
    """Faz upload do arquivo compactado de backup para o bucket S3/B2."""
    s3 = get_s3_client()
    target_folder = folder or settings.B2_FOLDER
    if not target_folder.endswith("/"):
        target_folder += "/"
    s3_key = f"{target_folder}{filename}"

    if s3 and settings.B2_BUCKET_NAME:
        try:
            s3.put_object(
                Bucket=settings.B2_BUCKET_NAME,
                Key=s3_key,
                Body=file_bytes,
                ContentType="application/gzip"
            )
            logger.info(f"Backup {filename} enviado com sucesso para o bucket {settings.B2_BUCKET_NAME} chave {s3_key}")
            return s3_key
        except Exception as e:
            logger.error(f"Erro ao enviar backup para S3/B2: {e}")
            pass

    # Fallback local se S3 não estiver configurado
    local_dir = "/app/backups_local"
    os.makedirs(local_dir, exist_ok=True)
    local_path = os.path.join(local_dir, filename)
    with open(local_path, "wb") as f:
        f.write(file_bytes)
    logger.info(f"Backup {filename} salvo localmente em {local_path} (S3 não configurado ou offline)")
    return s3_key

def download_backup_file(s3_key: str, filename: str) -> bytes:
    """Baixa o arquivo de backup do S3 ou do fallback local."""
    s3 = get_s3_client()
    if s3 and settings.B2_BUCKET_NAME:
        try:
            response = s3.get_object(Bucket=settings.B2_BUCKET_NAME, Key=s3_key)
            return response["Body"].read()
        except Exception as e:
            logger.error(f"Erro ao baixar {s3_key} do S3/B2: {e}")

    # Fallback local
    local_path = os.path.join("/app/backups_local", filename)
    if os.path.exists(local_path):
        with open(local_path, "rb") as f:
            return f.read()
    raise FileNotFoundError(f"Arquivo de backup {filename} não foi encontrado no S3 nem no armazenamento local.")

def delete_backup_file(s3_key: str, filename: str) -> bool:
    """Exclui o arquivo de backup do bucket S3 e do armazenamento local."""
    s3 = get_s3_client()
    if s3 and settings.B2_BUCKET_NAME:
        try:
            s3.delete_object(Bucket=settings.B2_BUCKET_NAME, Key=s3_key)
            logger.info(f"Arquivo {s3_key} deletado do S3/B2 com sucesso")
        except Exception as e:
            logger.error(f"Erro ao deletar {s3_key} do S3/B2: {e}")

    local_path = os.path.join("/app/backups_local", filename)
    if os.path.exists(local_path):
        try:
            os.remove(local_path)
        except Exception:
            pass
    return True

def rename_backup_file(old_s3_key: str, old_filename: str, new_filename: str, folder: str = None) -> str:
    """Renomeia um arquivo no bucket S3 (copy + delete) e no armazenamento local."""
    target_folder = folder or settings.B2_FOLDER
    if not target_folder.endswith("/"):
        target_folder += "/"
    new_s3_key = f"{target_folder}{new_filename}"

    s3 = get_s3_client()
    if s3 and settings.B2_BUCKET_NAME:
        try:
            copy_source = {"Bucket": settings.B2_BUCKET_NAME, "Key": old_s3_key}
            s3.copy_object(CopySource=copy_source, Bucket=settings.B2_BUCKET_NAME, Key=new_s3_key)
            s3.delete_object(Bucket=settings.B2_BUCKET_NAME, Key=old_s3_key)
            logger.info(f"Arquivo renomeado no S3 de {old_s3_key} para {new_s3_key}")
        except Exception as e:
            logger.error(f"Erro ao renomear arquivo no S3: {e}")
            raise RuntimeError(f"Falha ao renomear arquivo no S3: {e}")

    # Fallback local
    old_local = os.path.join("/app/backups_local", old_filename)
    new_local = os.path.join("/app/backups_local", new_filename)
    if os.path.exists(old_local):
        try:
            os.rename(old_local, new_local)
        except Exception as e:
            logger.error(f"Erro ao renomear arquivo local: {e}")

    return new_s3_key


# ==========================================
# 🎮 Armazenamento de Mídias do Discord (S3 / B2)
# ==========================================

def upload_discord_media_file(file_bytes: bytes, filename: str, content_type: Optional[str] = None) -> dict:
    """
    Salva o arquivo no cache local de uploads e realiza upload assíncrono/sincronizado
    para o Backblaze B2 (se configurado).
    """
    target_folder = settings.B2_MEDIA_FOLDER or "discord_media/"
    if not target_folder.endswith("/"):
        target_folder += "/"
    s3_key = f"{target_folder}{filename}"

    # Salva sempre no disco local (cache de acesso instantâneo)
    local_path = os.path.join(DISCORD_UPLOAD_DIR, filename)
    with open(local_path, "wb") as f:
        f.write(file_bytes)

    s3 = get_s3_client()
    storage_type = "local"
    if s3 and settings.B2_BUCKET_NAME:
        try:
            s3.put_object(
                Bucket=settings.B2_BUCKET_NAME,
                Key=s3_key,
                Body=file_bytes,
                ContentType=content_type or "application/octet-stream"
            )
            storage_type = "b2"
            logger.info(f"Mídia do Discord {filename} enviada para o Backblaze B2: {s3_key}")
        except Exception as e:
            logger.error(f"Erro ao enviar mídia {filename} para o Backblaze B2: {e}")

    return {
        "filename": filename,
        "s3_key": s3_key,
        "storage": storage_type,
        "attachment_url": f"/api/v1/discord/attachments/{filename}",
        "size": len(file_bytes),
        "local_path": local_path
    }

def get_discord_media_file_path(filename: str) -> Optional[str]:
    """
    Retorna o caminho do arquivo de mídia no disco local.
    Se o arquivo não existir localmente (ex: instância escalada em outro container),
    baixa sob demanda a partir do Backblaze B2 e salva no cache local.
    """
    safe_filename = os.path.basename(filename)
    local_path = os.path.join(DISCORD_UPLOAD_DIR, safe_filename)

    if os.path.exists(local_path):
        return local_path

    s3 = get_s3_client()
    if s3 and settings.B2_BUCKET_NAME:
        target_folder = settings.B2_MEDIA_FOLDER or "discord_media/"
        if not target_folder.endswith("/"):
            target_folder += "/"
        s3_key = f"{target_folder}{safe_filename}"
        try:
            response = s3.get_object(Bucket=settings.B2_BUCKET_NAME, Key=s3_key)
            data = response["Body"].read()
            with open(local_path, "wb") as f:
                f.write(data)
            logger.info(f"Mídia {safe_filename} baixada do Backblaze B2 e armazenada no cache local")
            return local_path
        except Exception as e:
            logger.error(f"Falha ao recuperar mídia {safe_filename} do Backblaze B2: {e}")

    return None

def get_discord_media_presigned_url(filename: str, expires_in: int = 3600) -> Optional[str]:
    """Gera URL pré-assinada do Backblaze B2 para acesso direto e CDN."""
    s3 = get_s3_client()
    if s3 and settings.B2_BUCKET_NAME:
        target_folder = settings.B2_MEDIA_FOLDER or "discord_media/"
        if not target_folder.endswith("/"):
            target_folder += "/"
        s3_key = f"{target_folder}{os.path.basename(filename)}"
        try:
            return s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.B2_BUCKET_NAME, "Key": s3_key},
                ExpiresIn=expires_in
            )
        except Exception as e:
            logger.error(f"Erro ao gerar URL assinada para {s3_key}: {e}")
    return None
