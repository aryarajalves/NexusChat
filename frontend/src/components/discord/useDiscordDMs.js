import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';

export function useDiscordDMs({ token, currentUser, activeServerId, onMessagePin, onUnreadUpdate }) {
  const [conversations, setConversations] = useState([]);
  const [activeDMId, setActiveDMId] = useState(() => {
    const saved = localStorage.getItem('discord_active_dm_id');
    if (!saved) return null;
    const num = parseInt(saved, 10);
    return isNaN(num) ? null : num;
  });
  const [dmTypingUsers, setDmTypingUsers] = useState([]);
  const [dmConnectionStatus, setDmConnectionStatus] = useState('connected');
  const dmWsRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const onMessagePinRef = useRef(onMessagePin);
  const onUnreadUpdateRef = useRef(onUnreadUpdate);
  const { addToast } = useToast();

  useEffect(() => {
    onMessagePinRef.current = onMessagePin;
    onUnreadUpdateRef.current = onUnreadUpdate;
  }, [onMessagePin, onUnreadUpdate]);

  // 1. Carrega todas as conversas diretas
  const loadConversations = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/v1/discord/dms/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
        if (data.length > 0) {
          const savedDM = localStorage.getItem('discord_active_dm_id');
          const parsedDMId = savedDM ? parseInt(savedDM, 10) : null;
          const matchingDM = parsedDMId ? data.find((c) => c.id === parsedDMId) : null;
          if (matchingDM) {
            setActiveDMId(matchingDM.id);
          } else if (!activeDMId || !data.some((c) => c.id === activeDMId)) {
            setActiveDMId(data[0].id);
            localStorage.setItem('discord_active_dm_id', String(data[0].id));
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar conversas diretas:', err);
    }
  }, [token, activeDMId]);

  useEffect(() => {
    if (activeServerId === null) {
      loadConversations();
    }
  }, [activeServerId, loadConversations]);

  // 2. Inicia ou seleciona conversa com outro usuário
  const startOrSelectDM = useCallback(async (targetUserId) => {
    try {
      const res = await fetch('/api/v1/discord/dms/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      if (res.ok) {
        const conv = await res.json();
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === conv.id);
          return exists ? prev : [conv, ...prev];
        });
        setActiveDMId(conv.id);
        localStorage.setItem('discord_active_dm_id', String(conv.id));
        return conv;
      } else {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao iniciar conversa.');
      }
    } catch (err) {
      addToast(err.message || 'Erro ao abrir conversa direta.', 'error');
      throw err;
    }
  }, [token, addToast]);

  // 3. WebSocket dedicado para a conversa de DM ativa
  useEffect(() => {
    if (activeServerId !== null || !activeDMId || !token) {
      if (dmWsRef.current) {
        dmWsRef.current.close();
        dmWsRef.current = null;
      }
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/discord/dms/ws/${activeDMId}?token=${encodeURIComponent(token)}`;

    setDmConnectionStatus('connecting');
    const ws = new WebSocket(wsUrl);
    dmWsRef.current = ws;

    ws.onopen = () => {
      setDmConnectionStatus('connected');
    };

    ws.onclose = () => {
      setDmConnectionStatus('disconnected');
    };

    ws.onerror = () => {
      setDmConnectionStatus('disconnected');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'user_typing') {
          const { user_name, is_typing, user_id } = payload.data;
          if (user_id === currentUser?.id) return;

          setDmTypingUsers((prev) => {
            if (is_typing) {
              return prev.includes(user_name) ? prev : [...prev, user_name];
            } else {
              return prev.filter((name) => name !== user_name);
            }
          });

          if (is_typing) {
            setTimeout(() => {
              setDmTypingUsers((prev) => prev.filter((name) => name !== user_name));
            }, 3000);
          }
        } else if (payload.type === 'message_pin' || payload.event === 'message:pin') {
          const pinData = payload.data || payload.message;
          if (onMessagePinRef.current && pinData) {
            onMessagePinRef.current(pinData);
          }
        } else if (payload.event === 'unread:update' || payload.type === 'unread_update') {
          if (onUnreadUpdateRef.current) {
            onUnreadUpdateRef.current(payload);
          }
        }
      } catch (err) {
        console.error('Erro ao processar mensagem do WebSocket DM:', err);
      }
    };

    return () => {
      ws.close();
      dmWsRef.current = null;
    };
  }, [activeServerId, activeDMId, token, currentUser?.id]);

  // 4. Envia evento de digitação
  const sendDMTyping = useCallback(() => {
    if (dmWsRef.current && dmWsRef.current.readyState === WebSocket.OPEN) {
      dmWsRef.current.send(JSON.stringify({ type: 'typing', is_typing: true }));

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (dmWsRef.current && dmWsRef.current.readyState === WebSocket.OPEN) {
          dmWsRef.current.send(JSON.stringify({ type: 'typing', is_typing: false }));
        }
      }, 2500);
    }
  }, []);

  return {
    conversations,
    activeDMId,
    setActiveDMId,
    loadConversations,
    startOrSelectDM,
    dmTypingUsers,
    dmConnectionStatus,
    sendDMTyping,
  };
}
