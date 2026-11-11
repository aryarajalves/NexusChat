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

_cached_s3_client = None

def get_s3_client():
    """Retorna o cliente S3 configurado para o Backblaze B2 (reutilizado em pool de conexões)."""
    global _cached_s3_client
    if _cached_s3_client is not None:
        return _cached_s3_client

    if not settings.B2_ENDPOINT_URL or not settings.B2_KEY_ID or not settings.B2_APPLICATION_KEY:
        return None
    try:
        _cached_s3_client = boto3.client(
            "s3",
            endpoint_url=settings.B2_ENDPOINT_URL,
            aws_access_key_id=settings.B2_KEY_ID,
            aws_secret_access_key=settings.B2_APPLICATION_KEY,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "virtual"},
                max_pool_connections=50,
                connect_timeout=10,
                read_timeout=30,
            ),
        )
        return _cached_s3_client
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

MANAGED_ATTACHMENT_PREFIX = "/api/v1/discord/attachments/"


def _get_media_s3_key(filename: str) -> str:
    """Monta a chave padronizada de objeto S3/B2 para mídias do Discord."""
    safe_filename = os.path.basename(filename)
    target_folder = settings.B2_MEDIA_FOLDER or "discord_media/"
    if not target_folder.endswith("/"):
        target_folder += "/"
    return f"{target_folder}{safe_filename}"


def extract_managed_media_filename(attachment_url: Optional[str]) -> Optional[str]:
    """
    Extrai o nome do arquivo apenas se a URL pertencer ao endpoint gerenciado
    (/api/v1/discord/attachments/<filename>), ignorando links externos.
    """
    if not attachment_url or not isinstance(attachment_url, str):
        return None
    clean_url = attachment_url.strip().split("?", 1)[0].split("#", 1)[0]
    if not clean_url.startswith(MANAGED_ATTACHMENT_PREFIX):
        return None
    raw_name = clean_url[len(MANAGED_ATTACHMENT_PREFIX):]
    if not raw_name or "/" in raw_name or "\\" in raw_name:
        return None
    safe_name = os.path.basename(raw_name)
    return safe_name or None


def upload_discord_media_file(file_bytes: bytes, filename: str, content_type: Optional[str] = None) -> dict:
    """
    Quando o Backblaze B2 está configurado, envia o arquivo diretamente da memória RAM
    para a nuvem sem salvar cópia no HD local do servidor.
    Utiliza o disco local apenas como fallback automático (ex.: ambiente local sem B2).
    """
    safe_filename = os.path.basename(filename)
    s3_key = _get_media_s3_key(safe_filename)
    s3 = get_s3_client()

    if s3 and settings.B2_BUCKET_NAME:
        try:
            s3.put_object(
                Bucket=settings.B2_BUCKET_NAME,
                Key=s3_key,
                Body=file_bytes,
                ContentType=content_type or "application/octet-stream",
            )
            stale_local = os.path.join(DISCORD_UPLOAD_DIR, safe_filename)
            if os.path.exists(stale_local):
                try:
                    os.remove(stale_local)
                except Exception as rm_err:
                    logger.error(f"Erro ao remover cópia local residual '{stale_local}': {rm_err}")

            logger.info(f"Mídia do Discord '{safe_filename}' enviada diretamente ao Backblaze B2 ({s3_key}) sem gravar no HD local.")
            return {
                "filename": safe_filename,
                "s3_key": s3_key,
                "storage": "b2",
                "attachment_url": f"{MANAGED_ATTACHMENT_PREFIX}{safe_filename}",
                "size": len(file_bytes),
                "local_path": None,
            }
        except Exception as e:
            logger.error(f"Erro ao enviar mídia '{safe_filename}' para o Backblaze B2 (ativando fallback local): {e}")

    os.makedirs(DISCORD_UPLOAD_DIR, exist_ok=True)
    local_path = os.path.join(DISCORD_UPLOAD_DIR, safe_filename)
    with open(local_path, "wb") as f:
        f.write(file_bytes)
    logger.info(f"Mídia do Discord '{safe_filename}' salva em fallback local ({local_path}).")

    return {
        "filename": safe_filename,
        "s3_key": s3_key,
        "storage": "local",
        "attachment_url": f"{MANAGED_ATTACHMENT_PREFIX}{safe_filename}",
        "size": len(file_bytes),
        "local_path": local_path,
    }


def get_discord_media_file_path(filename: str) -> Optional[str]:
    """
    Retorna o caminho do arquivo de mídia apenas se existir no fallback local
    (sem baixar cópias do Backblaze B2 para o HD do servidor).
    """
    safe_filename = os.path.basename(filename)
    if not safe_filename:
        return None
    local_path = os.path.join(DISCORD_UPLOAD_DIR, safe_filename)
    if os.path.exists(local_path) and os.path.isfile(local_path):
        return local_path

    legacy_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "discord")
    legacy_path = os.path.join(legacy_dir, safe_filename)
    if os.path.exists(legacy_path) and os.path.isfile(legacy_path):
        return legacy_path

    return None


def get_discord_media_presigned_url(
    filename: str,
    expires_in: int = 3600,
    content_disposition: Optional[str] = None,
) -> Optional[str]:
    """Gera URL pré-assinada do Backblaze B2 para streaming/download direto na nuvem."""
    safe_filename = os.path.basename(filename)
    if not safe_filename:
        return None
    s3 = get_s3_client()
    if s3 and settings.B2_BUCKET_NAME:
        s3_key = _get_media_s3_key(safe_filename)
        params = {"Bucket": settings.B2_BUCKET_NAME, "Key": s3_key}
        if content_disposition == "attachment":
            params["ResponseContentDisposition"] = f'attachment; filename="{safe_filename}"'
        elif content_disposition == "inline":
            params["ResponseContentDisposition"] = "inline"
        try:
            return s3.generate_presigned_url(
                "get_object",
                Params=params,
                ExpiresIn=expires_in,
            )
        except Exception as e:
            logger.error(f"Erro ao gerar URL assinada para {s3_key}: {e}")
    return None


def resolve_discord_media_delivery(
    filename: str,
    content_disposition: Optional[str] = None,
) -> Optional[dict]:
    """
    Resolve como entregar um anexo sem ocupar o HD do servidor:
    - Se existir no Backblaze B2: retorna {'mode': 'redirect', 'url': <presigned_or_cdn_url>}
    - Se existir no fallback local: retorna {'mode': 'local', 'local_path': <path>}
    - Caso contrário: retorna None (404).
    """
    safe_filename = os.path.basename(filename)
    if not safe_filename:
        return None

    s3 = get_s3_client()
    if s3 and settings.B2_BUCKET_NAME:
        s3_key = _get_media_s3_key(safe_filename)
        try:
            s3.head_object(Bucket=settings.B2_BUCKET_NAME, Key=s3_key)
            cdn_base = (settings.BACKBLAZE_CDN_URL or "").strip().rstrip("/")
            if cdn_base and "backblazeb2.com" not in cdn_base.lower():
                cloud_url = f"{cdn_base}/{s3_key}"
            else:
                cloud_url = get_discord_media_presigned_url(
                    safe_filename,
                    expires_in=3600,
                    content_disposition=content_disposition,
                )
            if cloud_url:
                return {"mode": "redirect", "url": cloud_url}
        except ClientError as e:
            err_code = str(e.response.get("Error", {}).get("Code", ""))
            if err_code not in ("404", "NoSuchKey", "NotFound"):
                logger.error(f"Erro ao consultar mídia '{safe_filename}' no Backblaze B2: {e}")
        except Exception as e:
            logger.error(f"Falha ao verificar mídia '{safe_filename}' no Backblaze B2: {e}")

    local_path = get_discord_media_file_path(safe_filename)
    if local_path:
        return {"mode": "local", "local_path": local_path}

    return None


def delete_discord_media_file(filename: str) -> dict:
    """Exclui fisicamente o arquivo de mídia do Backblaze B2 e do fallback local."""
    safe_filename = os.path.basename(filename)
    if not safe_filename:
        return {"deleted_b2": False, "deleted_local": False}

    deleted_b2 = False
    deleted_local = False
    s3_key = _get_media_s3_key(safe_filename)

    s3 = get_s3_client()
    if s3 and settings.B2_BUCKET_NAME:
        try:
            s3.delete_object(Bucket=settings.B2_BUCKET_NAME, Key=s3_key)
            deleted_b2 = True
            logger.info(f"Mídia '{safe_filename}' ({s3_key}) deletada fisicamente do Backblaze B2.")
        except Exception as e:
            logger.error(f"Erro ao deletar mídia '{safe_filename}' ({s3_key}) do Backblaze B2: {e}")

    legacy_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads", "discord")
    for candidate_path in (
        os.path.join(DISCORD_UPLOAD_DIR, safe_filename),
        os.path.join(legacy_dir, safe_filename),
    ):
        if os.path.exists(candidate_path) and os.path.isfile(candidate_path):
            try:
                os.remove(candidate_path)
                deleted_local = True
                logger.info(f"Mídia '{safe_filename}' deletada fisicamente do disco local ({candidate_path}).")
            except Exception as e:
                logger.error(f"Erro ao remover arquivo local '{candidate_path}': {e}")

    return {"deleted_b2": deleted_b2, "deleted_local": deleted_local}


def is_media_url_still_referenced(db, attachment_url: str) -> bool:
    """Verifica se alguma mensagem (canal ou DM), servidor ou usuário ainda referencia o anexo."""
    filename = extract_managed_media_filename(attachment_url)
    if not filename:
        return False

    from sqlalchemy import or_
    from app.models.discord import Message, DMMessage, Server
    from app.models.user import User

    canonical_url = f"{MANAGED_ATTACHMENT_PREFIX}{filename}"
    urls_to_check = list({attachment_url.strip(), canonical_url})

    if db.query(Message.id).filter(Message.attachment_url.in_(urls_to_check)).first():
        return True
    if db.query(DMMessage.id).filter(DMMessage.attachment_url.in_(urls_to_check)).first():
        return True
    if db.query(Server.id).filter(
        or_(Server.icon_url.in_(urls_to_check), Server.banner_url.in_(urls_to_check))
    ).first():
        return True
    if db.query(User.id).filter(User.avatar_url.in_(urls_to_check)).first():
        return True

    return False


def cleanup_unreferenced_media(db, candidate_urls) -> int:
    """
    Exclui fisicamente do Backblaze B2 e do disco local todas as mídias gerenciadas
    de `candidate_urls` que não possuam mais nenhuma referência no banco de dados.
    """
    if not candidate_urls:
        return 0

    seen_filenames = set()
    deleted_count = 0
    for raw_url in candidate_urls:
        filename = extract_managed_media_filename(raw_url)
        if not filename or filename in seen_filenames:
            continue
        seen_filenames.add(filename)
        try:
            if not is_media_url_still_referenced(db, raw_url):
                res = delete_discord_media_file(filename)
                if res["deleted_b2"] or res["deleted_local"]:
                    deleted_count += 1
        except Exception as e:
            logger.error(f"Erro ao limpar mídia órfã '{filename}': {e}")

    return deleted_count


def collect_channel_media_urls(db, channel_id: int) -> list:
    """Coleta todas as URLs de anexos vinculadas às mensagens de um canal."""
    from app.models.discord import Message

    rows = db.query(Message.attachment_url).filter(
        Message.channel_id == channel_id,
        Message.attachment_url.isnot(None),
    ).all()
    return [r[0] for r in rows if r[0]]


def collect_server_media_urls(db, server_id: int) -> list:
    """Coleta ícone, banner e todos os anexos de mensagens de um servidor antes de sua exclusão."""
    from app.models.discord import Server, Channel, Message

    urls = []
    server = db.query(Server).filter(Server.id == server_id).first()
    if server:
        if server.icon_url:
            urls.append(server.icon_url)
        if server.banner_url:
            urls.append(server.banner_url)

    msg_rows = (
        db.query(Message.attachment_url)
        .join(Channel, Message.channel_id == Channel.id)
        .filter(Channel.server_id == server_id, Message.attachment_url.isnot(None))
        .all()
    )
    urls.extend(r[0] for r in msg_rows if r[0])
    return urls
