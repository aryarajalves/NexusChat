import { useState, useEffect, useCallback } from 'react';
import { playDiscordSound } from './discordSounds';

/**
 * Gerencia os estados de mensagens, fixados (pins), contadores de não lidas (unreads)
 * e callbacks de atualização em tempo real compartilhados entre Canais e DMs.
 */
export function useDiscordUnreadCallbacks({
  activeServerId,
  activeChannelId,
  activeDMIdRef,
}) {
  const [messages, setMessages] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [loadingPins, setLoadingPins] = useState(false);
  const [unreads, setUnreads] = useState({
    channels: {},
    servers: {},
    dms: {},
    total_dms: 0,
  });

  const handlePinUpdate = useCallback((updatedMsg) => {
    if (!updatedMsg) return;
    const msgObj = updatedMsg.message || updatedMsg;
    setMessages((prev) =>
      prev.map((m) => (m.id === msgObj.id ? { ...m, is_pinned: msgObj.is_pinned } : m))
    );
    setPinnedMessages((prev) =>
      msgObj.is_pinned
        ? [msgObj, ...prev.filter((p) => p.id !== msgObj.id)]
        : prev.filter((p) => p.id !== msgObj.id)
    );
  }, []);

  const handleUnreadUpdate = useCallback(
    (data) => {
      if (!data) return;
      playDiscordSound(data.is_mention ? 'mention' : 'message');
      if (data.type === 'channel') {
        const chId = String(data.channel_id);
        const srvId = String(data.server_id);
        if (activeServerId === data.server_id && activeChannelId === data.channel_id) return;
        setUnreads((prev) => ({
          ...prev,
          channels: { ...prev.channels, [chId]: (prev.channels?.[chId] || 0) + 1 },
          servers: { ...prev.servers, [srvId]: (prev.servers?.[srvId] || 0) + 1 },
        }));
      } else if (data.type === 'dm') {
        const dmId = String(data.conversation_id);
        if (activeServerId === null && activeDMIdRef?.current === data.conversation_id) return;
        setUnreads((prev) => ({
          ...prev,
          dms: { ...prev.dms, [dmId]: (prev.dms?.[dmId] || 0) + 1 },
          total_dms: (prev.total_dms || 0) + 1,
        }));
      }
    },
    [activeServerId, activeChannelId, activeDMIdRef]
  );

  return {
    messages,
    setMessages,
    pinnedMessages,
    setPinnedMessages,
    loadingPins,
    setLoadingPins,
    unreads,
    setUnreads,
    handlePinUpdate,
    handleUnreadUpdate,
  };
}

/**
 * Efeitos de carregamento de histórico de mensagens, mensagens fixadas,
 * contadores iniciais de não lidas e confirmação automática de leitura (ACK).
 */
export function useDiscordFeedEffects({
  token,
  activeServerId,
  activeChannelId,
  activeDMId,
  channels = [],
  unreads,
  setUnreads,
  setMessages,
  setPinnedMessages,
  setLoadingPins,
}) {
  const activeChannelType = channels.find((c) => c.id === activeChannelId)?.type;

  // 1. Carrega mensagens (seja de canal ou de DM)
  useEffect(() => {
    if (activeServerId === null) {
      if (!activeDMId) {
        setMessages([]);
        return;
      }
      fetch(`/api/v1/discord/dms/conversations/${activeDMId}/messages?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setMessages(d))
        .catch(() => {});
      return;
    }
    if (!activeChannelId) {
      setMessages([]);
      return;
    }
    if (activeChannelType === 'VOICE') {
      setMessages([]);
      return;
    }
    fetch(`/api/v1/discord/channels/${activeChannelId}/messages?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMessages(d))
      .catch(() => {});
  }, [activeServerId, activeDMId, activeChannelId, activeChannelType, token, setMessages]);

  // 2. Carrega mensagens fixadas do canal ou DM ativa
  useEffect(() => {
    const isDM = activeServerId === null;
    const targetId = isDM ? activeDMId : activeChannelId;
    if (!targetId) {
      setPinnedMessages([]);
      return;
    }
    const endpoint = isDM
      ? `/api/v1/discord/dms/conversations/${activeDMId}/pins`
      : `/api/v1/discord/channels/${activeChannelId}/pins`;
    setLoadingPins(true);
    fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((pins) => setPinnedMessages(pins))
      .catch(() => setPinnedMessages([]))
      .finally(() => setLoadingPins(false));
  }, [activeServerId, activeDMId, activeChannelId, token, setPinnedMessages, setLoadingPins]);

  // 3. Carrega contadores iniciais de mensagens não lidas
  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/discord/unreads', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setUnreads({
            channels: d.channels || {},
            servers: d.servers || {},
            dms: d.dms || {},
            total_dms: d.total_dms || 0,
          });
        }
      })
      .catch(() => {});
  }, [token, setUnreads]);

  // 4. Marca canal ativo como lido e zera badges correspondentes
  useEffect(() => {
    const chId = String(activeChannelId);
    if (activeServerId !== null && activeChannelId && (unreads?.channels?.[chId] || 0) > 0) {
      const srvId = String(activeServerId);
      const count = unreads.channels[chId];
      setUnreads((prev) => ({
        ...prev,
        channels: { ...prev.channels, [chId]: 0 },
        servers: {
          ...prev.servers,
          [srvId]: Math.max(0, (prev.servers?.[srvId] || 0) - count),
        },
      }));
      fetch(`/api/v1/discord/channels/${activeChannelId}/ack`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }, [activeServerId, activeChannelId, unreads?.channels, token, setUnreads]);

  // 5. Marca conversa direta (DM) ativa como lida e zera badges correspondentes
  useEffect(() => {
    const dmId = String(activeDMId);
    if (activeServerId === null && activeDMId && (unreads?.dms?.[dmId] || 0) > 0) {
      const count = unreads.dms[dmId];
      setUnreads((prev) => ({
        ...prev,
        dms: { ...prev.dms, [dmId]: 0 },
        total_dms: Math.max(0, (prev.total_dms || 0) - count),
      }));
      fetch(`/api/v1/discord/dms/conversations/${activeDMId}/ack`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }, [activeServerId, activeDMId, unreads?.dms, token, setUnreads]);
}
