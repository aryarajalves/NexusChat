import os
import re
from typing import Dict, Any
from fastapi import HTTPException, status

BLOCKED_EXTENSIONS = {
    ".html", ".htm", ".xhtml", ".php", ".phtml",
    ".js", ".mjs", ".exe", ".bat", ".cmd", ".sh",
    ".vbs", ".scr", ".jar", ".msi", ".dll", ".com",
    ".cgi", ".pl", ".py", ".app"
}

SAFE_INLINE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp",
    ".mp3", ".wav", ".ogg", ".mp4", ".webm", ".m4a"
}

# Padrões suspeitos em arquivos SVG que podem causar Stored XSS
SVG_XSS_PATTERNS = [
    re.compile(rb"<\s*script", re.IGNORECASE),
    re.compile(rb"javascript\s*:", re.IGNORECASE),
    re.compile(rb"on(load|error|click|mouseover|focus|blur)\s*=", re.IGNORECASE),
    re.compile(rb"<\s*iframe", re.IGNORECASE),
    re.compile(rb"<\s*object", re.IGNORECASE),
    re.compile(rb"<\s*embed", re.IGNORECASE),
]

def sanitize_filename(filename: str) -> str:
    """Remove caracteres perigosos e sequências de traversal de caminho."""
    base = os.path.basename(filename.strip().replace("\x00", ""))
    # Remove caracteres de controle
    base = re.sub(r'[\x00-\x1f\x7f]', '', base)
    return base or "anexo_desconhecido"

def validate_uploaded_file(
    filename: str,
    file_bytes: bytes,
    max_size_bytes: int = 50 * 1024 * 1024
) -> Dict[str, Any]:
    """
    Valida tamanho, extensão e integridade de segurança de um anexo enviado.
    Lança HTTPException 400 caso o arquivo viole políticas de segurança.
    """
    clean_name = sanitize_filename(filename)
    ext = os.path.splitext(clean_name)[1].lower()

    if not clean_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nome de arquivo inválido."
        )

    # 1. Validação de tamanho
    if len(file_bytes) > max_size_bytes:
        limit_mb = max_size_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"O arquivo excede o limite máximo permitido de {limit_mb} MB."
        )

    # 2. Bloqueio de extensões executáveis e perigosas
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensão de arquivo não permitida por motivos de segurança ({ext})."
        )

    # 3. Sanitização contra Stored XSS em arquivos SVG
    if ext == ".svg":
        for pattern in SVG_XSS_PATTERNS:
            if pattern.search(file_bytes):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Arquivo SVG rejeitado: contém scripts ou diretivas potencialmente maliciosas."
                )

    # 4. Determinação segura de Content-Disposition
    is_safe_inline = ext in SAFE_INLINE_EXTENSIONS
    disposition = "inline" if is_safe_inline else "attachment"

    return {
        "clean_filename": clean_name,
        "extension": ext,
        "is_safe_inline": is_safe_inline,
        "content_disposition_type": disposition,
        "size": len(file_bytes)
    }

def get_content_disposition_for_file(filename: str) -> str:
    """Retorna 'inline' para mídias seguras ou 'attachment' para documentos/outros."""
    ext = os.path.splitext(filename.lower())[1]
    return "inline" if ext in SAFE_INLINE_EXTENSIONS else "attachment"
