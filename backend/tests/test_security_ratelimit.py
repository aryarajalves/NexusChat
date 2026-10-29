import pytest
from fastapi import HTTPException
from app.core.rate_limiter import rate_limiter, check_rate_limit, get_client_ip
from app.core.upload_security import (
    validate_uploaded_file,
    get_content_disposition_for_file,
    BLOCKED_EXTENSIONS
)
from conftest import client

@pytest.mark.asyncio
async def test_distributed_rate_limiter_memory_fallback():
    """Valida o funcionamento do rate limiter em memória com teto e bloqueio HTTP 429."""
    test_key = "test_unit_user_42"
    rate_limiter.reset(test_key)

    # Primeiras 3 requisições permitidas
    for i in range(3):
        allowed = await check_rate_limit(
            key=test_key,
            max_requests=3,
            window_seconds=10,
            error_detail="Limite excedido para teste",
            force=True
        )
        assert allowed is True

    # 4ª requisição deve lançar HTTPException 429
    with pytest.raises(HTTPException) as exc_info:
        await check_rate_limit(
            key=test_key,
            max_requests=3,
            window_seconds=10,
            error_detail="Limite excedido para teste",
            force=True
        )

    assert exc_info.value.status_code == 429
    assert "Limite excedido para teste" in exc_info.value.detail
    assert "Retry-After" in exc_info.value.headers
    assert int(exc_info.value.headers["Retry-After"]) > 0

    # Reset da chave deve liberar imediatamente
    rate_limiter.reset(test_key)
    allowed_after_reset = await check_rate_limit(
        key=test_key,
        max_requests=3,
        window_seconds=10,
        force=True
    )
    assert allowed_after_reset is True

def test_security_headers_middleware():
    """Valida a presença dos cabeçalhos defensivos em todas as respostas HTTP."""
    resp = client.get("/health")
    assert resp.status_code == 200
    headers = resp.headers

    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "camera=(self)" in headers.get("Permissions-Policy", "")
    assert "microphone=(self)" in headers.get("Permissions-Policy", "")
    assert "display-capture=(self)" in headers.get("Permissions-Policy", "")

def test_upload_security_blocked_extensions():
    """Valida que extensões executáveis e perigosas são sumariamente rejeitadas."""
    dangerous_files = [
        ("malware.exe", b"MZ..."),
        ("script.bat", b"@echo off"),
        ("backdoor.php", b"<?php phpinfo(); ?>"),
        ("shell.sh", b"#!/bin/bash"),
        ("exploit.html", b"<script>alert(1)</script>"),
        ("payload.js", b"console.log('pwned')"),
        ("app.jar", b"PK..."),
    ]

    for filename, content in dangerous_files:
        with pytest.raises(HTTPException) as exc:
            validate_uploaded_file(filename, content)
        assert exc.value.status_code == 400
        assert "não permitida por motivos de segurança" in exc.value.detail

def test_upload_security_svg_xss_detection():
    """Valida que arquivos SVG contendo scripts e vetores XSS são bloqueados."""
    malicious_svgs = [
        b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>',
        b'<svg><g onload="fetch(\'/api/v1/auth/me\')"></g></svg>',
        b'<svg><a href="javascript:alert(1)"><text>Clique</text></a></svg>',
        b'<svg><circle onerror="alert(1)" /></svg>',
    ]

    for svg_bytes in malicious_svgs:
        with pytest.raises(HTTPException) as exc:
            validate_uploaded_file("avatar.svg", svg_bytes)
        assert exc.value.status_code == 400
        assert "scripts ou diretivas potencialmente maliciosas" in exc.value.detail

    # SVG legítimo e limpo deve passar normalmente
    clean_svg = b'<svg width="100" height="100"><circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" /></svg>'
    result = validate_uploaded_file("clean_badge.svg", clean_svg)
    assert result["clean_filename"] == "clean_badge.svg"
    assert result["extension"] == ".svg"

def test_upload_security_safe_media_and_disposition():
    """Valida se imagens seguras recebem inline e outros arquivos recebem attachment."""
    safe_png = validate_uploaded_file("photo.PNG", b"\x89PNG\r\n\x1a\n...")
    assert safe_png["is_safe_inline"] is True
    assert safe_png["content_disposition_type"] == "inline"
    assert get_content_disposition_for_file("photo.PNG") == "inline"

    safe_webp = validate_uploaded_file("audio.mp3", b"ID3...")
    assert safe_webp["is_safe_inline"] is True
    assert safe_webp["content_disposition_type"] == "inline"

    document_pdf = validate_uploaded_file("relatorio.pdf", b"%PDF-1.4...")
    assert document_pdf["is_safe_inline"] is False
    assert document_pdf["content_disposition_type"] == "attachment"
    assert get_content_disposition_for_file("relatorio.pdf") == "attachment"

def test_upload_security_file_size_limit():
    """Valida rejeição de arquivos que excedem o limite estabelecido."""
    tiny_limit = 1024 # 1 KB
    huge_data = b"0" * 2048

    with pytest.raises(HTTPException) as exc:
        validate_uploaded_file("big.png", huge_data, max_size_bytes=tiny_limit)
    assert exc.value.status_code == 400
    assert "excede o limite máximo permitido" in exc.value.detail

def test_login_rate_limiting_http_endpoint(monkeypatch):
    """Valida que o endpoint de login retorna HTTP 429 após 5 tentativas consecutivas."""
    from app.core.config import settings
    monkeypatch.setattr(settings, "RATELIMIT_ENABLED", True)
    rate_limiter.reset()

    # Executa 5 tentativas de login
    for _ in range(5):
        resp = client.post("/api/v1/auth/login", json={"email": "attacker@spam.com", "password": "wrong"})
        assert resp.status_code in (401, 400)

    # 6ª tentativa deve ser barrada com 429
    res_blocked = client.post("/api/v1/auth/login", json={"email": "attacker@spam.com", "password": "wrong"})
    assert res_blocked.status_code == 429
    assert "Muitas tentativas" in res_blocked.json()["detail"]
    assert "Retry-After" in res_blocked.headers
    rate_limiter.reset()
