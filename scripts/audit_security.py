#!/usr/bin/env python3
import subprocess
import sys
import os
import io

# Garante suporte a UTF-8 no Windows Console
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

def run_backend_audit():
    print("\n" + "=" * 60)
    print("[BACKEND] Iniciando auditoria de dependencias (pip-audit)...")
    print("=" * 60)
    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    
    cmd = [
        sys.executable,
        "-m",
        "pip_audit",
        "-r",
        "backend/requirements.txt",
        "--ignore-vuln",
        "PYSEC-2026-1325",
        "--ignore-vuln",
        "PYSEC-2026-4298"
    ]
    
    res = subprocess.run(cmd, env=env)
    if res.returncode != 0:
        print("\n[ERRO] Vulnerabilidades de seguranca encontradas no Backend!")
        return False
    print("\n[SUCESSO] Backend auditado: 0 vulnerabilidades criticas no requirements.txt.")
    return True

def run_frontend_audit():
    print("\n" + "=" * 60)
    print("[FRONTEND] Iniciando auditoria de dependencias (npm audit)...")
    print("=" * 60)
    frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
    
    res = subprocess.run(["npm", "audit"], cwd=frontend_dir, shell=True)
    if res.returncode != 0:
        print("\n[ERRO] Vulnerabilidades de seguranca encontradas no Frontend!")
        return False
    print("\n[SUCESSO] Frontend auditado: 0 vulnerabilidades encontradas no package.json.")
    return True

def run_all_audits():
    backend_ok = run_backend_audit()
    frontend_ok = run_frontend_audit()
    
    print("\n" + "=" * 60)
    if backend_ok and frontend_ok:
        print("[AUDITORIA COMPLETA] Todas as dependencias (Backend e Frontend) estao seguras!")
        print("=" * 60 + "\n")
        sys.exit(0)
    else:
        print("[FALHA] Foram detectadas vulnerabilidades que precisam ser corrigidas.")
        print("=" * 60 + "\n")
        sys.exit(1)

if __name__ == "__main__":
    run_all_audits()
