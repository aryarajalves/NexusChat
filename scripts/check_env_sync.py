#!/usr/bin/env python3
"""
Validador de Sincronia de Variáveis de Ambiente (.env.example).
Varre o backend em busca de os.getenv(...) e os.environ.get(...) e verifica se todas as variáveis
estão documentadas no arquivo backend/.env.example.
"""

import os
import sys
import re
import io

# Garante suporte a UTF-8 no Windows Console
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
ENV_EXAMPLE_PATH = os.path.join(BACKEND_DIR, ".env.example")

IGNORED_DIRS = {".git", ".pytest_cache", "__pycache__", "venv", ".venv", "tests"}

# Variáveis padrão do sistema ou frameworks que não precisam estar no .env.example
SYSTEM_VARS = {"PYTHONPATH", "PATH", "HOME", "TZ", "USER", "ENVIRONMENT", "LANG", "LC_ALL"}

def parse_env_example():
    if not os.path.exists(ENV_EXAMPLE_PATH):
        return set()
    documented = set()
    with open(ENV_EXAMPLE_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                var_name = line.split("=")[0].strip()
                documented.add(var_name)
    return documented

def find_used_env_vars():
    used_vars = set()
    pattern = re.compile(r'os\.(?:getenv|environ\.get)\(\s*["\']([A-Z0-9_]+)["\']')

    for root, dirs, files in os.walk(BACKEND_DIR):
        dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
        for file in files:
            if file.endswith(".py"):
                path = os.path.join(root, file)
                try:
                    with open(path, "r", encoding="utf-8", errors="ignore") as f:
                        for line in f:
                            for match in pattern.finditer(line):
                                var = match.group(1)
                                if var not in SYSTEM_VARS:
                                    used_vars.add(var)
                except Exception:
                    pass
    return used_vars

def check_env_sync():
    print("\n" + "=" * 70)
    print("📋 [ENV SYNC] Verificando sincronia do backend/.env.example...")
    print("=" * 70)

    documented = parse_env_example()
    used = find_used_env_vars()

    missing = sorted(list(used - documented))

    print(f"📊 Total de variáveis os.getenv() encontradas no backend: {len(used)}")
    print(f"📄 Total de variáveis documentadas no .env.example: {len(documented)}")

    if missing:
        print(f"\n⚠️  [AVISO] {len(missing)} variável(is) usada(s) no código ausente(s) no .env.example:")
        for v in missing:
            print(f"   • {v}")
        print("\n👉 AÇÃO: Adicione essas variáveis ao backend/.env.example com valores de exemplo.")
        print("=" * 70 + "\n")
        return False
    else:
        print("\n✅ [SUCESSO] Todas as variáveis de ambiente usadas no código estão no .env.example!")
        print("=" * 70 + "\n")
        return True

if __name__ == "__main__":
    ok = check_env_sync()
    sys.exit(0 if ok else 1)
