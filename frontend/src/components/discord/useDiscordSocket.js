import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook customizado para gerenciar a conexão WebSocket em tempo real de um canal do Discord.
 * Trata reconexão resiliente, presença de usuários, digitação e sincronização de voz.
 */
export function useDiscordSocket({
  channelId,
  token,
  onMessageNew,
  onMessageDelete,
  onMessageEdit,
  onMessageReaction,
  onMessagePin,
  onUnreadUpdate,
}) {
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'connected' | 'connecting' | 'disconnected'
  const [typingUsers, setTypingUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [voiceStates, setVoiceStates] = useState({});

  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const intentionalCloseRef = useRef(false);
  const typingTimeoutsRef = useRef({});
  const isMountedRef = useRef(true);

  // Armazena callbacks em refs para evitar recriação do connect em cada re-render
  const onMessageNewRef = useRef(onMessageNew);
  const onMessageDeleteRef = useRef(onMessageDelete);
  const onMessageEditRef = useRef(onMessageEdit);
  const onMessageReactionRef = useRef(onMessageReaction);
  const onMessagePinRef = useRef(onMessagePin);
  const onUnreadUpdateRef = useRef(onUnreadUpdate);

  useEffect(() => {
    onMessageNewRef.current = onMessageNew;
    onMessageDeleteRef.current = onMessageDelete;
    onMessageEditRef.current = onMessageEdit;
    onMessageReactionRef.current = onMessageReaction;
    onMessagePinRef.current = onMessagePin;
    onUnreadUpdateRef.current = onUnreadUpdate;
  }, [onMessageNew, onMessageDelete, onMessageEdit, onMessageReaction, onMessagePin, onUnreadUpdate]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

  const connect = useCallback(() => {
    if (!channelId || !token) {
      setConnectionStatus('disconnected');
      return;
    }

    // Limpa estado e timeouts anteriores
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    intentionalCloseRef.current = false;

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        // Ignora erro de fechamento prévio
      }
      socketRef.current = null;
    }

    setConnectionStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/discord/ws/channels/${channelId}?token=${token}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (isMountedRef.current) {
          setConnectionStatus('connected');
          // Heartbeat periódico (ping a cada 25s para manter a conexão aberta no Nginx e Traefik)
          if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ event: 'ping' }));
              } catch {
                // Falha silenciosa no envio do heartbeat
              }
            }
          }, 25000);
        }
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (!payload || !payload.event) return;

          // Ignora respostas de heartbeat pong
          if (payload.event === 'pong') return;

          switch (payload.event) {
            case 'message:new':
              if (onMessageNewRef.current && payload.message) {
                onMessageNewRef.current(payload.message);
              }
              break;

            case 'message:delete':
              if (onMessageDeleteRef.current && payload.message_id) {
                onMessageDeleteRef.current(payload.message_id);
              }
              break;

            case 'message:edit':
              if (onMessageEditRef.current && payload.message) {
                onMessageEditRef.current(payload.message);
              }
              break;

            case 'message:reaction':
              if (onMessageReactionRef.current && payload.message_id) {
                onMessageReactionRef.current(payload);
              }
              break;

            case 'message:pin':
              if (onMessagePinRef.current && (payload.message || payload.data)) {
                onMessagePinRef.current(payload.message || payload.data);
              }
              break;

            case 'unread:update':
              if (onUnreadUpdateRef.current) {
                onUnreadUpdateRef.current(payload);
              }
              break;

            case 'presence:join':
            case 'presence:leave':
              if (payload.online_users) {
                setOnlineUsers(payload.online_users);
              }
              break;

            case 'user:typing':
              if (payload.user_name) {
                const name = payload.user_name;
                setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));

                if (typingTimeoutsRef.current[name]) {
                  clearTimeout(typingTimeoutsRef.current[name]);
                }
                typingTimeoutsRef.current[name] = setTimeout(() => {
                  if (isMountedRef.current) {
                    setTypingUsers((prev) => prev.filter((u) => u !== name));
                  }
                  delete typingTimeoutsRef.current[name];
                }, 3000);
              }
              break;

            case 'voice:state':
              if (payload.user_id) {
                setVoiceStates((prev) => ({
                  ...prev,
                  [payload.user_id]: {
                    is_muted: payload.is_muted,
                    is_deafened: payload.is_deafened,
                    is_speaking: payload.is_speaking,
                  },
                }));
              }
              break;

            default:
              break;
          }
        } catch (e) {
          console.error('[WebSocket] Erro ao processar payload:', e);
        }
      };

      const handleDisconnection = () => {
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

        if (isMountedRef.current) {
          if (!intentionalCloseRef.current) {
            // Auto-reconexão resiliente a cada 3.5s
            setConnectionStatus('connecting');
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMountedRef.current && channelId && token && !intentionalCloseRef.current) {
                connect();
              }
            }, 3500);
          } else {
            setConnectionStatus('disconnected');
          }
        }
      };

      ws.onclose = handleDisconnection;
      ws.onerror = (err) => {
        console.warn('[WebSocket] Erro na conexão:', err);
        handleDisconnection();
      };
    } catch (err) {
      console.warn('[WebSocket] Falha ao inicializar socket:', err);
      if (isMountedRef.current) {
        setConnectionStatus('connecting');
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current && channelId && token && !intentionalCloseRef.current) {
            connect();
          }
        }, 3500);
      }
    }
  }, [channelId, token]);

  useEffect(() => {
    connect();

    return () => {
      intentionalCloseRef.current = true;
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connect]);

  // Envia mensagem via WebSocket se aberto
  const sendMessage = useCallback((msgData) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          event: 'message:send',
          ...msgData,
        })
      );
      return true;
    }
    return false;
  }, []);

  // Envia evento de digitação
  const sendTyping = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ event: 'user:typing' }));
    }
  }, []);

  // Envia estado de voz (mutado, ensurdecido, falando)
  const sendVoiceState = useCallback((state) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          event: 'voice:state',
          ...state,
        })
      );
    }
  }, []);

  return {
    connectionStatus,
    typingUsers,
    onlineUsers,
    voiceStates,
    sendMessage,
    sendTyping,
    sendVoiceState,
    reconnect: connect,
  };
}
