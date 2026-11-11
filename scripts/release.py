#!/usr/bin/env python3
"""
Esteira de Validação, Versionamento e Release Automatizada (GitHub).

Executa a sequência completa de integridade:
1. Verificação de Tabelas e Colunas no SQL de auto-migração (scripts/check_db_schema.py)
2. Scanner de Segredos e Vazamento de Credenciais (scripts/check_secrets.py)
3. Sincronia de Variáveis de Ambiente (scripts/check_env_sync.py)
4. Verificação de Limites de Código / Clean Code (scripts/check_limits.py)
5. Auditoria de Segurança de Dependências (scripts/audit_security.py)
6. Auditoria de Endpoints (Documentação e Autenticação) (scripts/audit_endpoints.py)
7. Auditoria de Otimização de Conexões e Banco de Dados (scripts/check_db_optimization.py)
8. Bateria de Testes Unitários do Backend (pytest no container)
9. Bateria de Testes Unitários do Frontend (vitest)
10. Build de Produção do Frontend (npm run build)
11. Incremento Decimal de Versão (Base 10: 1.0.7 -> 1.0.8)
12. Atualização de versão (frontend/package.json, docker-compose, README.md)
13. Limpeza de Arquivos Temporários na Raiz
"""

import os
import sys
import re
import json
import glob
import argparse
import subprocess
import io

# Garante suporte a UTF-8 no Windows Console
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
PACKAGE_JSON_PATH = os.path.join(FRONTEND_DIR, "package.json")
COMPOSE_PROD_PATH = os.path.join(BASE_DIR, "docker", "docker-compose-producao.yml")
README_PATH = os.path.join(BASE_DIR, "README.md")

def get_current_version() -> str:
    """Lê a versão atual do frontend/package.json (ou fallback para 1.0.7)."""
    if os.path.exists(PACKAGE_JSON_PATH):
        try:
            with open(PACKAGE_JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                v = data.get("version", "1.0.7")
                if v != "0.0.0":
                    return v
        except Exception:
            pass
    return "1.0.7"

def calculate_next_version(current_version: str) -> str:
    """
    Calcula a próxima versão segundo a regra decimal:
    X.Y.Z
    - Incrementa Z em 1.
    - Se Z > 9: Z = 0 e Y = Y + 1.
    - Se Y > 9: Y = 0 e X = X + 1.
    Exemplos:
      1.0.7 -> 1.0.8
      1.0.9 -> 1.1.0
      1.9.9 -> 2.0.0
    """
    parts = current_version.strip().split(".")
    if len(parts) != 3:
        raise ValueError(f"Formato de versão inválido: '{current_version}'. Esperado: X.Y.Z")
    try:
        x, y, z = int(parts[0]), int(parts[1]), int(parts[2])
    except ValueError:
        raise ValueError(f"Versão contém partes não numéricas: '{current_version}'")

    z += 1
    if z > 9:
        z = 0
        y += 1
    if y > 9:
        y = 0
        x += 1

    return f"{x}.{y}.{z}"

def update_version_files(new_version: str):
    """Atualiza a versão nos arquivos do projeto."""
    print(f"\n📝 Atualizando versão para {new_version} nos arquivos do projeto...")

    # 1. frontend/package.json
    if os.path.exists(PACKAGE_JSON_PATH):
        with open(PACKAGE_JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        data["version"] = new_version
        with open(PACKAGE_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"   [OK] {os.path.relpath(PACKAGE_JSON_PATH, BASE_DIR)}")

    # 2. docker/docker-compose-producao.yml
    if os.path.exists(COMPOSE_PROD_PATH):
        with open(COMPOSE_PROD_PATH, "r", encoding="utf-8") as f:
            compose_content = f.read()
        compose_content = re.sub(
            r'IMAGE_BACKEND:-aryalvesfernandes/nexus-chat:backend-[0-9.]+',
            f'IMAGE_BACKEND:-aryalvesfernandes/nexus-chat:backend-{new_version}',
            compose_content
        )
        compose_content = re.sub(
            r'IMAGE_FRONTEND:-aryalvesfernandes/nexus-chat:frontend-[0-9.]+',
            f'IMAGE_FRONTEND:-aryalvesfernandes/nexus-chat:frontend-{new_version}',
            compose_content
        )
        with open(COMPOSE_PROD_PATH, "w", encoding="utf-8") as f:
            f.write(compose_content)
        print(f"   [OK] {os.path.relpath(COMPOSE_PROD_PATH, BASE_DIR)}")

    # 3. README.md
    if os.path.exists(README_PATH):
        with open(README_PATH, "r", encoding="utf-8") as f:
            readme_content = f.read()
        if "Versão:" in readme_content:
            readme_content = re.sub(r'Versão:\s*`[0-9.]+`', f'Versão: `{new_version}`', readme_content)
        if "# NexusChat" in readme_content:
            readme_content = re.sub(
                r'# NexusChat \(Discord Clone Completo & Escalável\)( - v[0-9.]+)?',
                f'# NexusChat (Discord Clone Completo & Escalável) - v{new_version}',
                readme_content
            )
        with open(README_PATH, "w", encoding="utf-8") as f:
            f.write(readme_content)
        print(f"   [OK] {os.path.relpath(README_PATH, BASE_DIR)}")

def clean_root_trash():
    """Remove arquivos temporários, logs soltos e prints da raiz antes do commit."""
    print("\n🧹 Inspecionando e higienizando arquivos temporários na raiz...")
    trash_patterns = [
        "screenshot*.png",
        "fixed_layout_*.png",
        "modal_saved_*.png",
        "chrome_*.log",
        "chrome_err.log",
        "chrome_headless.log",
        "zapvoice_debug.log",
        "test_*.db",
        "zapvoice.db",
    ]
    deleted_files = []
    for pattern in trash_patterns:
        matches = glob.glob(os.path.join(BASE_DIR, pattern))
        for m in matches:
            try:
                os.remove(m)
                deleted_files.append(os.path.basename(m))
            except Exception:
                pass

    if deleted_files:
        print(f"   🗑️  Removidos {len(deleted_files)} arquivo(s) temporário(s): {', '.join(deleted_files)}")
    else:
        print("   ✨ Raiz limpa (nenhum arquivo temporário ou lixo encontrado).")

def run_step(name: str, cmd: list, cwd: str = BASE_DIR, check: bool = True) -> bool:
    print("\n" + "=" * 70)
    print(f"🚀 [ETAPA] {name}")
    print(f"   Comando: {' '.join(cmd)}")
    print("=" * 70)

    use_shell = sys.platform == "win32" or isinstance(cmd, str)
    res = subprocess.run(cmd, cwd=cwd, shell=use_shell)
    if res.returncode != 0:
        print(f"\n❌ [FALHA] Etapa '{name}' falhou com código de saída {res.returncode}.")
        if check:
            print("⛔ Esteira interrompida. Corrija o erro acima para continuar.")
            sys.exit(res.returncode)
        return False
    print(f"\n✅ [SUCESSO] Etapa '{name}' concluída com sucesso.")
    return True

def main():
    parser = argparse.ArgumentParser(description="Esteira completa de validação, testes e release")
    parser.add_argument("--version", type=str, help="Forçar uma versão específica (ex: 1.1.1)")
    parser.add_argument("--dry-run", action="store_true", help="Executa testes e validações sem atualizar arquivos nem commitar")
    parser.add_argument("--skip-tests", action="store_true", help="Pula execução da suíte de testes unitários")
    parser.add_argument("--skip-docker", action="store_true", help="Pula o build das imagens Docker")
    parser.add_argument("--push", action="store_true", default=True, help="Faz push das imagens para o Docker Hub (padrão: True)")
    parser.add_argument("--no-push", action="store_false", dest="push", help="Gera as imagens localmente sem enviar ao Docker Hub")
    args = parser.parse_args()

    curr_version = get_current_version()
    if args.version:
        target_version = args.version.strip()
    else:
        target_version = calculate_next_version(curr_version)

    print("\n" + "#" * 70)
    print("🎯 [ESTEIRA DE RELEASE - NEXUS CHAT]")
    print(f"📌 Versão Atual:   {curr_version}")
    print(f"✨ Próxima Versão:  {target_version}")
    print(f"🏷️  Imagem Backend:  aryalvesfernandes/nexus-chat:backend-{target_version}")
    print(f"🏷️  Imagem Frontend: aryalvesfernandes/nexus-chat:frontend-{target_version}")
    print("🚫 Regra de Tag:    NADA DE LATEST")
    print("#" * 70 + "\n")

    # 1. Verificação de Esquema de Banco (main.py vs SQLAlchemy Models)
    run_step(
        "1/10 - Validação de Integridade de Tabelas e Colunas",
        [sys.executable, os.path.join(BASE_DIR, "scripts", "check_db_schema.py")]
    )

    # 2. Scanner de Vazamento de Segredos
    run_step(
        "2/10 - Scanner de Vazamento de Segredos e Chaves",
        [sys.executable, os.path.join(BASE_DIR, "scripts", "check_secrets.py")]
    )

    # 3. Sincronia de .env.example
    run_step(
        "3/10 - Sincronia de Variáveis de Ambiente (.env.example)",
        [sys.executable, os.path.join(BASE_DIR, "scripts", "check_env_sync.py")]
    )

    # 4. Limites de Linhas de Código (Clean Code)
    run_step(
        "4/10 - Verificação de Limites de Linhas de Código",
        [sys.executable, os.path.join(BASE_DIR, "scripts", "check_limits.py")]
    )

    # 5. Auditoria de Segurança de Dependências (pip-audit & npm audit)
    run_step(
        "5/10 - Auditoria de Segurança de Dependências (pip + npm)",
        [sys.executable, os.path.join(BASE_DIR, "scripts", "audit_security.py")]
    )

    # 6. Auditoria de Endpoints (Documentação e Autenticação)
    run_step(
        "6/10 - Auditoria de Endpoints (Documentação e Autenticação)",
        [sys.executable, os.path.join(BASE_DIR, "scripts", "audit_endpoints.py")]
    )

    # 7. Auditoria de Otimização de Conexões e Banco de Dados (Pooling, 100% FK Indexes, Leaks)
    run_step(
        "7/10 - Auditoria de Otimização e Índices do Banco de Dados",
        [sys.executable, os.path.join(BASE_DIR, "scripts", "check_db_optimization.py")]
    )

    # 8. Testes Unitários do Backend e Frontend
    if not args.skip_tests:
        run_step(
            "8/10 - Testes Unitários do Backend (Pytest)",
            ["docker", "exec", "nexus_chat_backend", "pytest", "-q", "--tb=short", "tests/"]
        )

        run_step(
            "9/10 - Testes Unitários do Frontend (Vitest)",
            ["npm", "test", "--", "src/App.test.jsx", "src/components/AutomatedBackup.test.jsx", "src/components/discord/useDiscordUserWS.test.js", "src/components/discord/DiscordResponsive.test.jsx", "--run"],
            cwd=FRONTEND_DIR
        )
    else:
        print("\n⏩ Testes unitários ignorados (--skip-tests ativado).")

    # 10. Build do Frontend (Vite)
    run_step(
        "10/10 - Build de Produção do Frontend (Vite)",
        ["npm", "run", "build"],
        cwd=FRONTEND_DIR
    )

    # Limpeza de lixo
    clean_root_trash()

    if args.dry_run:
        print("\n" + "=" * 70)
        print("🔍 [DRY RUN] Simulação concluída com 100% de sucesso!")
        print(f"   Próxima versão a ser gerada: {target_version}")
        print("=" * 70 + "\n")
        return

    # Atualiza versão nos arquivos
    update_version_files(target_version)

    # 11. Build e Push das Imagens Docker de Produção (SEM TAG LATEST)
    backend_tag_hub = f"aryalvesfernandes/nexus-chat:backend-{target_version}"
    frontend_tag_hub = f"aryalvesfernandes/nexus-chat:frontend-{target_version}"

    if not args.skip_docker:
        print("\n" + "=" * 70)
        print("🐳 [DOCKER BUILD] Gerando imagens de produção (SEM TAG LATEST)...")
        print("=" * 70)

        # Build Backend
        run_step(
            f"Docker Build Backend: {backend_tag_hub}",
            ["docker", "build", "-t", backend_tag_hub, "."],
            cwd=BACKEND_DIR
        )

        # Build Frontend
        run_step(
            f"Docker Build Frontend: {frontend_tag_hub}",
            ["docker", "build", "-t", frontend_tag_hub, "."],
            cwd=FRONTEND_DIR
        )

        # Push para Docker Hub
        if args.push:
            print("\n" + "=" * 70)
            print("🚀 [DOCKER PUSH] Enviando imagens para o Docker Hub...")
            print("=" * 70)
            run_step(f"Push Backend: {backend_tag_hub}", ["docker", "push", backend_tag_hub])
            run_step(f"Push Frontend: {frontend_tag_hub}", ["docker", "push", frontend_tag_hub])

    print("\n" + "=" * 70)
    print("🎉 [SUCESSO TOTAL] Todas as etapas foram aprovadas!")
    print(f"✨ Versão Oficial: {target_version}")
    print(f"🐳 Backend Tag:   {backend_tag_hub}")
    print(f"🐳 Frontend Tag:  {frontend_tag_hub}")
    print("🚫 Nenhuma tag 'latest' utilizada.")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    main()
