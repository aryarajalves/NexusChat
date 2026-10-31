import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para gerenciar os participantes ativos de cada canal de voz do servidor
 * em tempo real, combinando polling REST e eventos de presença via WebSocket.
 */
export default function useDiscordVoicePresence({
  token,
  channels = [],
  connectedVoiceChannelId,
  onlineUsers = [],
  currentUser,
}) {
  const [voiceChannelUsers, setVoiceChannelUsers] = useState({});

  // 1. Busca periódica do status dos canais de voz do servidor ativo
  useEffect(() => {
    if (!token || !channels || channels.length === 0) return;
    const voiceChannels = channels.filter((c) => c.type === 'VOICE');
    if (voiceChannels.length === 0) return;

    let isSubscribed = true;

    const fetchVoiceStatuses = async () => {
      try {
        const updates = {};
        await Promise.all(
          voiceChannels.map(async (vch) => {
            try {
              const res = await fetch(`/api/v1/discord/channels/${vch.id}/voice-status`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                const data = await res.json();
                if (data?.active_participants) {
                  updates[vch.id] = data.active_participants;
                }
              }
            } catch (_) {}
          })
        );
        if (isSubscribed && Object.keys(updates).length > 0) {
          setVoiceChannelUsers((prev) => ({
            ...prev,
            ...updates,
          }));
        }
      } catch (_) {}
    };

    fetchVoiceStatuses();
    const interval = setInterval(fetchVoiceStatuses, 3000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [token, channels]);

  // 2. Sincroniza participantes do canal de voz ativo com os usuários do socket em tempo real
  useEffect(() => {
    if (connectedVoiceChannelId) {
      setVoiceChannelUsers((prev) => {
        const currentList = prev[connectedVoiceChannelId] || [];
        const source = onlineUsers && onlineUsers.length > 0 ? onlineUsers : currentList;
        const merged = [...source];
        if (currentUser && !merged.some((u) => (u.user_id || u.id) === currentUser.id)) {
          merged.push({ user_id: currentUser.id, user_name: currentUser.name });
        }
        return {
          ...prev,
          [connectedVoiceChannelId]: merged,
        };
      });
    }
  }, [connectedVoiceChannelId, onlineUsers, currentUser]);

  // 3. Remove o usuário atual do canal de voz ao desconectar
  const handleDisconnectVoicePresence = useCallback((channelId) => {
    if (!channelId) return;
    setVoiceChannelUsers((prev) => {
      const remaining = (prev[channelId] || []).filter(
        (u) => (u.user_id || u.id) !== currentUser?.id
      );
      return {
        ...prev,
        [channelId]: remaining,
      };
    });
  }, [currentUser]);

  return {
    voiceChannelUsers,
    setVoiceChannelUsers,
    handleDisconnectVoicePresence,
  };
}
