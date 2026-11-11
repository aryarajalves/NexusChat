import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook para gerenciar os participantes ativos de cada canal de voz do servidor
 * em tempo real, unificando polling REST e eventos de presença via WebSocket.
 */
export default function useDiscordVoicePresence({
  token,
  channels = [],
  activeChannelId = null,
  connectedVoiceChannelId,
  onlineUsers = [],
  currentUser,
}) {
  const [voiceChannelUsers, setVoiceChannelUsers] = useState({});
  const [voiceChannelCallTimes, setVoiceChannelCallTimes] = useState({});
  const connectedVoiceChannelIdRef = useRef(connectedVoiceChannelId);
  const currentUserRef = useRef(currentUser);
  const tokenRef = useRef(token);

  useEffect(() => {
    connectedVoiceChannelIdRef.current = connectedVoiceChannelId;
    currentUserRef.current = currentUser;
    tokenRef.current = token;
  }, [connectedVoiceChannelId, currentUser, token]);

  // Limpa presença de voz caso a aba seja fechada ou o componente desmonte durante uma call
  useEffect(() => {
    const clearAllVoiceOnExit = () => {
      if (connectedVoiceChannelIdRef.current && tokenRef.current) {
        fetch('/api/v1/discord/channels/voice-leave-all', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenRef.current}` },
          keepalive: true,
        }).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', clearAllVoiceOnExit);
    return () => {
      window.removeEventListener('beforeunload', clearAllVoiceOnExit);
    };
  }, []);



  // 2. Busca periódica do status dos canais de voz do servidor ativo
  useEffect(() => {
    if (!token || !channels || channels.length === 0) return;
    const voiceChannels = channels.filter((c) => c.type === 'VOICE' || c.type === 'STAGE');
    if (voiceChannels.length === 0) return;

    let isSubscribed = true;

    const fetchVoiceStatuses = async () => {
      try {
        const updates = {};
        const timeUpdates = {};
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
                  // Auto-healing: se estamos conectados nesta sala mas o backend reiniciou, re-registra presença
                  const currentConnectedId = connectedVoiceChannelIdRef.current;
                  const currentLoggedUser = currentUserRef.current;
                  if (
                    currentConnectedId &&
                    currentLoggedUser?.id &&
                    String(currentConnectedId) === String(vch.id) &&
                    !data.active_participants.some(
                      (u) => Number(u.user_id || u.id) === Number(currentLoggedUser.id)
                    )
                  ) {
                    fetch(`/api/v1/discord/channels/${vch.id}/voice-join`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${token}` },
                    }).catch(() => {});
                  }
                }
                if (data?.call_started_at) {
                  timeUpdates[vch.id] = data.call_started_at;
                } else if (!data?.active_participants || data.active_participants.length === 0) {
                  timeUpdates[vch.id] = null;
                }
              }
            } catch (_) {}
          })
        );
        if (isSubscribed) {
          if (Object.keys(updates).length > 0) {
            setVoiceChannelUsers((prev) => {
              const next = { ...prev };
              const currentConnectedId = connectedVoiceChannelIdRef.current;
              const currentLoggedUser = currentUserRef.current;

              Object.entries(updates).forEach(([chId, backendUsers]) => {
                const map = new Map();
                (backendUsers || []).forEach((u) => {
                  const uid = Number(u.user_id || u.id);
                  if (uid) {
                    map.set(uid, {
                      user_id: uid,
                      user_name: u.user_name || u.name,
                      avatar_url: u.avatar_url || null,
                      is_muted: u.is_muted !== undefined ? Boolean(u.is_muted) : true,
                      is_deafened: Boolean(u.is_deafened),
                      is_speaking: Boolean(u.is_speaking),
                      is_screen_sharing: Boolean(u.is_screen_sharing),
                    });
                  }
                });
                if (String(currentConnectedId) === String(chId) && currentLoggedUser) {
                  const myId = Number(currentLoggedUser.id);
                  const existing = map.get(myId) || {};
                  map.set(myId, {
                    ...existing,
                    user_id: myId,
                    user_name: currentLoggedUser.name || existing.user_name,
                    avatar_url: currentLoggedUser.avatar_url || existing.avatar_url || null,
                  });
                } else if (currentLoggedUser && currentConnectedId) {
                  map.delete(Number(currentLoggedUser.id));
                }
                next[chId] = Array.from(map.values());
              });
              return next;
            });
          }

          if (Object.keys(timeUpdates).length > 0) {
            setVoiceChannelCallTimes((prev) => {
              const next = { ...prev };
              Object.entries(timeUpdates).forEach(([chId, startTime]) => {
                if (startTime) {
                  next[chId] = startTime;
                } else if (next[chId] && (!updates[chId] || updates[chId].length === 0)) {
                  delete next[chId];
                }
              });
              return next;
            });
          }
        }
      } catch (_) {}
    };

    const performPolling = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchVoiceStatuses();
    };

    fetchVoiceStatuses();
    const interval = setInterval(performPolling, 15000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [token, channels, connectedVoiceChannelId]);

  // 3. Mantém o usuário conectado na lista de participantes da sala de voz sem poluir com usuários de texto
  // e assegura a unicidade: remove o usuário de qualquer outra sala caso tenha trocado de canal
  const currentUserId = currentUser?.id;
  const currentUserName = currentUser?.name;

  useEffect(() => {
    if (connectedVoiceChannelId && currentUserId) {
      setVoiceChannelUsers((prev) => {
        const next = { ...prev };
        const currentList = prev[connectedVoiceChannelId] || [];
        const alreadyIn = currentList.some((u) => Number(u.user_id || u.id) === Number(currentUserId));

        Object.entries(prev).forEach(([chId, uList]) => {
          if (String(chId) !== String(connectedVoiceChannelId)) {
            next[chId] = (uList || []).filter((u) => Number(u.user_id || u.id) !== Number(currentUserId));
          }
        });

        next[connectedVoiceChannelId] = alreadyIn
          ? currentList
          : [...currentList, { user_id: currentUserId, user_name: currentUserName, avatar_url: currentUser?.avatar_url || null }];

        return next;
      });

      setVoiceChannelCallTimes((prev) => {
        if (!prev[connectedVoiceChannelId]) {
          return { ...prev, [connectedVoiceChannelId]: Date.now() / 1000 };
        }
        return prev;
      });
    }
  }, [connectedVoiceChannelId, currentUserId, currentUserName, currentUser?.avatar_url]);

  // 4. Atualização instantânea via WebSocket global (voice:channel_update)
  const handleVoiceChannelUpdate = useCallback((payload) => {
    if (!payload || !payload.channel_id) return;
    const chId = payload.channel_id;
    const emptiedChannels = [];

    setVoiceChannelUsers((prev) => {
      const map = new Map();
      const incomingUserIds = new Set();
      (payload.active_participants || []).forEach((u) => {
        const uid = Number(u.user_id || u.id);
        if (uid) {
          incomingUserIds.add(uid);
          map.set(uid, {
            user_id: uid,
            user_name: u.user_name || u.name,
            avatar_url: u.avatar_url || null,
            is_muted: u.is_muted !== undefined ? Boolean(u.is_muted) : true,
            is_deafened: Boolean(u.is_deafened),
            is_speaking: Boolean(u.is_speaking),
            is_screen_sharing: Boolean(u.is_screen_sharing),
          });
        }
      });
      if (String(connectedVoiceChannelIdRef.current) === String(chId) && currentUserRef.current) {
        const myId = Number(currentUserRef.current.id);
        const existing = map.get(myId) || {};
        incomingUserIds.add(myId);
        map.set(myId, {
          ...existing,
          user_id: myId,
          user_name: currentUserRef.current.name || existing.user_name,
          avatar_url: currentUserRef.current.avatar_url || existing.avatar_url || null,
        });
      } else if (currentUserRef.current && connectedVoiceChannelIdRef.current) {
        map.delete(Number(currentUserRef.current.id));
      }

      // Garante unicidade global: qualquer participante que esteja ativo em `chId` é removido de todas as outras salas de voz
      const next = {};
      Object.entries(prev).forEach(([otherChId, uList]) => {
        if (String(otherChId) !== String(chId)) {
          const filtered = (uList || []).filter(
            (u) => !incomingUserIds.has(Number(u.user_id || u.id))
          );
          next[otherChId] = filtered;
          if ((uList || []).length > 0 && filtered.length === 0) {
            emptiedChannels.push(otherChId);
          }
        }
      });
      next[chId] = Array.from(map.values());
      return next;
    });

    setVoiceChannelCallTimes((prev) => {
      const next = { ...prev };
      emptiedChannels.forEach((emptyChId) => {
        delete next[emptyChId];
      });
      if (payload.call_started_at) {
        next[chId] = payload.call_started_at;
      } else if (payload.total_participants === 0 || (payload.active_participants && payload.active_participants.length === 0)) {
        delete next[chId];
      }
      return next;
    });
  }, []);

  // Garante que canais esvaziados nunca mantenham timer ativo
  useEffect(() => {
    setVoiceChannelCallTimes((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach((chId) => {
        if (Array.isArray(voiceChannelUsers[chId]) && voiceChannelUsers[chId].length === 0) {
          delete next[chId];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [voiceChannelUsers]);

  // 4. Remove o usuário atual do canal de voz ao desconectar e notifica o backend
  const handleDisconnectVoicePresence = useCallback((channelId) => {
    if (!channelId) return;
    if (token) {
      fetch(`/api/v1/discord/channels/${channelId}/voice-leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {});
    }
    setVoiceChannelUsers((prev) => {
      const remaining = (prev[channelId] || []).filter(
        (u) => (u.user_id || u.id) !== currentUser?.id
      );
      if (remaining.length === 0) {
        setVoiceChannelCallTimes((cPrev) => {
          const cNext = { ...cPrev };
          delete cNext[channelId];
          return cNext;
        });
      }
      return {
        ...prev,
        [channelId]: remaining,
      };
    });
  }, [token, currentUser]);

  return {
    voiceChannelUsers,
    setVoiceChannelUsers,
    voiceChannelCallTimes,
    handleVoiceChannelUpdate,
    handleDisconnectVoicePresence,
  };
}
