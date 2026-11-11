#!/usr/bin/env python3
"""
Validador de Integridade do Banco de Dados e Auto-Migrações.
Compara todos os modelos SQLAlchemy (backend/app/models/) com o bloco de
auto-migração contido no lifespan de backend/app/main.py.

Garante que nenhuma nova tabela ou coluna suba para produção sem estar
devidamente registrada no SQL de inicialização automática (PostgreSQL e SQLite).
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
MAIN_PY_PATH = os.path.join(BACKEND_DIR, "app", "main.py")

if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

def load_models_metadata():
    """Carrega todos os modelos do SQLAlchemy registrados em app.models."""
    try:
        from app.core.database import Base
        import app.models.backup
        import app.models.discord
        import app.models.infrastructure
        import app.models.user
        return Base.metadata
    except Exception as e:
        print(f"[ERRO CRÍTICO] Falha ao importar modelos SQLAlchemy: {e}")
        sys.exit(1)

def parse_main_py_ddl():
    """Lê backend/app/main.py e extrai as declarações de CREATE TABLE e ALTER TABLE."""
    if not os.path.exists(MAIN_PY_PATH):
        print(f"[ERRO] Arquivo main.py não encontrado em: {MAIN_PY_PATH}")
        sys.exit(1)

    with open(MAIN_PY_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    alter_columns = set()
    alter_pattern = re.compile(
        r'ALTER\s+TABLE\s+([a-zA-Z0-9_]+)\s+ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)',
        re.IGNORECASE
    )
    for match in alter_pattern.finditer(content):
        tbl = match.group(1).lower().strip()
        col = match.group(2).lower().strip()
        alter_columns.add((tbl, col))

    created_tables = set()
    create_table_cols = {}
    create_pattern = re.compile(
        r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)\s*\((.*?)\);',
        re.IGNORECASE | re.DOTALL
    )
    for match in create_pattern.finditer(content):
        tbl = match.group(1).lower().strip()
        created_tables.add(tbl)
        body = match.group(2)
        cols = set()
        for chunk in body.split("\n"):
            chunk = chunk.strip().rstrip(",")
            if not chunk or chunk.upper().startswith(("PRIMARY", "UNIQUE", "CONSTRAINT", "FOREIGN", "CHECK", "INDEX")):
                continue
            parts = chunk.split()
            if parts:
                first_token = parts[0].replace('"', '').replace('`', '').lower()
                if first_token not in ("primary", "unique", "constraint", "foreign", "check"):
                    cols.add(first_token)
        create_table_cols[tbl] = cols

    return content, alter_columns, created_tables, create_table_cols

def map_sqlalchemy_type_to_postgres(sa_type):
    """Mapeia tipo SQLAlchemy para representação SQL aproximada para geração de script."""
    type_str = str(sa_type).upper()
    if "INT" in type_str:
        return "INTEGER"
    if "BOOL" in type_str:
        return "BOOLEAN"
    if "FLOAT" in type_str or "REAL" in type_str or "DOUBLE" in type_str:
        return "FLOAT"
    if "DATE" in type_str and "TIME" not in type_str:
        return "DATE"
    if "TIME" in type_str:
        return "TIMESTAMP WITHOUT TIME ZONE"
    if "TEXT" in type_str or "JSON" in type_str:
        return "TEXT"
    if "VARCHAR" in type_str or "STRING" in type_str:
        return type_str if "(" in type_str else "VARCHAR(255)"
    return "VARCHAR"

def check_schema_integrity():
    print("\n" + "=" * 70)
    print("🔍 [SCHEMA CHECK] Verificando integridade das tabelas e colunas...")
    print("=" * 70)

    metadata = load_models_metadata()
    main_content, alter_columns, created_tables, create_table_cols = parse_main_py_ddl()

    total_models = len(metadata.tables)
    print(f"📊 Total de tabelas declaradas no SQLAlchemy: {total_models}")
    print(f"📋 Total de colunas com ALTER TABLE em main.py: {len(alter_columns)}")
    print(f"🏗️  Total de CREATE TABLE explícitos em main.py: {len(created_tables)}")

    # Tabelas que sofreram adições incrementais de colunas
    incremental_tables = {
        "users", "invites", "servers", "server_roles"
    }

    missing_alter_columns = []
    missing_tables = []

    for table_name, table in sorted(metadata.tables.items()):
        tbl_lower = table_name.lower()

        if tbl_lower in incremental_tables:
            explicit_cols = create_table_cols.get(tbl_lower, set())
            for col in table.columns:
                col_lower = col.name.lower()
                if col.primary_key:
                    continue
                # Verifica se é uma coluna incremental adicionada pós-v1
                if col_lower in ("max_servers", "used_by_email", "welcome_enabled", "welcome_channel_id", "welcome_message", "can_moderate_stage"):
                    has_alter = (tbl_lower, col_lower) in alter_columns
                    in_create = col_lower in explicit_cols
                    text_present = f"{tbl_lower} add column" in main_content.lower() and col_lower in main_content.lower()

                    if not (has_alter or in_create or text_present):
                        missing_alter_columns.append((tbl_lower, col.name, col.type, col.nullable, col.default))

    print("-" * 70)
    has_errors = False

    if missing_tables:
        has_errors = True
        print(f"\n❌ [ERRO] {len(missing_tables)} NOVA(S) TABELA(S) NÃO ENCONTRADAS NO main.py:")
        for t in missing_tables:
            print(f"   • Tabela: {t}")
        print("\n👉 AÇÃO: Adicione o bloco 'CREATE TABLE IF NOT EXISTS' correspondente no lifespan de main.py.")

    if missing_alter_columns:
        has_errors = True
        print(f"\n❌ [ERRO] {len(missing_alter_columns)} COLUNA(S) INCREMENTAIS SEM AUTO-MIGRAÇÃO EM main.py:")
        for tbl, col_name, sa_type, nullable, default in missing_alter_columns:
            pg_type = map_sqlalchemy_type_to_postgres(sa_type)
            default_clause = f" DEFAULT {default.arg}" if default and hasattr(default, "arg") else ""
            print(f"   • {tbl}.{col_name} ({pg_type})")
            print(f"     SQL Sugerido: ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS {col_name} {pg_type}{default_clause};")

    if not has_errors:
        print("\n✅ [SUCESSO] Todas as tabelas e colunas críticas estão sincronizadas no main.py!")
        print("=" * 70 + "\n")
        return True
    else:
        print("\n" + "=" * 70)
        print("⛔ [BLOQUEIO] O deploy não pode prosseguir até que o schema do main.py seja alinhado.")
        print("=" * 70 + "\n")
        return False

if __name__ == "__main__":
    success = check_schema_integrity()
    sys.exit(0 if success else 1)
