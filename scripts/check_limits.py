#!/usr/bin/env python3
"""
Validador de Limites de Código / Clean Code.
Assegura que nenhum arquivo ultrapasse as diretrizes arquiteturais:
- Backend (Python): máximo de 1.000 linhas
- Frontend (React / JSX / JS / CSS): máximo de 500 linhas
"""

import os
import sys
import io

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def check_files():
    print("\n" + "=" * 70)
    print("📏 [CLEAN CODE] Verificando limites de linhas de código por arquivo...")
    print("=" * 70)

    frontend_files = []
    backend_files = []

    # 1. Checar Frontend (< 500 linhas)
    frontend_dir = os.path.join(BASE_DIR, "frontend", "src")
    if os.path.exists(frontend_dir):
        for root, _, files in os.walk(frontend_dir):
            for f in files:
                if f.endswith((".jsx", ".js", ".css")) and not f.endswith((".test.jsx", ".test.js", ".spec.jsx", ".spec.js")):
                    path = os.path.join(root, f)
                    try:
                        with open(path, "r", encoding="utf-8", errors="ignore") as file:
                            count = len(file.readlines())
                            if count > 500:
                                rel_path = os.path.relpath(path, BASE_DIR).replace("\\", "/")
                                frontend_files.append((count, rel_path))
                    except Exception:
                        pass

    # 2. Checar Backend (< 1000 linhas)
    backend_dir = os.path.join(BASE_DIR, "backend")
    if os.path.exists(backend_dir):
        for root, _, files in os.walk(backend_dir):
            if any(x in root for x in ["venv", ".venv", ".pytest_cache", "__pycache__", "alembic"]):
                continue
            for f in files:
                if f.endswith(".py"):
                    path = os.path.join(root, f)
                    try:
                        with open(path, "r", encoding="utf-8", errors="ignore") as file:
                            count = len(file.readlines())
                            if count > 1000:
                                rel_path = os.path.relpath(path, BASE_DIR).replace("\\", "/")
                                backend_files.append((count, rel_path))
                    except Exception:
                        pass

    has_errors = False

    print("=== ARQUIVOS FRONTEND ACIMA DE 500 LINHAS ===")
    if not frontend_files:
        print("  ✅ [OK] Nenhum arquivo do Frontend ultrapassou 500 linhas.")
    else:
        has_errors = True
        for count, path in sorted(frontend_files, key=lambda x: x[0], reverse=True):
            print(f"  ❌ [EXCEDEU] {count:4d} linhas -> {path}")

    print("\n=== ARQUIVOS BACKEND ACIMA DE 1000 LINHAS ===")
    if not backend_files:
        print("  ✅ [OK] Nenhum arquivo do Backend ultrapassou 1.000 linhas.")
    else:
        has_errors = True
        for count, path in sorted(backend_files, key=lambda x: x[0], reverse=True):
            print(f"  ❌ [EXCEDEU] {count:4d} linhas -> {path}")

    print("=" * 70 + "\n")
    return not has_errors

if __name__ == "__main__":
    ok = check_files()
    sys.exit(0 if ok else 1)
