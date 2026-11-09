import { useEffect, useMemo, useCallback } from 'react';
import useDiscordVoicePresence from './useDiscordVoicePresence';
import useDiscordUserWS from './useDiscordUserWS';
import { playDiscordSound } from './discordSounds';

/**
 * Hook que centraliza a sincronização em tempo real do usuário (/ws/me),
 * presença nos canais de voz, atualização instantânea de perfil/avatar
 * e unificação dos estados de microfone/áudio (activeVoiceStates).
 */
export default function useDiscordVoiceAndUserSync({
  token,
  channels,
  activeChannelId,
  activeServerId,
  connectedVoiceChannelId,
  setConnectedVoiceChannelId,
  onlineUsers,
  currentUser,
  voiceStates,
  globalVoiceStates,
  isVoiceMuted,
  isVoiceDeafened,
  isVoiceSpeaking,
  setIsVoiceSpeaking,
  sendVoiceState,
  handleUnreadUpdate,
  handleDMMessageNew,
  handleSelectChannel,
  setMembers,
  setServers,
  setMessages,
  setConversations,
  addToast,
}) {
  const {
    voiceChannelUsers,
    setVoiceChannelUsers,
    voiceChannelCallTimes,
    handleVoiceChannelUpdate,
    handleDisconnectVoicePresence,
  } = useDiscordVoicePresence({
    token,
    channels,
    activeChannelId,
    connectedVoiceChannelId,
    onlineUsers,
    currentUser,
  });

  useDiscordUserWS({
    token,
    onUnreadUpdate: handleUnreadUpdate,
    onDMMessageNew: handleDMMessageNew,
    onVoiceChannelUpdate: handleVoiceChannelUpdate,
    onServerMemberJoined: (data) => {
      if (!data?.member) return;
      if (Number(data.server_id) === Number(activeServerId)) {
        setMembers((prev) =>
          prev.some((m) => m.user_id === data.member.user_id) ? prev : [...prev, data.member]
        );
      }
      if (data.members_count) {
        setServers((prev) =>
          prev.map((s) =>
            s.id === data.server_id ? { ...s, members_count: data.members_count } : s
          )
        );
      }
    },
    onUserPresence: (data) => {
      if (!data?.user_id) return;
      setMembers((prev) =>
        prev.map((m) =>
          m.user_id === data.user_id ? { ...m, is_online: Boolean(data.is_online) } : m
        )
      );
    },
    onUserProfileUpdated: (data) => {
      if (!data?.user_id) return;
      const uid = Number(data.user_id);
      const namePatch =
        data.name || data.user_name
          ? { name: data.name || data.user_name, user_name: data.name || data.user_name }
          : {};
      const avatarPatch = data.avatar_url !== undefined ? { avatar_url: data.avatar_url } : {};

      setMembers((prev) =>
        prev.map((m) =>
          Number(m.user_id || m.id) === uid ? { ...m, ...namePatch, ...avatarPatch } : m
        )
      );
      setVoiceChannelUsers((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((chId) => {
          next[chId] = (next[chId] || []).map((u) =>
            Number(u.user_id || u.id) === uid ? { ...u, ...namePatch, ...avatarPatch } : u
          );
        });
        return next;
      });
      setMessages((prev) =>
        prev.map((msg) =>
          Number(msg.author_id) === uid
            ? {
                ...msg,
                ...(namePatch.name ? { author_name: namePatch.name } : {}),
                ...(data.avatar_url !== undefined ? { author_avatar_url: data.avatar_url } : {}),
              }
            : msg
        )
      );
      setConversations((prev) =>
        prev.map((c) =>
          Number(c.other_user?.id) === uid
            ? { ...c, other_user: { ...c.other_user, ...namePatch, ...avatarPatch } }
            : c
        )
      );
    },
  });

  useEffect(() => {
    if (!currentUser?.id) return;
    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === currentUser.id || m.id === currentUser.id
          ? { ...m, avatar_url: currentUser.avatar_url, name: currentUser.name || m.name }
          : m
      )
    );
  }, [currentUser?.avatar_url, currentUser?.name, currentUser?.id, setMembers]);

  const activeVoiceStates = useMemo(() => {
    const merged = { ...voiceStates, ...globalVoiceStates };
    if (currentUser?.id) {
      const selfState = {
        is_muted: isVoiceMuted,
        is_deafened: isVoiceDeafened,
        is_speaking: Boolean(isVoiceSpeaking && !isVoiceMuted && !isVoiceDeafened),
      };
      merged[currentUser.id] = { ...(merged[currentUser.id] || {}), ...selfState };
      merged[Number(currentUser.id)] = { ...(merged[Number(currentUser.id)] || {}), ...selfState };
      merged[String(currentUser.id)] = { ...(merged[String(currentUser.id)] || {}), ...selfState };
    }
    return merged;
  }, [voiceStates, globalVoiceStates, currentUser?.id, isVoiceMuted, isVoiceDeafened, isVoiceSpeaking]);

  useEffect(() => {
    if (connectedVoiceChannelId && sendVoiceState) {
      sendVoiceState({ is_muted: isVoiceMuted, is_deafened: isVoiceDeafened, is_speaking: false });
    }
  }, [isVoiceMuted, isVoiceDeafened, connectedVoiceChannelId, sendVoiceState]);

  const handleDisconnectVoice = useCallback(() => {
    handleDisconnectVoicePresence(connectedVoiceChannelId);
    setConnectedVoiceChannelId(null);
    setIsVoiceSpeaking(false);
    playDiscordSound('voice_leave');
    if (addToast) addToast('Você saiu do canal de voz.', 'info');
    const activeCh = (channels || []).find((c) => c.id === activeChannelId);
    if (activeCh?.type === 'VOICE') {
      const textCh = (channels || []).find((c) => c.type === 'TEXT');
      if (textCh && handleSelectChannel) handleSelectChannel(textCh.id);
    }
  }, [
    handleDisconnectVoicePresence,
    connectedVoiceChannelId,
    setConnectedVoiceChannelId,
    setIsVoiceSpeaking,
    addToast,
    channels,
    activeChannelId,
    handleSelectChannel,
  ]);

  return {
    voiceChannelUsers,
    setVoiceChannelUsers,
    voiceChannelCallTimes,
    handleVoiceChannelUpdate,
    handleDisconnectVoicePresence,
    activeVoiceStates,
    handleDisconnectVoice,
  };
}
