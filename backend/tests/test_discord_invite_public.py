import pytest
from conftest import client
from tests.test_discord_api import get_auth_headers

def test_get_server_invite_public_info():
    headers = get_auth_headers()

    # Cria servidor de teste
    srv_res = client.post(
        "/api/v1/discord/servers",
        json={"name": "Servidor Público Convidado", "description": "Teste Convite"},
        headers=headers,
    )
    assert srv_res.status_code == 201
    server_id = srv_res.json()["id"]

    # Cria convite para o servidor
    inv_res = client.post(f"/api/v1/discord/servers/{server_id}/invites", json={}, headers=headers)
    assert inv_res.status_code == 201
    code = inv_res.json()["code"]

    # Consulta pública sem token de autenticação
    pub_res = client.get(f"/api/v1/discord/invites/{code}")
    assert pub_res.status_code == 200
    data = pub_res.json()
    assert data["code"] == code
    assert data["server_id"] == server_id
    assert data["server_name"] == "Servidor Público Convidado"
    assert data["members_count"] == 1
    assert data["is_expired"] is False

def test_get_server_invite_not_found():
    res = client.get("/api/v1/discord/invites/inexistente999")
    assert res.status_code == 404
    assert "inexistente" in res.json()["detail"].lower()
