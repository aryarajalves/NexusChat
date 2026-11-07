"""
Testes unitários para o Módulo de Emojis Customizados do Servidor.
"""
import io
import pytest
from conftest import client, TestingSessionLocal
from app.models.user import User
from app.models.discord import Server, ServerMember
from app.core.security import get_password_hash


def create_user_helper(email: str, name: str, role: str = "user") -> int:
    db = TestingSessionLocal()
    existing = db.query(User).filter(User.email == email).first()
    if not existing:
        u = User(
            email=email,
            name=name,
            hashed_password=get_password_hash("SenhaForte123!@"),
            role=role,
            is_active=True,
            max_servers=100,
        )
        db.add(u)
        db.commit()
        db.refresh(u)
        uid = u.id
    else:
        existing.role = role
        db.commit()
        uid = existing.id
    db.close()
    return uid


def get_auth_token(email: str):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "SenhaForte123!@"})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def setup_server_emoji_scenario():
    """Cria um servidor com 1 Dono e 1 Membro comum."""
    db = TestingSessionLocal()
    owner_id = create_user_helper("owner_emoji@teste.com", "Server Owner", "user")
    member_id = create_user_helper("member_emoji@teste.com", "Member Normal", "user")

    server = Server(name="Servidor Emojis Test", owner_id=owner_id)
    db.add(server)
    db.commit()
    db.refresh(server)

    db.add(ServerMember(server_id=server.id, user_id=owner_id, role="OWNER"))
    db.add(ServerMember(server_id=server.id, user_id=member_id, role="MEMBER"))
    db.commit()

    data = {
        "server_id": server.id,
        "owner_id": owner_id,
        "member_id": member_id,
    }
    db.close()
    return data


def test_upload_and_list_server_emojis_success(setup_server_emoji_scenario):
    """Valida o cadastro e listagem de emojis customizados pelo dono do servidor."""
    sc = setup_server_emoji_scenario
    headers_owner = get_auth_token("owner_emoji@teste.com")
    headers_member = get_auth_token("member_emoji@teste.com")

    fake_image = io.BytesIO(b"fake-png-data-stream-123")

    # 1. Dono faz upload de emoji
    res_upload = client.post(
        f"/api/v1/discord/servers/{sc['server_id']}/emojis",
        headers=headers_owner,
        data={"name": ":pepe_hype:"},
        files={"file": ("pepe_hype.png", fake_image, "image/png")},
    )
    assert res_upload.status_code == 201
    data = res_upload.json()
    assert data["name"] == "pepe_hype"
    assert "image_url" in data
    emoji_id = data["id"]

    # 2. Membro do servidor lista emojis com sucesso
    res_list = client.get(
        f"/api/v1/discord/servers/{sc['server_id']}/emojis",
        headers=headers_member,
    )
    assert res_list.status_code == 200
    emojis = res_list.json()
    assert len(emojis) >= 1
    assert any(e["id"] == emoji_id and e["name"] == "pepe_hype" for e in emojis)


def test_upload_duplicate_emoji_name_fails(setup_server_emoji_scenario):
    """Garante que não é permitido cadastrar emojis com nomes duplicados no mesmo servidor."""
    sc = setup_server_emoji_scenario
    headers_owner = get_auth_token("owner_emoji@teste.com")

    fake_image1 = io.BytesIO(b"fake-png-1")
    fake_image2 = io.BytesIO(b"fake-png-2")

    # Cadastra o primeiro
    res1 = client.post(
        f"/api/v1/discord/servers/{sc['server_id']}/emojis",
        headers=headers_owner,
        data={"name": "fogo"},
        files={"file": ("fogo.png", fake_image1, "image/png")},
    )
    assert res1.status_code == 201

    # Tenta cadastrar outro com mesmo nome (:fogo:)
    res2 = client.post(
        f"/api/v1/discord/servers/{sc['server_id']}/emojis",
        headers=headers_owner,
        data={"name": ":fogo:"},
        files={"file": ("fogo.png", fake_image2, "image/png")},
    )
    assert res2.status_code == 400
    assert "Já existe um emoji" in res2.json()["detail"]


def test_member_cannot_upload_or_delete_emoji(setup_server_emoji_scenario):
    """Valida que membros comuns não têm privilégio para cadastrar ou deletar emojis."""
    sc = setup_server_emoji_scenario
    headers_owner = get_auth_token("owner_emoji@teste.com")
    headers_member = get_auth_token("member_emoji@teste.com")

    # 1. Membro tenta upload -> 403
    fake_image = io.BytesIO(b"fake-png-data")
    res_upload = client.post(
        f"/api/v1/discord/servers/{sc['server_id']}/emojis",
        headers=headers_member,
        data={"name": "tentativa_ilegal"},
        files={"file": ("ilegal.png", fake_image, "image/png")},
    )
    assert res_upload.status_code == 403

    # 2. Dono cadastra emoji
    res_owner_upload = client.post(
        f"/api/v1/discord/servers/{sc['server_id']}/emojis",
        headers=headers_owner,
        data={"name": "legal_emoji"},
        files={"file": ("legal.png", io.BytesIO(b"fake-png-data"), "image/png")},
    )
    assert res_owner_upload.status_code == 201
    emoji_id = res_owner_upload.json()["id"]

    # 3. Membro tenta deletar -> 403
    res_del_member = client.delete(
        f"/api/v1/discord/servers/{sc['server_id']}/emojis/{emoji_id}",
        headers=headers_member,
    )
    assert res_del_member.status_code == 403

    # 4. Dono deleta com sucesso -> 200
    res_del_owner = client.delete(
        f"/api/v1/discord/servers/{sc['server_id']}/emojis/{emoji_id}",
        headers=headers_owner,
    )
    assert res_del_owner.status_code == 200
    assert res_del_owner.json()["status"] == "deleted"
