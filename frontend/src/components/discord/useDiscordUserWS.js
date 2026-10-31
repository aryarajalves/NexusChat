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
}) {
  const wsRef = useRef(null);
  const heartbeatRef = useRef(null);
  const reconnectRef = useRef(null);
  const onUnreadUpdateRef = useRef(onUnreadUpdate);
  const onDMMessageNewRef = useRef(onDMMessageNew);
  const intentionalCloseRef = useRef(false);

  useEffect(() => {
    onUnreadUpdateRef.current = onUnreadUpdate;
  }, [onUnreadUpdate]);

  useEffect(() => {
    onDMMessageNewRef.current = onDMMessageNew;
  }, [onDMMessageNew]);

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
      const wsUrl = `${protocol}//${host}/api/v1/discord/ws/me?token=${encodeURIComponent(token)}`;

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
          }, 25000);
        };

        const handleDisconnect = () => {
          if (heartbeatRef.current) clearInterval(heartbeatRef.current);
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

            if (payload.event === 'unread:update' || payload.type === 'unread_update') {
              if (onUnreadUpdateRef.current) {
                onUnreadUpdateRef.current(payload);
              }
              if (payload.message && onDMMessageNewRef.current) {
                onDMMessageNewRef.current(payload.message);
              }
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
