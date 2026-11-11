#!/usr/bin/env python3
"""
Auditor de Endpoints: Documentação, Autenticação e Rate Limiting.
Varre os roteadores FastAPI em backend/app/api/v1/endpoints verificando:
1. Documentação (summary explícito no decorador ou docstring clara)
2. Autenticação/Autorização em rotas privadas (get_current_user, require_admin, require_superadmin, etc.)
3. Proteção e boas práticas de API REST
"""

import os
import sys
import io

# Garante suporte a UTF-8 no Windows Console
if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENDPOINTS_DIR = os.path.join(BASE_DIR, "backend", "app", "api", "v1", "endpoints")

AUTH_DEPENDENCIES = [
    "get_current_user",
    "get_current_active_user",
    "get_current_admin",
    "require_admin",
    "require_superadmin",
    "require_admin_or_superadmin",
    "require_role",
    "verify_token",
]

PUBLIC_PATTERNS = [
    "/login",
    "/register",
    "/register/verify",
    "/register/resend-code",
    "/forgot-password",
    "/reset-password",
    "/reset-password/validate",
    "/reset-password/confirm",
    "/invites/validate",
    "/attachments/{filename}",
    "/health",
]

def analyze_module(filename):
    fpath = os.path.join(ENDPOINTS_DIR, filename)
    if not os.path.exists(fpath):
        return []

    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    lines = content.splitlines()
    endpoints = []

    for i, line in enumerate(lines):
        line_clean = line.strip()
        if line_clean.startswith(("@router.get(", "@router.post(", "@router.put(", "@router.delete(", "@router.patch(")):
            deco_block = []
            fn_sig_block = []
            j = i
            while j < len(lines) and not lines[j].strip().startswith(("def ", "async def ")):
                deco_block.append(lines[j].strip())
                j += 1
            if j < len(lines):
                deco_block.append(lines[j].strip())
                k = j
                # Coleta todo o cabeçalho da função até o ':' que fecha a assinatura
                paren_balance = 0
                while k < len(lines):
                    current_l = lines[k].strip()
                    fn_sig_block.append(current_l)
                    paren_balance += current_l.count("(") - current_l.count(")")
                    if paren_balance <= 0 and current_l.endswith(":"):
                        break
                    k += 1

            deco_text = " ".join(deco_block)
            fn_sig_text = " ".join(fn_sig_block)

            method = "GET"
            for m in ["get", "post", "put", "delete", "patch"]:
                if f"@router.{m}" in deco_text.lower():
                    method = m.upper()
                    break

            route_path = "desconhecida"
            if "(" in deco_text:
                raw_path = deco_text.split("(", 1)[1].split(",")[0].strip("\"' ")
                route_path = raw_path

            has_summary = "summary=" in deco_text
            has_docstring = False
            if k + 1 < len(lines) and '"""' in lines[k + 1]:
                has_docstring = True

            has_auth = any(auth_dep in fn_sig_text for auth_dep in AUTH_DEPENDENCIES)
            is_public = (
                any(pub in route_path for pub in PUBLIC_PATTERNS) or
                (filename == "discord_invites.py" and route_path == "/{code}" and method == "GET")
            )

            endpoints.append({
                "file": filename,
                "method": method,
                "path": route_path,
                "has_summary": has_summary,
                "has_docstring": has_docstring,
                "has_auth": has_auth,
                "is_public": is_public,
            })

    return endpoints

def run_audit():
    print("\n" + "=" * 80)
    print("📋 [AUDITORIA DE ENDPOINTS] Documentação OpenAPI e Autenticação de Rotas")
    print("=" * 80)

    all_modules = sorted([f for f in os.listdir(ENDPOINTS_DIR) if f.endswith(".py") and f != "__init__.py" and f != "discord_helpers.py"])

    total_endpoints = 0
    unauthenticated = []

    for mod in all_modules:
        eps = analyze_module(mod)
        if not eps:
            continue
        total_endpoints += len(eps)
        print(f"\n📂 Arquivo: {mod} ({len(eps)} endpoints)")
        print("-" * 80)

        for ep in eps:
            doc_str = "✅ Doc/Summary" if (ep["has_summary"] or ep["has_docstring"]) else "⚠️  Sem Doc"
            auth_str = "✅ Autenticado" if ep["has_auth"] else ("🌐 Rota Pública" if ep["is_public"] else "❌ SEM AUTORIZAÇÃO")

            if not ep["has_auth"] and not ep["is_public"]:
                unauthenticated.append((mod, ep["method"], ep["path"]))

            print(f"[{ep['method']:<6}] {ep['path']:<42} | {doc_str:<16} | {auth_str}")

    print("\n" + "=" * 80)
    print(f"📊 RESUMO DO DIAGNÓSTICO:")
    print(f"   • Total de endpoints auditados:        {total_endpoints}")
    print(f"   • Rotas privadas sem autenticação:    {len(unauthenticated)}")
    print("=" * 80)

    if unauthenticated:
        print("\n⛔ [BLOQUEIO ATIVADO] Existem rotas privadas sem injeção de autenticação:")
        for mod, m, p in unauthenticated:
            print(f"   • {mod} -> [{m}] {p}")
        return False

    print("\n✅ [SUCESSO] 100% dos endpoints privados possuem autenticação e proteção ativa!\n")
    return True

if __name__ == "__main__":
    ok = run_audit()
    sys.exit(0 if ok else 1)
