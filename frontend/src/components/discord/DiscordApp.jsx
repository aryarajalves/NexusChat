import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import ServerListBar from './ServerListBar';
import ChannelSidebar from './ChannelSidebar';
import DMSidebar from './DMSidebar';
import ChatArea from './ChatArea';
import VoiceChannelArea from './VoiceChannelArea';
import MemberListSidebar from './MemberListSidebar';
import DiscordModalsLayer, { useDiscordModalsState } from './DiscordModalsLayer';
import { useDiscordSocket } from './useDiscordSocket';
import { useDiscordActions } from './useDiscordActions';
import { useDiscordDMs } from './useDiscordDMs';
import { useDiscordNavigation } from './useDiscordNavigation';
import { useDiscordUnreadCallbacks, useDiscordFeedEffects } from './useDiscordMessagesAndUnreads';
import useDiscordUnifiedChatActions from './useDiscordUnifiedChatActions';
import useDiscordVoicePresence from './useDiscordVoicePresence';
import useDiscordUserWS from './useDiscordUserWS';
import useDiscordGlobalVoiceState from './useDiscordGlobalVoiceState';
import { useToast } from '../../context/ToastContext';
import { playDiscordSound } from './discordSounds';

export default function DiscordApp({
  currentUser,
  onUserUpdated,
  onToggleAppSidebar,
  isAppSidebarHidden,
  onLogout,
}) {
  const [servers, setServers] = useState([]), [channels, setChannels] = useState([]), [members, setMembers] = useState([]);
  const [connectedVoiceChannelId, setConnectedVoiceChannelId] = useState(null);
  const [showMembers, setShowMembers] = useState(true), [isMobileNavOpen, setIsMobileNavOpen] = useState(false), [isMobileMembersOpen, setIsMobileMembersOpen] = useState(false);
  const [loading] = useState(false);

  const modals = useDiscordModalsState();
  const { addToast } = useToast();
  const token = localStorage.getItem('auth_token');
  const activeDMIdRef = useRef(null);

  const {
    isVoiceMuted, setIsVoiceMuted, isVoiceDeafened, setIsVoiceDeafened,
    voiceStates: globalVoiceStates, soundMuted, handleToggleSoundMute,
    handleToggleVoiceMute, handleToggleVoiceDeafen, handleRoomVoiceStatesUpdate,
  } = useDiscordGlobalVoiceState({ addToast });

  // 1. Navegação com persistência em localStorage
  const {
    activeServerId,
    setActiveServerId,
    activeChannelId,
    setActiveChannelId,
    handleSelectServer,
    handleSelectChannel,
  } = useDiscordNavigation({ token, servers, setServers, channels, setChannels, setMembers });

  // 2. Estado de mensagens, fixados e contadores de não lidas
  const {
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
  } = useDiscordUnreadCallbacks({ activeServerId, activeChannelId, activeDMIdRef });

  const handleMessageEdit = useCallback((m) => setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x))), [setMessages]);
  const handleMessageDelete = useCallback((id) => setMessages((prev) => prev.filter((x) => x.id !== id)), [setMessages]);
  const handleMessageReaction = useCallback((d) => setMessages((prev) => prev.map((x) => (x.id === d.message_id ? { ...x, reactions: d.reactions } : x))), [setMessages]);
  const handleThreadCreated = useCallback((p) => { if (p?.message_id) setMessages((prev) => prev.map((m) => m.id === p.message_id ? { ...m, thread: p.thread } : m)); }, [setMessages]);
  const handleThreadMessageNew = useCallback((p) => {
    const rId = p?.root_message_id || p;
    const sum = p?.thread_summary || arguments[1];
    if (rId) setMessages((prev) => prev.map((m) => m.id === rId ? { ...m, thread: sum } : m));
  }, [setMessages]);

  // 3. Mensagens Diretas (DMs) em tempo real
  const handleDMMessageNew = useCallback(
    (newMsg) => {
      if (!newMsg) return;
      setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
      if (newMsg?.author_id !== currentUser?.id) playDiscordSound('message');
    },
    [currentUser, setMessages]
  );

  const {
    conversations,
    activeDMId,
    setActiveDMId,
    loadConversations,
    startOrSelectDM,
    dmTypingUsers,
    dmConnectionStatus,
    sendDMTyping,
  } = useDiscordDMs({
    token,
    currentUser,
    activeServerId,
    onMessageNew: handleDMMessageNew,
    onMessageEdit: handleMessageEdit,
    onMessageDelete: handleMessageDelete,
    onMessageReaction: handleMessageReaction,
    onMessagePin: handlePinUpdate,
    onUnreadUpdate: handleUnreadUpdate,
    onThreadCreated: handleThreadCreated,
    onThreadMessageNew: handleThreadMessageNew,
  });

  activeDMIdRef.current = activeDMId;

  // 4. Sincronização de histórico, fixados e ACK de leitura
  const activeTextChannel =
    channels.find((c) => c.id === activeChannelId && c.type === 'TEXT') ||
    channels.find((c) => c.type === 'TEXT') ||
    channels.find((c) => c.id === activeChannelId) ||
    null;

  useDiscordFeedEffects({
    token,
    activeServerId,
    activeChannelId: activeServerId !== null ? (activeTextChannel?.id || activeChannelId) : null,
    activeDMId,
    channels,
    unreads,
    setUnreads,
    setMessages,
    setPinnedMessages,
    setLoadingPins,
  });

  // 5. WebSocket de Canal de Texto Ativo do Servidor
  const {
    connectionStatus,
    typingUsers,
    onlineUsers,
    voiceStates,
    sendMessage,
    sendTyping,
    sendVoiceState,
  } = useDiscordSocket({
    channelId: activeServerId !== null ? activeTextChannel?.id : null,
    token,
    onMessageNew: (newMsg) => {
      setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
      if (newMsg?.author_id !== currentUser?.id) {
        const isMention = Boolean(
          newMsg?.content &&
            (/@everyone\b/i.test(newMsg.content) ||
              /@here\b/i.test(newMsg.content) ||
              (currentUser?.name && new RegExp(`@${currentUser.name}\\b`, 'i').test(newMsg.content)))
        );
        playDiscordSound(isMention ? 'mention' : 'message');
      }
    },
    onMessageDelete: handleMessageDelete,
    onMessageEdit: handleMessageEdit,
    onMessageReaction: handleMessageReaction,
    onMessagePin: handlePinUpdate,
    onUnreadUpdate: handleUnreadUpdate,
    onThreadCreated: handleThreadCreated,
    onThreadMessageNew: handleThreadMessageNew,
    onMemberRemoved: (userId) => setMembers((prev) => prev.filter((m) => m.user_id !== userId && m.id !== userId)),
    onServerKicked: (payload) => {
      if (payload.server_id === activeServerId) {
        addToast(`Você foi removido do servidor "${payload.server_name}".`, 'info');
        setActiveServerId(null);
      }
    },
  });

  // 6. Ações REST de Servidor e Unificação Canal/DM
  const {
    handleSendMessage, handleEditMessage, handleToggleReaction, handleForwardMessage,
    handleUploadAttachment, handleConfirmDeleteMessage, handleCreateServer, handleCreateChannel,
    handleUpdateChannel, handleDeleteChannel, handleCreateInvite, handleTogglePin, handleDeleteServer,
  } = useDiscordActions({
    token, activeServerId, activeChannelId, setMessages, setServers,
    setActiveServerId, setChannels, setActiveChannelId, sendMessage,
  });

  const {
    handleGeneralUploadAttachment, handleGeneralSendMessage, handleGeneralEditMessage,
    handleGeneralToggleReaction, handleGeneralConfirmDelete, handleGeneralTogglePin,
  } = useDiscordUnifiedChatActions({
    token, activeServerId, activeChannelId, activeDMId, setMessages, loadConversations,
    addToast, handleUploadAttachment, handleSendMessage, handleEditMessage,
    handleToggleReaction, handleConfirmDeleteMessage, handleTogglePin, handlePinUpdate,
  });

  // 7. Presença de Canais de Voz e WebSocket Global do Usuário (/ws/me)
  const { voiceChannelUsers, voiceChannelCallTimes, handleVoiceChannelUpdate, handleDisconnectVoicePresence } =
    useDiscordVoicePresence({
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
          prev.map((s) => (s.id === data.server_id ? { ...s, members_count: data.members_count } : s))
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
  });

  const activeServer = servers.find((s) => s.id === activeServerId);
  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const connectedVoiceChannel = channels.find((c) => c.id === connectedVoiceChannelId);
  const activeDM = conversations.find((c) => c.id === activeDMId);
  const activeDMChannel = activeDM
    ? { id: activeDM.id, name: activeDM.other_user?.name || 'Amigo', is_dm: true, type: 'TEXT' }
    : null;

  const currentChatChannel =
    activeServerId === null ? activeDMChannel : activeChannel?.type === 'TEXT' ? activeChannel : activeTextChannel;
  const currentMember = members.find((m) => m.user_id === currentUser?.id);
  const currentUserRole = currentMember
    ? currentMember.role
    : activeServer?.owner_id === currentUser?.id
      ? 'OWNER'
      : 'MEMBER';

  const handleStartDM = useCallback(
    async (userId) => {
      await startOrSelectDM(userId);
      handleSelectServer(null);
    },
    [startOrSelectDM, handleSelectServer]
  );

  const handleOpenDeleteServer = (srv) => { modals.setServerToDelete(srv || activeServer); modals.setIsDeleteServerOpen(true); };
  const handleConfirmDeleteServer = async (srvId) => { await handleDeleteServer(srvId); modals.setIsDeleteServerOpen(false); modals.setServerToDelete(null); };

  const handleDisconnectVoice = () => {
    handleDisconnectVoicePresence(connectedVoiceChannelId);
    setConnectedVoiceChannelId(null);
    playDiscordSound('voice_leave');
    addToast('Você saiu do canal de voz.', 'info');
    const activeCh = channels.find((c) => c.id === activeChannelId);
    if (activeCh?.type === 'VOICE') {
      const textCh = channels.find((c) => c.type === 'TEXT');
      if (textCh) handleSelectChannel(textCh.id);
    }
  };

  const activeVoiceStates = useMemo(() => {
    const merged = { ...voiceStates, ...globalVoiceStates };
    if (currentUser?.id) {
      const selfState = { is_muted: isVoiceMuted, is_deafened: isVoiceDeafened, is_speaking: false };
      merged[currentUser.id] = { ...(merged[currentUser.id] || {}), ...selfState };
      merged[Number(currentUser.id)] = { ...(merged[Number(currentUser.id)] || {}), ...selfState };
      merged[String(currentUser.id)] = { ...(merged[String(currentUser.id)] || {}), ...selfState };
    }
    return merged;
  }, [voiceStates, globalVoiceStates, currentUser?.id, isVoiceMuted, isVoiceDeafened]);

  useEffect(() => {
    if (connectedVoiceChannelId && sendVoiceState) {
      sendVoiceState({ is_muted: isVoiceMuted, is_deafened: isVoiceDeafened, is_speaking: false });
    }
  }, [isVoiceMuted, isVoiceDeafened, connectedVoiceChannelId, sendVoiceState]);

  const handleToggleMembers = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setIsMobileMembersOpen((prev) => !prev);
      setIsMobileNavOpen(false);
    } else {
      setShowMembers((prev) => !prev);
    }
  }, []);

  const handleToggleMobileNav = useCallback(() => {
    setIsMobileNavOpen((prev) => !prev);
    setIsMobileMembersOpen(false);
  }, []);

  return (
    <div
      className={`discord-container ${isMobileNavOpen ? 'mobile-nav-open' : ''} ${isMobileMembersOpen ? 'mobile-members-open' : ''}`}
      data-testid="discord-app-root"
    >
      {isMobileNavOpen && (
        <div
          className="discord-mobile-backdrop"
          onClick={() => setIsMobileNavOpen(false)}
          data-testid="mobile-nav-backdrop"
        />
      )}
      {isMobileMembersOpen && (
        <div
          className="discord-mobile-members-backdrop"
          onClick={() => setIsMobileMembersOpen(false)}
          data-testid="mobile-members-backdrop"
        />
      )}
      <ServerListBar
        servers={servers}
        activeServerId={activeServerId}
        onSelectServer={handleSelectServer}
        onOpenCreateServer={() => modals.setIsCreateServerOpen(true)}
        onToggleAppSidebar={onToggleAppSidebar}
        isAppSidebarHidden={isAppSidebarHidden}
        totalDMUnreads={unreads.total_dms}
        serverUnreads={unreads.servers}
      />

      {activeServerId === null ? (
        <DMSidebar
          conversations={conversations}
          activeConversationId={activeDMId}
          onSelectConversation={(id) => {
            setIsMobileNavOpen(false);
            setIsMobileMembersOpen(false);
            setActiveDMId(id);
            localStorage.setItem('discord_active_dm_id', String(id));
          }}
          onOpenNewDM={() => modals.setIsNewDMOpen(true)}
          currentUser={currentUser}
          dmUnreads={unreads.dms}
          isSoundMuted={soundMuted}
          onToggleSoundMute={handleToggleSoundMute}
          isVoiceMuted={isVoiceMuted}
          onToggleVoiceMute={handleToggleVoiceMute}
          isVoiceDeafened={isVoiceDeafened}
          onToggleVoiceDeafen={handleToggleVoiceDeafen}
          onOpenUserSettings={() => modals.setIsUserSettingsOpen(true)}
          onOpenDeleteServer={handleOpenDeleteServer}
          onOpenEditChannel={(ch) => {
            modals.setChannelToEdit(ch);
            modals.setIsEditChannelOpen(true);
          }}
        />
      ) : (
        <ChannelSidebar
          server={activeServer}
          channels={channels}
          activeChannelId={activeChannelId}
          connectedVoiceChannelId={connectedVoiceChannelId}
          voiceChannelUsers={voiceChannelUsers}
          voiceChannelCallTimes={voiceChannelCallTimes}
          onlineUsers={onlineUsers}
          onSelectChannel={(chId) => {
            setIsMobileNavOpen(false);
            setIsMobileMembersOpen(false);
            handleSelectChannel(chId, (vId) => {
              setConnectedVoiceChannelId(vId);
              playDiscordSound('voice_join');
            });
          }}
          onOpenCreateChannel={() => modals.setIsCreateChannelOpen(true)}
          onOpenInvite={() => modals.setIsInviteOpen(true)}
          currentUser={currentUser}
          currentUserRole={currentUserRole}
          voiceStates={activeVoiceStates}
          onDisconnectVoice={handleDisconnectVoice}
          channelUnreads={unreads.channels}
          isSoundMuted={soundMuted}
          onToggleSoundMute={handleToggleSoundMute}
          isVoiceMuted={isVoiceMuted}
          onToggleVoiceMute={handleToggleVoiceMute}
          isVoiceDeafened={isVoiceDeafened}
          onToggleVoiceDeafen={handleToggleVoiceDeafen}
          onOpenServerSettings={() => modals.setIsServerSettingsOpen(true)}
          onOpenUserSettings={() => modals.setIsUserSettingsOpen(true)}
          onOpenDeleteServer={handleOpenDeleteServer}
          onOpenEditChannel={(ch) => {
            modals.setChannelToEdit(ch);
            modals.setIsEditChannelOpen(true);
          }}
        />
      )}

      {activeChannel?.type !== 'VOICE' && (
        <ChatArea
          channel={currentChatChannel}
          messages={messages}
          channels={channels}
          pinnedMessages={pinnedMessages}
          onTogglePin={handleGeneralTogglePin}
          loadingPins={loadingPins}
          onThreadUpdate={(rId, sum) => handleThreadMessageNew({ root_message_id: rId, thread_summary: sum })}
          onSendMessage={handleGeneralSendMessage}
          onEditMessage={handleGeneralEditMessage}
          onToggleReaction={handleGeneralToggleReaction}
          onForwardMessage={handleForwardMessage}
          onStartDM={handleStartDM}
          typingUsers={activeServerId === null ? dmTypingUsers : typingUsers}
          onSendTyping={activeServerId === null ? sendDMTyping : sendTyping}
          showMembers={isMobileMembersOpen || showMembers}
          onToggleMembers={handleToggleMembers}
          onToggleMobileNav={handleToggleMobileNav}
          loading={loading}
          connectionStatus={activeServerId === null ? dmConnectionStatus : connectionStatus}
          currentUserId={currentUser?.id}
          currentUserRole={currentUserRole}
          members={
            activeServerId === null
              ? activeDM
                ? [activeDM.other_user, currentUser].filter(Boolean)
                : []
              : members
          }
          onRequestDeleteMessage={(msg) => {
            modals.setMessageToDelete(msg);
            modals.setIsDeleteModalOpen(true);
          }}
          onUploadAttachment={handleGeneralUploadAttachment}
          currentUser={currentUser}
          voiceUsers={
            connectedVoiceChannel ? voiceChannelUsers[connectedVoiceChannel.id] || [] : []
          }
          onlineUsers={
            connectedVoiceChannel && activeChannelId === connectedVoiceChannel.id ? onlineUsers : []
          }
          voiceStates={activeVoiceStates}
          onSendVoiceState={sendVoiceState}
          onDisconnectVoice={handleDisconnectVoice}
        />
      )}

      {connectedVoiceChannel && (
        <VoiceChannelArea
          key={connectedVoiceChannel.id}
          channel={connectedVoiceChannel}
          currentUser={currentUser}
          voiceUsers={voiceChannelUsers[connectedVoiceChannel.id] || []}
          onlineUsers={activeChannelId === connectedVoiceChannel.id ? onlineUsers : []}
          voiceStates={activeVoiceStates}
          onSendVoiceState={sendVoiceState}
          onDisconnectVoice={handleDisconnectVoice}
          showMembers={isMobileMembersOpen || showMembers}
          onToggleMembers={handleToggleMembers}
          onToggleMobileNav={handleToggleMobileNav}
          isMinimized={activeChannel?.type !== 'VOICE'}
          onReturnToVoice={() => setActiveChannelId(connectedVoiceChannel.id)}
          token={token}
          isMuted={isVoiceMuted}
          setIsMuted={setIsVoiceMuted}
          isDeafened={isVoiceDeafened}
          setIsDeafened={setIsVoiceDeafened}
          onRoomVoiceStatesUpdate={handleRoomVoiceStatesUpdate}
        />
      )}

      {(isMobileMembersOpen || (showMembers && (typeof window === "undefined" || window.innerWidth > 768))) && activeServer && (
        <MemberListSidebar
          members={members}
          currentUserId={currentUser?.id}
          currentUserRole={currentUser?.role}
          activeServer={activeServer}
          token={token}
          onStartDM={handleStartDM}
          onMemberRemoved={(uid) => setMembers((prev) => prev.filter((m) => m.user_id !== uid && m.id !== uid))}
        />
      )}

      <DiscordModalsLayer
        modals={modals} token={token} currentUser={currentUser} activeServer={activeServer}
        activeServerId={activeServerId} channels={channels} members={members} setServers={setServers}
        setMembers={setMembers} onUserUpdated={onUserUpdated} onLogout={onLogout}
        handleCreateServer={handleCreateServer} handleCreateChannel={handleCreateChannel}
        handleUpdateChannel={handleUpdateChannel} handleDeleteChannel={handleDeleteChannel}
        handleCreateInvite={handleCreateInvite} handleOpenDeleteServer={handleOpenDeleteServer}
        handleGeneralConfirmDelete={handleGeneralConfirmDelete} onSelectDMUser={handleStartDM}
        handleConfirmDeleteServer={handleConfirmDeleteServer}
      />
    </div>
  );
}
