#!/usr/bin/env python3
"""
Scanner de Segredos e Vazamento de Credenciais (Secret Scanning).
Varre o repositório em busca de tokens de API, chaves privadas, senhas reais
e arquivos de ambiente sensíveis antes de qualquer commit, push ou build Docker.
"""

import os
import sys
import re
import io
import subprocess

# Garante suporte a UTF-8 no Windows Console
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Diretórios e arquivos permitidos ou ignorados
IGNORED_DIRS = {
    ".git", ".pytest_cache", "__pycache__", "node_modules", "dist",
    "build", ".vscode", ".idea", "venv", ".venv", "backups_refactor"
}

ALLOWED_FILES = {
    ".env.example", ".env.producao.example", "package-lock.json",
    "DATABASE_SCHEMA_LOG.md", "check_secrets.py", "livekit.yaml"
}

# Padrões de chaves e segredos reais
PATTERNS = [
    # OpenAI Real API Key (sk-proj- ou sk- com tamanho real)
    (r'sk-proj-[a-zA-Z0-9_-]{32,}', "OpenAI Project API Key"),
    (r'(?<![a-zA-Z0-9])sk-[a-zA-Z0-9]{40,}', "OpenAI Legacy API Key"),

    # GitHub Tokens
    (r'ghp_[a-zA-Z0-9]{36}', "GitHub Personal Access Token"),
    (r'github_pat_[a-zA-Z0-9_]{50,}', "GitHub Fine-Grained Token"),

    # Chaves Privadas (RSA, SSH, PGP)
    (r'-----BEGIN [A-Z ]*PRIVATE KEY-----', "Private Key Certificate"),

    # Brevo API Key Real
    (r'xkeysib-[a-zA-Z0-9]{64}', "Brevo Real API Key"),

    # AWS Access Key ID
    (r'(?<![A-Z0-9])AKIA[0-9A-Z]{16}(?![A-Z0-9])', "AWS Access Key ID"),

    # Slack Webhooks
    (r'https://hooks\.slack\.com/services/T[a-zA-Z0-9_]+/B[a-zA-Z0-9_]+/[a-zA-Z0-9_]+', "Slack Webhook URL"),
]

def mask_secret(secret_str):
    if len(secret_str) <= 10:
        return "****"
    return secret_str[:4] + "****" + secret_str[-4:]

def get_tracked_git_files():
    """Obtém a lista de arquivos rastreados pelo Git."""
    try:
        res = subprocess.run(
            ["git", "ls-files"],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            check=True
        )
        return set(res.stdout.splitlines())
    except Exception:
        return None

def is_git_ignored(rel_path):
    """Verifica se o caminho está no .gitignore."""
    try:
        res = subprocess.run(
            ["git", "check-ignore", rel_path],
            cwd=BASE_DIR,
            capture_output=True,
            text=True
        )
        return res.returncode == 0
    except Exception:
        return False

def scan_files():
    print("\n" + "=" * 70)
    print("🔐 [SECRET SCANNER] Iniciando busca por chaves e credenciais expostas...")
    print("=" * 70)

    tracked_files = get_tracked_git_files()
    found_secrets = []
    leaked_env_files = []
    unignored_env_files = []

    for root, dirs, files in os.walk(BASE_DIR):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]

        for file in files:
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, BASE_DIR).replace("\\", "/")

            # 1. Checagem de integridade de arquivos .env
            if file in (".env", ".env.local", ".env.production", ".env.prod"):
                # Se estiver no Git (rastreado), é vazamento GRAVE
                if tracked_files and rel_path in tracked_files:
                    leaked_env_files.append(rel_path)
                elif not is_git_ignored(rel_path):
                    # Não está rastreado mas não está no .gitignore (risco de git add .)
                    unignored_env_files.append(rel_path)
                continue

            if file in ALLOWED_FILES:
                continue

            # Se temos git tracked files, inspeciona apenas o que é versionado
            if tracked_files and rel_path not in tracked_files:
                continue

            ext = os.path.splitext(file)[1].lower()
            if ext not in (".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".yml", ".yaml", ".env", ".sh", ".md", ".txt"):
                continue

            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line_num, line in enumerate(f, 1):
                        # Pula linhas de placeholders conhecidos
                        if any(x in line.lower() for x in ("exemplo", "sua-chave", "placeholder", "sk-****", "sua_chave")):
                            continue

                        for pattern, desc in PATTERNS:
                            matches = re.findall(pattern, line)
                            for match in matches:
                                if any(x in match.lower() for x in ("test", "fake", "dummy", "example", "sua_chave")):
                                    continue
                                found_secrets.append({
                                    "file": rel_path,
                                    "line": line_num,
                                    "desc": desc,
                                    "masked": mask_secret(match)
                                })
            except Exception:
                pass

    has_errors = False

    if leaked_env_files:
        has_errors = True
        print(f"\n❌ [CRÍTICO] Arquivo .env real RASTREADO NO GIT:")
        for ef in leaked_env_files:
            print(f"   • {ef} (REMOVA IMEDIATAMENTE COM: git rm --cached {ef})")

    if unignored_env_files:
        has_errors = True
        print(f"\n❌ [ALERTA] Arquivo .env local NÃO PROTEGIDO no .gitignore:")
        for ef in unignored_env_files:
            print(f"   • {ef}")
        print("👉 AÇÃO: Adicione ao .gitignore para evitar inclusão acidental.")

    if found_secrets:
        has_errors = True
        print(f"\n❌ [ALERTA DE SEGURANÇA] {len(found_secrets)} segredo(s) potencialmente exposto(s):")
        for item in found_secrets:
            print(f"   • [{item['desc']}] {item['file']}:{item['line']} -> {item['masked']}")
        print("\n👉 AÇÃO: Substitua as credenciais reais por os.getenv() e revogue as chaves vazadas.")

    if not has_errors:
        print("\n✅ [SUCESSO] Scanner de segredos: 0 credenciais sensíveis ou arquivos .env vazados no repositório.")
        print("=" * 70 + "\n")
        return True
    else:
        print("\n" + "=" * 70)
        print("⛔ [BLOQUEIO] O deploy foi cancelado para proteger suas credenciais.")
        print("=" * 70 + "\n")
        return False

if __name__ == "__main__":
    is_safe = scan_files()
    sys.exit(0 if is_safe else 1)
