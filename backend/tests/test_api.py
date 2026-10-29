import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app, init_superadmin
from app.core.database import Base, get_db
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, Invite, RegistrationVerification

from conftest import engine, TestingSessionLocal, client

def test_health_and_root():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    res_root = client.get("/")
    assert res_root.status_code == 200
    assert "NexusChat" in res_root.json()["message"]

def test_login_superadmin_success():
    login_payload = {
        "email": settings.SUPERADMIN_EMAIL,
        "password": settings.SUPERADMIN_PASSWORD
    }
    res = client.post("/api/v1/auth/login", json=login_payload)
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["role"] == "superadmin"

def test_login_wrong_password():
    login_payload = {
        "email": settings.SUPERADMIN_EMAIL,
        "password": "WrongPassword123!"
    }
    res = client.post("/api/v1/auth/login", json=login_payload)
    assert res.status_code == 401

def test_create_invite_and_register_user():
    # Login superadmin to get token
    login_res = client.post("/api/v1/auth/login", json={
        "email": settings.SUPERADMIN_EMAIL,
        "password": settings.SUPERADMIN_PASSWORD
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Tentar criar convite para superadmin (deve falhar)
    invalid_invite = client.post("/api/v1/auth/invites", json={"role": "superadmin", "duration_hours": 12}, headers=headers)
    assert invalid_invite.status_code == 422 or invalid_invite.status_code == 400

    # 2. Criar convite válido para admin
    invite_res = client.post("/api/v1/auth/invites", json={"role": "admin", "duration_hours": 24}, headers=headers)
    assert invite_res.status_code == 201
    invite_data = invite_res.json()
    invite_token = invite_data["token"]
    assert invite_token is not None

    # 3. Validar convite
    val_res = client.get(f"/api/v1/auth/invites/validate?token={invite_token}")
    assert val_res.status_code == 200
    assert val_res.json()["valid"] is True
    assert val_res.json()["role"] == "admin"

    # 4. Registrar usuário com senha fraca (deve falhar por validação de senha)
    weak_register = client.post("/api/v1/auth/register", json={
        "token": invite_token,
        "name": "Novo Admin",
        "email": "admin@teste.com",
        "password": "fraca"
    })
    assert weak_register.status_code == 422

    # 4.1 Registrar com senhas divergentes (deve falhar com 400)
    mismatch_reg = client.post("/api/v1/auth/register", json={
        "token": invite_token,
        "name": "Novo Admin",
        "email": "admin@teste.com",
        "password": "Password123456!",
        "password_confirm": "OutraSenha123456!"
    })
    assert mismatch_reg.status_code == 400
    assert "não coincidem" in mismatch_reg.json()["detail"]

    # 5. Iniciar registro de usuário com senha válida e confirmação coincidente (dispara OTP)
    valid_register = client.post("/api/v1/auth/register", json={
        "token": invite_token,
        "name": "Novo Admin",
        "email": "admin@teste.com",
        "password": "Password123456!",
        "password_confirm": "Password123456!"
    })
    assert valid_register.status_code == 200
    assert valid_register.json()["requires_verification"] is True

    # 5.1 Obter código OTP gerado no banco e validar código incorreto
    db = TestingSessionLocal()
    verif = db.query(RegistrationVerification).filter(RegistrationVerification.email == "admin@teste.com").first()
    assert verif is not None
    otp_code = verif.code
    db.close()

    wrong_code_res = client.post("/api/v1/auth/register/verify", json={
        "email": "admin@teste.com",
        "code": "000000"
    })
    assert wrong_code_res.status_code == 400
    assert "inválido" in wrong_code_res.json()["detail"]

    # 5.2 Validar código correto e concluir criação da conta
    verify_res = client.post("/api/v1/auth/register/verify", json={
        "email": "admin@teste.com",
        "code": otp_code
    })
    assert verify_res.status_code == 201
    new_user = verify_res.json()
    assert new_user["email"] == "admin@teste.com"
    assert new_user["role"] == "admin"

    # 6. Tentar usar o mesmo convite novamente (deve falhar pois já foi usado)
    reuse_invite = client.post("/api/v1/auth/register", json={
        "token": invite_token,
        "name": "Outro Admin",
        "email": "outro@teste.com",
        "password": "Password123456!"
    })
    assert reuse_invite.status_code == 400

    # 7. Listar convites gerados
    list_inv = client.get("/api/v1/auth/invites", headers=headers)
    assert list_inv.status_code == 200
    inv_list_data = list_inv.json()
    assert len(inv_list_data) >= 1
    found_invite = next(i for i in inv_list_data if i["token"] == invite_token)
    assert found_invite["is_used"] is True
    assert found_invite["used_by_email"] == "admin@teste.com"
    assert "restantes" in found_invite["time_remaining"] or "Expirado" in found_invite["time_remaining"]

def test_duplicate_email_registration_forbidden():
    # Login superadmin
    login_res = client.post("/api/v1/auth/login", json={
        "email": settings.SUPERADMIN_EMAIL,
        "password": settings.SUPERADMIN_PASSWORD
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Criar convite
    invite_res = client.post("/api/v1/auth/invites", json={"role": "user", "duration_hours": 24}, headers=headers)
    invite_token = invite_res.json()["token"]

    # Tentar registrar com email que já é do superadmin
    dup_res = client.post("/api/v1/auth/register", json={
        "token": invite_token,
        "name": "Tentativa Clone",
        "email": settings.SUPERADMIN_EMAIL,
        "password": "SecurePassword123!"
    })
    assert dup_res.status_code == 400
    assert "Já existe um usuário" in dup_res.json()["detail"]

def test_edit_user_role_and_superadmin_protection():
    # Login superadmin
    login_res = client.post("/api/v1/auth/login", json={
        "email": settings.SUPERADMIN_EMAIL,
        "password": settings.SUPERADMIN_PASSWORD
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Tentar editar o próprio Super Admin (deve falhar com 403)
    edit_superadmin = client.patch("/api/v1/auth/users/1", json={"role": "user"}, headers=headers)
    assert edit_superadmin.status_code == 403

    # 2. Criar um usuário via convite
    inv_res = client.post("/api/v1/auth/invites", json={"role": "user", "duration_hours": 10}, headers=headers)
    inv_tok = inv_res.json()["token"]
    reg_res = client.post("/api/v1/auth/register", json={
        "token": inv_tok,
        "name": "Membro Equipe",
        "email": "membro@equipe.com",
        "password": "MinhaSenhaForte1@",
        "password_confirm": "MinhaSenhaForte1@"
    })
    assert reg_res.status_code == 200

    db = TestingSessionLocal()
    verif = db.query(RegistrationVerification).filter(RegistrationVerification.email == "membro@equipe.com").first()
    otp_code = verif.code
    db.close()

    verify_res = client.post("/api/v1/auth/register/verify", json={
        "email": "membro@equipe.com",
        "code": otp_code
    })
    assert verify_res.status_code == 201
    user_id = verify_res.json()["id"]

    # 3. Alterar perfil do usuário para 'admin'
    edit_res = client.patch(f"/api/v1/auth/users/{user_id}", json={"role": "admin"}, headers=headers)
    assert edit_res.status_code == 200
    assert edit_res.json()["role"] == "admin"

    # 4. Alterar de volta para 'user'
    edit_back = client.patch(f"/api/v1/auth/users/{user_id}", json={"role": "user"}, headers=headers)
    assert edit_back.status_code == 200
    assert edit_back.json()["role"] == "user"

def test_create_user_manual_success():
    login_res = client.post("/api/v1/auth/login", json={
        "email": settings.SUPERADMIN_EMAIL,
        "password": settings.SUPERADMIN_PASSWORD
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Criar conta de usuário manualmente
    create_res = client.post("/api/v1/auth/users", json={
        "name": "Carlos Manual",
        "email": "carlos.manual@exemplo.com",
        "password": "SenhaForte123!@",
        "password_confirm": "SenhaForte123!@",
        "role": "admin"
    }, headers=headers)

    assert create_res.status_code == 201
    user_data = create_res.json()
    assert user_data["name"] == "Carlos Manual"
    assert user_data["email"] == "carlos.manual@exemplo.com"
    assert user_data["role"] == "admin"
    assert user_data["is_active"] is True

    # Validar que o usuário criado consegue fazer login
    login_user = client.post("/api/v1/auth/login", json={
        "email": "carlos.manual@exemplo.com",
        "password": "SenhaForte123!@"
    })
    assert login_user.status_code == 200
    assert "access_token" in login_user.json()

def test_create_user_manual_validations():
    login_res = client.post("/api/v1/auth/login", json={
        "email": settings.SUPERADMIN_EMAIL,
        "password": settings.SUPERADMIN_PASSWORD
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Senha fraca (falha de validação 422)
    weak_res = client.post("/api/v1/auth/users", json={
        "name": "Usuario Fraco",
        "email": "fraco@exemplo.com",
        "password": "123",
        "password_confirm": "123",
        "role": "user"
    }, headers=headers)
    assert weak_res.status_code == 422

    # 2. Senhas não coincidem (400)
    mismatch_res = client.post("/api/v1/auth/users", json={
        "name": "Usuario Mismatch",
        "email": "mismatch@exemplo.com",
        "password": "SenhaForte123!@",
        "password_confirm": "SenhaDiferente123!@",
        "role": "user"
    }, headers=headers)
    assert mismatch_res.status_code == 400
    assert "não coincidem" in mismatch_res.json()["detail"]

    # 3. Cria usuário com sucesso para testar duplicidade
    first_res = client.post("/api/v1/auth/users", json={
        "name": "Usuario Unico",
        "email": "unico@exemplo.com",
        "password": "SenhaForte123!@",
        "password_confirm": "SenhaForte123!@",
        "role": "user"
    }, headers=headers)
    assert first_res.status_code == 201

    # 4. Tentar criar com mesmo email (400)
    dup_res = client.post("/api/v1/auth/users", json={
        "name": "Usuario Duplicado",
        "email": "unico@exemplo.com",
        "password": "SenhaForte123!@",
        "password_confirm": "SenhaForte123!@",
        "role": "user"
    }, headers=headers)
    assert dup_res.status_code == 400
    assert "Já existe um usuário" in dup_res.json()["detail"]

    # 5. Tentativa de criação sem autenticação (401)
    unauth_res = client.post("/api/v1/auth/users", json={
        "name": "Sem Auth",
        "email": "sem.auth@exemplo.com",
        "password": "SenhaForte123!@",
        "role": "user"
    })
    assert unauth_res.status_code == 401

def test_password_reset_flow():
    # Login superadmin
    login_res = client.post("/api/v1/auth/login", json={
        "email": settings.SUPERADMIN_EMAIL,
        "password": settings.SUPERADMIN_PASSWORD
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Tentar gerar link de redefinição para o Super Admin (deve ser proibido com 403)
    reset_sa = client.post("/api/v1/auth/users/1/reset-password-request", headers=headers)
    assert reset_sa.status_code == 403

    # 2. Criar um usuário comum
    inv_res = client.post("/api/v1/auth/invites", json={"role": "user", "duration_hours": 10}, headers=headers)
    inv_tok = inv_res.json()["token"]
    reg_res = client.post("/api/v1/auth/register", json={
        "token": inv_tok,
        "name": "Usuario Teste",
        "email": "userteste@equipe.com",
        "password": "SenhaAntiga12345!",
        "password_confirm": "SenhaAntiga12345!"
    })
    assert reg_res.status_code == 200

    db = TestingSessionLocal()
    verif = db.query(RegistrationVerification).filter(RegistrationVerification.email == "userteste@equipe.com").first()
    otp_code = verif.code
    db.close()

    verify_res = client.post("/api/v1/auth/register/verify", json={
        "email": "userteste@equipe.com",
        "code": otp_code
    })
    assert verify_res.status_code == 201
    user_id = verify_res.json()["id"]

    # 3. Gerar link de redefinição de senha para esse usuário
    reset_req = client.post(f"/api/v1/auth/users/{user_id}/reset-password-request", headers=headers)
    assert reset_req.status_code == 200
    reset_data = reset_req.json()
    reset_token = reset_data["token"]
    assert reset_data["reset_url"].startswith("/reset-password?token=")

    # 4. Validar token de redefinição
    val_res = client.get(f"/api/v1/auth/reset-password/validate?token={reset_token}")
    assert val_res.status_code == 200
    assert val_res.json()["valid"] is True
    assert val_res.json()["email"] == "userteste@equipe.com"

    # 5. Tentar redefinir com senhas divergentes (deve falhar com 400)
    mismatch_res = client.post("/api/v1/auth/reset-password/confirm", json={
        "token": reset_token,
        "password": "NovaSenhaSegura123@",
        "password_confirm": "SenhaTotalmenteDiferente1@"
    })
    assert mismatch_res.status_code == 400
    assert "não coincidem" in mismatch_res.json()["detail"]

    # 6. Confirmar redefinição com nova senha coincidente
    confirm_res = client.post("/api/v1/auth/reset-password/confirm", json={
        "token": reset_token,
        "password": "NovaSenhaSegura123@",
        "password_confirm": "NovaSenhaSegura123@"
    })
    assert confirm_res.status_code == 200

    # 7. Testar login com a nova senha
    login_new = client.post("/api/v1/auth/login", json={
        "email": "userteste@equipe.com",
        "password": "NovaSenhaSegura123@"
    })
    assert login_new.status_code == 200

def test_argon2id_hash_and_pepper():
    from app.core.security import get_password_hash, verify_password
    plain = "MinhaSenhaSuperSecreta123!"
    hashed = get_password_hash(plain)
    
    # Verifica que o hash utiliza Argon2id ($argon2id$)
    assert hashed.startswith("$argon2id$")
    # Verifica que o hash é verificado com sucesso com a senha correta
    assert verify_password(plain, hashed) is True
    # Verifica que uma senha incorreta falha
    assert verify_password("SenhaErrada123!", hashed) is False

def test_user_and_invite_deletion_and_bulk_delete():
    # Login superadmin
    login_res = client.post("/api/v1/auth/login", json={
        "email": settings.SUPERADMIN_EMAIL,
        "password": settings.SUPERADMIN_PASSWORD
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Criar 2 convites
    inv1 = client.post("/api/v1/auth/invites", json={"role": "user", "duration_hours": 10}, headers=headers).json()
    inv2 = client.post("/api/v1/auth/invites", json={"role": "admin", "duration_hours": 10}, headers=headers).json()

    # 2. Excluir convite individual
    del_inv = client.delete(f"/api/v1/auth/invites/{inv1['id']}", headers=headers)
    assert del_inv.status_code == 200

    # 3. Exclusão em massa de convites
    bulk_inv = client.post("/api/v1/auth/invites/bulk-delete", json={"ids": [inv2["id"]]}, headers=headers)
    assert bulk_inv.status_code == 200
    assert bulk_inv.json()["deleted_count"] == 1

    # 4. Criar um usuário para testar deleção
    inv3 = client.post("/api/v1/auth/invites", json={"role": "user", "duration_hours": 10}, headers=headers).json()
    reg = client.post("/api/v1/auth/register", json={
        "token": inv3["token"],
        "name": "Deletar Usuario",
        "email": "deletar@teste.com",
        "password": "SenhaForte123!@",
        "password_confirm": "SenhaForte123!@"
    })
    assert reg.status_code == 200
    db = TestingSessionLocal()
    code = db.query(RegistrationVerification).filter(RegistrationVerification.email == "deletar@teste.com").first().code
    db.close()
    verif = client.post("/api/v1/auth/register/verify", json={"email": "deletar@teste.com", "code": code})
    user_id = verif.json()["id"]

    # 5. Tentar excluir Super Admin (proibido 403)
    del_sa = client.delete("/api/v1/auth/users/1", headers=headers)
    assert del_sa.status_code == 403

    # 6. Excluir usuário individual
    del_u = client.delete(f"/api/v1/auth/users/{user_id}", headers=headers)
    assert del_u.status_code == 200

    # 7. Testar bulk delete de usuários
    bulk_u = client.post("/api/v1/auth/users/bulk-delete", json={"ids": [1]}, headers=headers)
    assert bulk_u.status_code == 200
    # Superadmin é ignorado pelo bulk delete
    assert bulk_u.json()["deleted_count"] == 0

def test_non_superadmin_forbidden_from_management_endpoints():
    # 1. Login superadmin para criar usuário comum
    sa_login = client.post("/api/v1/auth/login", json={
        "email": settings.SUPERADMIN_EMAIL,
        "password": settings.SUPERADMIN_PASSWORD
    })
    sa_token = sa_login.json()["access_token"]
    sa_headers = {"Authorization": f"Bearer {sa_token}"}

    inv = client.post("/api/v1/auth/invites", json={"role": "user", "duration_hours": 2}, headers=sa_headers).json()
    client.post("/api/v1/auth/register", json={
        "token": inv["token"],
        "name": "Comum Acesso",
        "email": "comum.acesso@teste.com",
        "password": "SenhaForte123!@",
        "password_confirm": "SenhaForte123!@"
    })
    db = TestingSessionLocal()
    code = db.query(RegistrationVerification).filter(RegistrationVerification.email == "comum.acesso@teste.com").first().code
    db.close()
    client.post("/api/v1/auth/register/verify", json={"email": "comum.acesso@teste.com", "code": code})

    # 2. Login como usuário comum
    user_login = client.post("/api/v1/auth/login", json={
        "email": "comum.acesso@teste.com",
        "password": "SenhaForte123!@"
    })
    user_token = user_login.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # 3. Usuário comum NÃO pode listar usuários (403)
    users_res = client.get("/api/v1/auth/users", headers=user_headers)
    assert users_res.status_code == 403

    # 4. Usuário comum NÃO pode listar nem criar convites (403)
    inv_list_res = client.get("/api/v1/auth/invites", headers=user_headers)
    assert inv_list_res.status_code == 403

    inv_create_res = client.post("/api/v1/auth/invites", json={"role": "user", "duration_hours": 1}, headers=user_headers)
    assert inv_create_res.status_code == 403

def test_backup_system_full_flow():
    # Login superadmin
    login_res = client.post("/api/v1/auth/login", json={
        "email": settings.SUPERADMIN_EMAIL,
        "password": settings.SUPERADMIN_PASSWORD
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Obter estatísticas do painel
    stats_res = client.get("/api/v1/backups/dashboard-stats", headers=headers)
    assert stats_res.status_code == 200
    assert "current_count" in stats_res.json()
    assert "retention_max" in stats_res.json()

    # 2. Configurar agendador
    sched_res = client.put("/api/v1/backups/schedule", json={
        "is_active": True,
        "frequency": "12h",
        "destination_folder": "projetobase/backups/",
        "retention_max": 25
    }, headers=headers)
    assert sched_res.status_code == 200
    assert sched_res.json()["frequency"] == "12h"
    assert sched_res.json()["retention_max"] == 25

    # 3. Disparar backup manual com nome customizado
    from zoneinfo import ZoneInfo
    from datetime import datetime
    b_now = datetime.now(ZoneInfo("America/Sao_Paulo"))

    manual_res = client.post("/api/v1/backups/manual", json={"custom_name": "teste_brasilia"}, headers=headers)
    assert manual_res.status_code == 201
    bkp = manual_res.json()
    assert bkp["backup_type"] == "manual"
    assert bkp["filename"].startswith("teste_brasilia_")
    assert bkp["filename"].endswith(".dump.gz")
    # Confirma que contém o ano e mês do horário de Brasília
    assert b_now.strftime("%Y_%m") in bkp["filename"]
    backup_id = bkp["id"]

    # 3.1 Renomear backup existente
    rename_res = client.patch(f"/api/v1/backups/{backup_id}/rename", json={"new_name": "backup_renomeado_ok"}, headers=headers)
    assert rename_res.status_code == 200
    assert rename_res.json()["filename"] == "backup_renomeado_ok.dump.gz"

    # 4. Listar backups
    list_res = client.get("/api/v1/backups/list", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 5. Download do backup
    down_res = client.get(f"/api/v1/backups/download/{backup_id}", headers=headers)
    assert down_res.status_code == 200
    assert len(down_res.content) > 0

    # 6. Restauração do backup
    restore_res = client.post(f"/api/v1/backups/restore/{backup_id}", headers=headers)
    assert restore_res.status_code == 200
    assert "restaurado com sucesso" in restore_res.json()["message"]

    # 7. Importar backup externo
    import io
    fake_dump_file = io.BytesIO(b"-- Fake pg dump sql\nCREATE TABLE test_import();")
    import_res = client.post(
        "/api/v1/backups/import",
        files={"file": ("externo_backup.dump.gz", fake_dump_file, "application/gzip")},
        headers=headers
    )
    assert import_res.status_code == 201
    imported_bkp = import_res.json()
    assert imported_bkp["backup_type"] == "imported"

    # 8. Exclusão individual
    del_res = client.delete(f"/api/v1/backups/{backup_id}", headers=headers)
    assert del_res.status_code == 200

    # 9. Exclusão em lote
    bulk_res = client.post("/api/v1/backups/bulk-delete", json={"ids": [imported_bkp["id"]]}, headers=headers)
    assert bulk_res.status_code == 200
    assert bulk_res.json()["deleted_count"] == 1

def test_docker_logs_endpoints():
    login_res = client.post("/api/v1/auth/login", json={
        "email": settings.SUPERADMIN_EMAIL,
        "password": settings.SUPERADMIN_PASSWORD
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Listar serviços disponíveis (apenas backend e frontend)
    services_res = client.get("/api/v1/logs/services", headers=headers)
    assert services_res.status_code == 200
    services = services_res.json()
    assert len(services) == 2
    service_ids = [s["id"] for s in services]
    assert "backend" in service_ids
    assert "frontend" in service_ids
    assert "db" not in service_ids

    # 1.1 Testar conversão de Horário de Brasília
    from app.services.docker_logs_service import format_to_brasilia_time
    nginx_sample = '172.31.0.1 - - [29/Sep/2026:17:59:35 +0000] "GET / HTTP/1.1" 200 123'
    converted = format_to_brasilia_time(nginx_sample)
    # 17:59:35 UTC deve ser convertido para 14:59:35 em Brasília (UTC-3)
    assert "14:59:35" in converted
    assert "29/09/2026 14:59:35" in converted

    # 1.2 Testar conversão de Docker timestamp no início da linha
    docker_sample = '2026-09-29T18:04:29.123456789Z INFO: Servidor iniciado com sucesso.'
    docker_converted = format_to_brasilia_time(docker_sample)
    assert "[29/09/2026 15:04:29]" in docker_converted
    assert "INFO: Servidor iniciado com sucesso." in docker_converted

    # 2. Consultar logs de backend com filtro de data e horário
    logs_res = client.get("/api/v1/logs/backend?tail=20&date=2026-09-29&start_time=14:00&end_time=16:00", headers=headers)
    assert logs_res.status_code == 200
    data = logs_res.json()
    assert data["service"] == "backend"
    assert "logs" in data
    assert isinstance(data["logs"], list)

    # 3. Acesso bloqueado sem token
    unauth_res = client.get("/api/v1/logs/backend")
    assert unauth_res.status_code == 401



