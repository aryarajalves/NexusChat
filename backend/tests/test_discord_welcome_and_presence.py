from app.core.security import get_password_hash
from app.models.user import User
from conftest import TestingSessionLocal, client


def _ensure_user(email: str, name: str) -> int:
    db = TestingSessionLocal()
    existing = db.query(User).filter(User.email == email).first()
    if not existing:
        user = User(
            email=email,
            name=name,
            hashed_password=get_password_hash("SenhaForte123!@"),
            role="user",
            is_active=True,
            max_servers=100,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        uid = user.id
    else:
        uid = existing.id
    db.close()
    return uid


def _login(email: str) -> tuple[str, dict]:
    res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "SenhaForte123!@"},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    return token, {"Authorization": f"Bearer {token}"}


def test_server_welcome_enabled_sends_mention_and_syncs_new_member_ws():
    """
    Valida que:
    1) Ao entrar via convite, o evento 'server:member_joined' chega em tempo real no /ws/me.
    2) Com boas-vindas ativado, uma mensagem automática marcando @NovoMembro é postada no canal escolhido.
    """
    _ensure_user("owner_welcome@teste.com", "Dono Comunidade")
    new_uid = _ensure_user("novo_membro_welcome@teste.com", "NovoContato")

    owner_token, owner_headers = _login("owner_welcome@teste.com")
    _, new_headers = _login("novo_membro_welcome@teste.com")

    # 1. Cria servidor e um canal dedicado #boas-vindas
    srv_res = client.post(
        "/api/v1/discord/servers",
        json={"name": "Servidor Comunidade"},
        headers=owner_headers,
    )
    assert srv_res.status_code == 201
    srv_id = srv_res.json()["id"]

    ch_res = client.post(
        f"/api/v1/discord/servers/{srv_id}/channels",
        json={"name": "boas-vindas", "type": "TEXT"},
        headers=owner_headers,
    )
    assert ch_res.status_code == 201
    welcome_ch_id = ch_res.json()["id"]

    # 2. Ativa o sistema de boas-vindas apontando para #boas-vindas
    patch_res = client.patch(
        f"/api/v1/discord/servers/{srv_id}",
        json={
            "welcome_enabled": True,
            "welcome_channel_id": welcome_ch_id,
            "welcome_message": "Salve {user}! Seja muito bem-vindo ao {server}! 🚀",
        },
        headers=owner_headers,
    )
    assert patch_res.status_code == 200
    patched = patch_res.json()
    assert patched["welcome_enabled"] is True
    assert patched["welcome_channel_id"] == welcome_ch_id

    # 3. Gera convite
    inv_res = client.post(f"/api/v1/discord/servers/{srv_id}/invites", headers=owner_headers)
    assert inv_res.status_code == 201
    inv_code = inv_res.json()["code"]

    # 4. Dono mantém WebSocket global aberto enquanto NovoContato aceita convite
    with client.websocket_connect(f"/api/v1/discord/ws/me?token={owner_token}") as owner_ws:
        join_res = client.post(f"/api/v1/discord/invites/{inv_code}/join", headers=new_headers)
        assert join_res.status_code == 200

        ws_events = []
        # Recebe server:member_joined e unread:update da mensagem de boas-vindas
        ws_events.append(owner_ws.receive_json())
        ws_events.append(owner_ws.receive_json())

        member_event = next((e for e in ws_events if e.get("event") == "server:member_joined"), None)
        assert member_event is not None
        assert member_event["server_id"] == srv_id
        assert member_event["members_count"] == 2
        assert member_event["member"]["user_id"] == new_uid
        assert member_event["member"]["name"] == "NovoContato"
        assert member_event["member"]["is_online"] is True

    # 5. Verifica que a mensagem de boas-vindas foi publicada no canal #boas-vindas
    msgs_res = client.get(
        f"/api/v1/discord/channels/{welcome_ch_id}/messages",
        headers=owner_headers,
    )
    assert msgs_res.status_code == 200
    msgs = msgs_res.json()
    assert len(msgs) == 1
    assert msgs[0]["content"] == "Salve @NovoContato! Seja muito bem-vindo ao Servidor Comunidade! 🚀"


def test_server_welcome_disabled_and_validation_rules():
    """
    Valida que:
    1) Canal VOICE não é aceito como canal de boas-vindas (HTTP 400).
    2) Com welcome_enabled=False, nenhuma mensagem é disparada ao entrar.
    3) Se o template omitir {user}, o sistema antepõe @NomeDoUsuario automaticamente.
    """
    _ensure_user("owner_welcome2@teste.com", "Admin Dois")
    _ensure_user("membro_silencioso@teste.com", "VisitanteUm")
    _ensure_user("membro_sem_var@teste.com", "VisitanteDois")

    _, owner_headers = _login("owner_welcome2@teste.com")
    _, m1_headers = _login("membro_silencioso@teste.com")
    _, m2_headers = _login("membro_sem_var@teste.com")

    srv_res = client.post(
        "/api/v1/discord/servers",
        json={"name": "Servidor Regras"},
        headers=owner_headers,
    )
    assert srv_res.status_code == 201
    srv_data = srv_res.json()
    srv_id = srv_data["id"]
    text_ch_id = [c["id"] for c in srv_data["channels"] if c["type"] == "TEXT"][0]
    voice_ch_id = [c["id"] for c in srv_data["channels"] if c["type"] == "VOICE"][0]

    # 1. Rejeita canal VOICE como welcome_channel_id
    bad_patch = client.patch(
        f"/api/v1/discord/servers/{srv_id}",
        json={"welcome_enabled": True, "welcome_channel_id": voice_ch_id},
        headers=owner_headers,
    )
    assert bad_patch.status_code == 400

    # 2. Com welcome_enabled=False (padrão), entrar não cria mensagem
    inv_code = client.post(f"/api/v1/discord/servers/{srv_id}/invites", headers=owner_headers).json()["code"]
    assert client.post(f"/api/v1/discord/invites/{inv_code}/join", headers=m1_headers).status_code == 200

    msgs_before = client.get(f"/api/v1/discord/channels/{text_ch_id}/messages", headers=owner_headers).json()
    assert len(msgs_before) == 0

    # 3. Ativa com template sem {user} -> deve antepor @VisitanteDois
    ok_patch = client.patch(
        f"/api/v1/discord/servers/{srv_id}",
        json={
            "welcome_enabled": True,
            "welcome_channel_id": text_ch_id,
            "welcome_message": "Aproveite sua estadia no {server}!",
        },
        headers=owner_headers,
    )
    assert ok_patch.status_code == 200

    assert client.post(f"/api/v1/discord/invites/{inv_code}/join", headers=m2_headers).status_code == 200
    msgs_after = client.get(f"/api/v1/discord/channels/{text_ch_id}/messages", headers=owner_headers).json()
    assert len(msgs_after) == 1
    assert msgs_after[0]["content"] == "@VisitanteDois Aproveite sua estadia no Servidor Regras!"


def test_voice_cleanup_on_logout_and_ws_disconnect():
    """
    Valida que quando um usuário desloga (/voice-leave-all) ou encerra sua última sessão
    WebSocket (/ws/me), ele é removido imediatamente das salas de voz ativas.
    """
    uid_owner = _ensure_user("voice_clean_owner@teste.com", "Super Admin")
    uid_ary = _ensure_user("voice_clean_ary@teste.com", "Aryaraj")

    owner_token, owner_headers = _login("voice_clean_owner@teste.com")
    ary_token, ary_headers = _login("voice_clean_ary@teste.com")

    srv = client.post(
        "/api/v1/discord/servers",
        json={"name": "Servidor Call Cleanup"},
        headers=owner_headers,
    ).json()
    srv_id = srv["id"]
    voice_ch_id = [c["id"] for c in srv["channels"] if c["type"] == "VOICE"][0]

    inv_code = client.post(f"/api/v1/discord/servers/{srv_id}/invites", headers=owner_headers).json()["code"]
    client.post(f"/api/v1/discord/invites/{inv_code}/join", headers=ary_headers)

    # Ambos entram na call
    client.post(f"/api/v1/discord/channels/{voice_ch_id}/voice-join", headers=owner_headers)
    client.post(f"/api/v1/discord/channels/{voice_ch_id}/voice-join", headers=ary_headers)

    st_both = client.get(f"/api/v1/discord/channels/{voice_ch_id}/voice-status", headers=owner_headers).json()
    assert len(st_both["active_participants"]) == 2

    # Caso A: Aryaraj faz logout explícito -> POST /voice-leave-all
    leave_all = client.post("/api/v1/discord/channels/voice-leave-all", headers=ary_headers)
    assert leave_all.status_code == 200
    assert voice_ch_id in leave_all.json()["removed_channels"]

    st_after_logout = client.get(
        f"/api/v1/discord/channels/{voice_ch_id}/voice-status", headers=owner_headers
    ).json()
    assert len(st_after_logout["active_participants"]) == 1
    assert st_after_logout["active_participants"][0]["user_id"] == uid_owner

    # Caso B: Aryaraj volta para a call com /ws/me aberto e fecha a aba (desconexão do /ws/me)
    with client.websocket_connect(f"/api/v1/discord/ws/me?token={owner_token}"):
        with client.websocket_connect(f"/api/v1/discord/ws/me?token={ary_token}"):
            client.post(f"/api/v1/discord/channels/{voice_ch_id}/voice-join", headers=ary_headers)
            st_rejoined = client.get(
                f"/api/v1/discord/channels/{voice_ch_id}/voice-status", headers=owner_headers
            ).json()
            assert len(st_rejoined["active_participants"]) == 2

        # Ao sair do contexto 'with', o WebSocket de Aryaraj foi encerrado
        st_after_ws_close = client.get(
            f"/api/v1/discord/channels/{voice_ch_id}/voice-status", headers=owner_headers
        ).json()
        assert len(st_after_ws_close["active_participants"]) == 1
        assert st_after_ws_close["active_participants"][0]["user_id"] == uid_owner

        members_list = client.get(
            f"/api/v1/discord/servers/{srv_id}/members", headers=owner_headers
        ).json()
        ary_member = next(m for m in members_list if m["user_id"] == uid_ary)
        assert ary_member["is_online"] is False
