import { useEffect, useRef } from 'react';

/**
 * Hook para conexão WebSocket persistente do usuário (/api/v1/discord/ws/me).
 * Garante entrega em tempo real de notificações de mensagens não lidas,
 * badges nos servidores e contatos, e sincronização contínua mesmo alternando abas.
 */
export default function useDiscordUserWS({
  token,
  onUnreadUpdate,
  onDMMessageNew,
  onServerMemberJoined,
  onVoiceChannelUpdate,
  onUserPresence,
  onUserProfileUpdated,
  onSessionTerminated,
}) {
  const wsRef = useRef(null);
  const heartbeatRef = useRef(null);
  const reconnectRef = useRef(null);
  const onUnreadUpdateRef = useRef(onUnreadUpdate);
  const onDMMessageNewRef = useRef(onDMMessageNew);
  const onServerMemberJoinedRef = useRef(onServerMemberJoined);
  const onVoiceChannelUpdateRef = useRef(onVoiceChannelUpdate);
  const onUserPresenceRef = useRef(onUserPresence);
  const onUserProfileUpdatedRef = useRef(onUserProfileUpdated);
  const onSessionTerminatedRef = useRef(onSessionTerminated);
  const intentionalCloseRef = useRef(false);

  useEffect(() => {
    onSessionTerminatedRef.current = onSessionTerminated;
  }, [onSessionTerminated]);

  useEffect(() => {
    onUnreadUpdateRef.current = onUnreadUpdate;
  }, [onUnreadUpdate]);

  useEffect(() => {
    onDMMessageNewRef.current = onDMMessageNew;
  }, [onDMMessageNew]);

  useEffect(() => {
    onServerMemberJoinedRef.current = onServerMemberJoined;
  }, [onServerMemberJoined]);

  useEffect(() => {
    onVoiceChannelUpdateRef.current = onVoiceChannelUpdate;
  }, [onVoiceChannelUpdate]);

  useEffect(() => {
    onUserPresenceRef.current = onUserPresence;
  }, [onUserPresence]);

  useEffect(() => {
    onUserProfileUpdatedRef.current = onUserProfileUpdated;
  }, [onUserProfileUpdated]);

  useEffect(() => {
    if (!token) {
      intentionalCloseRef.current = true;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    intentionalCloseRef.current = false;
    let ws = null;

    const connectUserWS = () => {
      if (intentionalCloseRef.current) return;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      let sessionId = '';
      if (typeof sessionStorage !== 'undefined') {
        sessionId = sessionStorage.getItem('nexus_tab_session_id') || sessionStorage.getItem('current_session_id') || '';
        if (!sessionId) {
          sessionId = 'tab_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
          sessionStorage.setItem('nexus_tab_session_id', sessionId);
          sessionStorage.setItem('current_session_id', sessionId);
        }
      }
      const sessionQuery = sessionId ? `&session_id=${encodeURIComponent(sessionId)}` : '';
      const wsUrl = `${protocol}//${host}/api/v1/discord/ws/me?token=${encodeURIComponent(token)}${sessionQuery}`;

      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (heartbeatRef.current) clearInterval(heartbeatRef.current);
          heartbeatRef.current = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ type: 'ping', event: 'ping' }));
              } catch (_) {}
            }
          }, 8000);
        };

        const handleDisconnect = (ev) => {
          if (heartbeatRef.current) clearInterval(heartbeatRef.current);
          if (ev?.code === 4001) {
            intentionalCloseRef.current = true;
            if (onSessionTerminatedRef.current) {
              onSessionTerminatedRef.current('Sua conta foi conectada em outra aba ou dispositivo.');
            }
            return;
          }
          if (!intentionalCloseRef.current) {
            if (reconnectRef.current) clearTimeout(reconnectRef.current);
            reconnectRef.current = setTimeout(connectUserWS, 3000);
          }
        };

        ws.onclose = handleDisconnect;
        ws.onerror = handleDisconnect;

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'pong' || payload.event === 'pong') return;

            if (payload.event === 'session:terminated') {
              intentionalCloseRef.current = true;
              if (onSessionTerminatedRef.current) {
                onSessionTerminatedRef.current(payload.detail || 'Sua conta foi conectada em outra aba ou dispositivo.');
              }
              return;
            }

            if (payload.event === 'unread:update' || payload.type === 'unread_update') {
              if (onUnreadUpdateRef.current) {
                onUnreadUpdateRef.current(payload);
              }
              if (payload.message && onDMMessageNewRef.current) {
                onDMMessageNewRef.current(payload.message);
              }
            } else if (payload.event === 'server:member_joined' && onServerMemberJoinedRef.current) {
              onServerMemberJoinedRef.current(payload);
            } else if (payload.event === 'voice:channel_update' && onVoiceChannelUpdateRef.current) {
              onVoiceChannelUpdateRef.current(payload);
            } else if (payload.event === 'user:presence' && onUserPresenceRef.current) {
              onUserPresenceRef.current(payload);
            } else if (payload.event === 'user:profile_updated' && onUserProfileUpdatedRef.current) {
              onUserProfileUpdatedRef.current(payload);
            }
          } catch (_) {}
        };
      } catch (_) {
        if (reconnectRef.current) clearTimeout(reconnectRef.current);
        reconnectRef.current = setTimeout(connectUserWS, 3000);
      }
    };

    connectUserWS();

    return () => {
      intentionalCloseRef.current = true;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token]);

  return { ws: wsRef.current };
}
