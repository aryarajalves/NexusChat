import io
import pytest
from app.core.config import settings
from conftest import client, TestingSessionLocal

def get_auth_token(email=settings.SUPERADMIN_EMAIL, password=settings.SUPERADMIN_PASSWORD):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return res.json()["access_token"]

def test_roles_and_server_settings_full_flow():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Cria servidor para teste
    srv_res = client.post("/api/v1/discord/servers", json={"name": "Servidor Teste Roles"}, headers=headers)
    assert srv_res.status_code == 201
    server_id = srv_res.json()["id"]

    # 2. Cria cargos personalizados
    role1_res = client.post(
        f"/api/v1/discord/servers/{server_id}/roles",
        json={"name": "Moderador", "color": "#5865f2", "position": 1, "is_admin": True, "hoist": True},
        headers=headers
    )
    assert role1_res.status_code == 201
    role1 = role1_res.json()
    assert role1["name"] == "Moderador"
    assert role1["color"] == "#5865f2"
    assert role1["is_admin"] is True
    role1_id = role1["id"]

    role2_res = client.post(
        f"/api/v1/discord/servers/{server_id}/roles",
        json={"name": "VIP", "color": "#fee75c", "position": 2, "is_admin": False, "hoist": False},
        headers=headers
    )
    assert role2_res.status_code == 201
    role2_id = role2_res.json()["id"]

    # 3. Lista cargos do servidor
    list_roles_res = client.get(f"/api/v1/discord/servers/{server_id}/roles", headers=headers)
    assert list_roles_res.status_code == 200
    roles = list_roles_res.json()
    assert len(roles) >= 2
    role_names = [r["name"] for r in roles]
    assert "Moderador" in role_names
    assert "VIP" in role_names

    # 4. Atualiza propriedades de um cargo
    update_role_res = client.patch(
        f"/api/v1/discord/servers/{server_id}/roles/{role2_id}",
        json={"name": "Super VIP", "color": "#eb459e"},
        headers=headers
    )
    assert update_role_res.status_code == 200
    assert update_role_res.json()["name"] == "Super VIP"
    assert update_role_res.json()["color"] == "#eb459e"

    # 5. Obtém lista de membros do servidor
    members_res = client.get(f"/api/v1/discord/servers/{server_id}/members", headers=headers)
    assert members_res.status_code == 200
    members = members_res.json()
    assert len(members) >= 1
    owner_member = members[0]
    member_id = owner_member["id"]

    # 6. Atribui cargo ao membro
    assign_res = client.patch(
        f"/api/v1/discord/servers/{server_id}/members/{member_id}/role",
        json={"role_id": role1_id},
        headers=headers
    )
    assert assign_res.status_code == 200
    assigned_data = assign_res.json()
    assert assigned_data["role_id"] == role1_id
    assert assigned_data["role_name"] == "Moderador"
    assert assigned_data["role_color"] == "#5865f2"

    # 7. Remove cargo do membro
    remove_role_res = client.patch(
        f"/api/v1/discord/servers/{server_id}/members/{member_id}/role",
        json={"role_id": None},
        headers=headers
    )
    assert remove_role_res.status_code == 200
    assert remove_role_res.json()["role_id"] is None

    # 8. Upload de ícone do servidor
    fake_png = io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
    icon_res = client.post(
        f"/api/v1/discord/servers/{server_id}/icon",
        files={"file": ("icon.png", fake_png, "image/png")},
        headers=headers
    )
    assert icon_res.status_code == 200
    assert "icon_url" in icon_res.json()

    # 9. Upload de banner do servidor
    fake_banner = io.BytesIO(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
    banner_res = client.post(
        f"/api/v1/discord/servers/{server_id}/banner",
        files={"file": ("banner.png", fake_banner, "image/png")},
        headers=headers
    )
    assert banner_res.status_code == 200
    assert "banner_url" in banner_res.json()

    # 10. Exclui cargo
    del_role_res = client.delete(f"/api/v1/discord/servers/{server_id}/roles/{role1_id}", headers=headers)
    assert del_role_res.status_code == 200

    # 11. Limpeza do servidor de teste
    del_srv_res = client.delete(f"/api/v1/discord/servers/{server_id}", headers=headers)
    assert del_srv_res.status_code == 200

def test_unauthorized_role_creation():
    # Sem autenticação deve retornar 401
    res = client.post("/api/v1/discord/servers/999/roles", json={"name": "Hacker"})
    assert res.status_code == 401

def test_kick_server_member_flow():
    from app.models.user import User
    from app.core.security import get_password_hash
    import uuid

    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Cria servidor
    srv_res = client.post("/api/v1/discord/servers", json={"name": "Servidor Teste Kick"}, headers=headers)
    assert srv_res.status_code == 201
    server_id = srv_res.json()["id"]

    # 2. Cria convite
    invite_res = client.post(f"/api/v1/discord/servers/{server_id}/invites", headers=headers)
    assert invite_res.status_code == 201
    invite_code = invite_res.json()["code"]

    # 3. Cria um segundo usuário comum no DB de teste
    db = TestingSessionLocal()
    user2_email = f"kick_{uuid.uuid4().hex[:8]}@teste.com"
    user2 = User(
        email=user2_email,
        name="Membro Para Kick",
        hashed_password=get_password_hash("Password123!@#"),
        role="user",
        is_active=True,
        max_servers=100
    )
    db.add(user2)
    db.commit()
    db.refresh(user2)
    user2_id = user2.id
    db.close()

    user2_login = client.post("/api/v1/auth/login", json={"email": user2_email, "password": "Password123!@#"})
    assert user2_login.status_code == 200
    user2_headers = {"Authorization": f"Bearer {user2_login.json()['access_token']}"}

    # 4. Segundo usuário entra no servidor via convite
    join_res = client.post(f"/api/v1/discord/invites/{invite_code}/join", headers=user2_headers)
    assert join_res.status_code == 200

    # 5. Tentativa de remover o próprio dono do servidor deve retornar 400
    my_info = client.get("/api/v1/auth/me", headers=headers).json()
    owner_id = my_info["id"]
    kick_owner_res = client.delete(f"/api/v1/discord/servers/{server_id}/members/{owner_id}", headers=headers)
    assert kick_owner_res.status_code == 400
    assert "Não é possível remover o criador/dono" in kick_owner_res.json()["detail"]

    # 6. Membro comum tenta remover alguém sem permissão (retorna 403)
    unauth_kick_res = client.delete(f"/api/v1/discord/servers/{server_id}/members/{owner_id}", headers=user2_headers)
    assert unauth_kick_res.status_code == 403

    # 7. Dono remove o segundo usuário com sucesso
    kick_res = client.delete(f"/api/v1/discord/servers/{server_id}/members/{user2_id}", headers=headers)
    assert kick_res.status_code == 200
    assert kick_res.json()["user_id"] == user2_id

    # 8. Valida que o membro não está mais na lista de membros
    members_after = client.get(f"/api/v1/discord/servers/{server_id}/members", headers=headers).json()
    member_ids_after = [m["user_id"] for m in members_after]
    assert user2_id not in member_ids_after

    # 9. Limpa servidor
    client.delete(f"/api/v1/discord/servers/{server_id}", headers=headers)
