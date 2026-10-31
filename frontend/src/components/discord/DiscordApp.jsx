import React, { useState, useEffect, useCallback, useRef } from 'react';
import ServerListBar from './ServerListBar';
import ChannelSidebar from './ChannelSidebar';
import DMSidebar from './DMSidebar';
import ChatArea from './ChatArea';
import VoiceChannelArea from './VoiceChannelArea';
import MemberListSidebar from './MemberListSidebar';
import CreateServerModal from './CreateServerModal';
import CreateChannelModal from './CreateChannelModal';
import ServerInviteModal from './ServerInviteModal';
import DeleteMessageModal from './DeleteMessageModal';
import DeleteServerModal from './DeleteServerModal';
import NewDMModal from './NewDMModal';
import ServerSettingsModal from './ServerSettingsModal';
import UserSettingsModal from './UserSettingsModal';
import { useDiscordSocket } from './useDiscordSocket';
import { useDiscordActions } from './useDiscordActions';
import { useDiscordDMs } from './useDiscordDMs';
import { useDiscordNavigation } from './useDiscordNavigation';
import useDiscordVoicePresence from './useDiscordVoicePresence';
import useDiscordUserWS from './useDiscordUserWS';
import { useToast } from '../../context/ToastContext';
import { isSoundMuted, toggleSoundMuted, playDiscordSound } from './discordSounds';

export default function DiscordApp({ currentUser, onUserUpdated, onToggleAppSidebar, isAppSidebarHidden }) {
  const [servers, setServers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [members, setMembers] = useState([]);
  const [connectedVoiceChannelId, setConnectedVoiceChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [loadingPins, setLoadingPins] = useState(false);
  const [showMembers, setShowMembers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [unreads, setUnreads] = useState({ channels: {}, servers: {}, dms: {}, total_dms: 0 });
  const [soundMuted, setSoundMutedState] = useState(isSoundMuted());

  // Modais
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isNewDMOpen, setIsNewDMOpen] = useState(false);
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState(null);
  const [isDeleteServerOpen, setIsDeleteServerOpen] = useState(false);

  const { addToast } = useToast();
  const token = localStorage.getItem('auth_token');
  const activeDMIdRef = useRef(null);

  // Hook de navegação com persistência em localStorage
  const {
    activeServerId,
    setActiveServerId,
    activeChannelId,
    setActiveChannelId,
    handleSelectServer,
    handleSelectChannel,
  } = useDiscordNavigation({ token, servers, setServers, channels, setChannels, setMembers });

  const handleToggleSoundMute = () => {
    const next = toggleSoundMuted();
    setSoundMutedState(next);
    if (next) {
      playDiscordSound('mute');
      addToast('Efeitos sonoros desativados.', 'info');
    } else {
      playDiscordSound('unmute');
      addToast('Efeitos sonoros ativados.', 'success');
    }
  };

  const handlePinUpdate = useCallback((updatedMsg) => {
    if (!updatedMsg) return;
    const msgObj = updatedMsg.message || updatedMsg;
    setMessages((prev) => prev.map((m) => (m.id === msgObj.id ? { ...m, is_pinned: msgObj.is_pinned } : m)));
    setPinnedMessages((prev) => (msgObj.is_pinned
      ? [msgObj, ...prev.filter((p) => p.id !== msgObj.id)]
      : prev.filter((p) => p.id !== msgObj.id)));
  }, []);

  const handleUnreadUpdate = useCallback((data) => {
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
      if (activeServerId === null && activeDMIdRef.current === data.conversation_id) return;
      setUnreads((prev) => ({
        ...prev,
        dms: { ...prev.dms, [dmId]: (prev.dms?.[dmId] || 0) + 1 },
        total_dms: (prev.total_dms || 0) + 1,
      }));
    }
  }, [activeServerId, activeChannelId]);

  // 1. Hook de DMs (Mensagens Diretas) com WebSocket em tempo real
  const handleDMMessageNew = useCallback((newMsg) => {
    if (!newMsg) return;
    setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
    if (newMsg?.author_id !== currentUser?.id) {
      playDiscordSound('message');
    }
  }, [currentUser]);

  const {
    conversations, activeDMId, setActiveDMId, loadConversations,
    startOrSelectDM, dmTypingUsers, dmConnectionStatus, sendDMTyping,
  } = useDiscordDMs({
    token,
    currentUser,
    activeServerId,
    onMessageNew: handleDMMessageNew,
    onMessageEdit: (m) => setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x))),
    onMessageDelete: (id) => setMessages((prev) => prev.filter((x) => x.id !== id)),
    onMessageReaction: (d) => setMessages((prev) => prev.map((x) => (x.id === d.message_id ? { ...x, reactions: d.reactions } : x))),
    onMessagePin: handlePinUpdate,
    onUnreadUpdate: handleUnreadUpdate,
  });

  // 2. Conexão WebSocket Global de Notificações (/api/v1/discord/ws/me)
  useDiscordUserWS({
    token,
    onUnreadUpdate: handleUnreadUpdate,
    onDMMessageNew: handleDMMessageNew,
  });

  activeDMIdRef.current = activeDMId;

  // 2. Hook de WebSocket para comunicação em tempo real de Servidores
  const {
    connectionStatus, typingUsers, onlineUsers, voiceStates,
    sendMessage, sendTyping, sendVoiceState,
  } = useDiscordSocket({
    channelId: activeServerId !== null ? activeChannelId : null,
    token,
    onMessageNew: (newMsg) => {
      setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
      if (newMsg?.author_id !== currentUser?.id) {
        const isMention = Boolean(newMsg?.content && (/@everyone\b/i.test(newMsg.content) || /@here\b/i.test(newMsg.content) || (currentUser?.name && new RegExp(`@${currentUser.name}\\b`, 'i').test(newMsg.content))));
        playDiscordSound(isMention ? 'mention' : 'message');
      }
    },
    onMessageDelete: (deletedMsgId) => setMessages((prev) => prev.filter((m) => m.id !== deletedMsgId)),
    onMessageEdit: (updatedMsg) => setMessages((prev) => prev.map((m) => (m.id === updatedMsg.id ? updatedMsg : m))),
    onMessageReaction: (data) => setMessages((prev) => prev.map((m) => (m.id === data.message_id ? { ...m, reactions: data.reactions } : m))),
    onMessagePin: handlePinUpdate,
    onUnreadUpdate: handleUnreadUpdate,
  });

  // 3. Hook de Ações REST do Discord para Servidores
  const {
    handleSendMessage, handleEditMessage, handleToggleReaction,
    handleForwardMessage, handleUploadAttachment, handleConfirmDeleteMessage,
    handleCreateServer, handleCreateChannel, handleCreateInvite, handleTogglePin, handleDeleteServer,
  } = useDiscordActions({
    token, activeServerId, activeChannelId, setMessages, setServers,
    setActiveServerId, setChannels, setActiveChannelId, sendMessage,
  });

  // 4. Hook de Presença e Participantes de Canais de Voz
  const { voiceChannelUsers, handleDisconnectVoicePresence } = useDiscordVoicePresence({
    token, channels, connectedVoiceChannelId, onlineUsers, currentUser,
  });

  // Carrega mensagens (seja de canal ou de DM)
  useEffect(() => {
    if (activeServerId === null) {
      if (!activeDMId) { setMessages([]); return; }
      fetch(`/api/v1/discord/dms/conversations/${activeDMId}/messages?limit=50`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => (r.ok ? r.json() : null)).then((d) => d && setMessages(d)).catch(() => {});
      return;
    }
    if (!activeChannelId) { setMessages([]); return; }
    const currentCh = channels.find((c) => c.id === activeChannelId);
    if (currentCh && currentCh.type === 'VOICE') { setMessages([]); return; }
    fetch(`/api/v1/discord/channels/${activeChannelId}/messages?limit=50`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null)).then((d) => d && setMessages(d)).catch(() => {});
  }, [activeServerId, activeDMId, activeChannelId, channels, token]);

  // Carrega mensagens fixadas do canal ou DM ativa
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
  }, [activeServerId, activeDMId, activeChannelId, token]);

  // Carrega contadores de mensagens não lidas
  useEffect(() => {
    if (!token) return;
    fetch('/api/v1/discord/unreads', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setUnreads({ channels: d.channels || {}, servers: d.servers || {}, dms: d.dms || {}, total_dms: d.total_dms || 0 });
      })
      .catch(() => {});
  }, [token]);

  // Marca canal ativo como lido e zera badges correspondentes
  useEffect(() => {
    const chId = String(activeChannelId);
    if (activeServerId !== null && activeChannelId && (unreads.channels?.[chId] || 0) > 0) {
      const srvId = String(activeServerId);
      const count = unreads.channels[chId];
      setUnreads((prev) => ({
        ...prev,
        channels: { ...prev.channels, [chId]: 0 },
        servers: { ...prev.servers, [srvId]: Math.max(0, (prev.servers?.[srvId] || 0) - count) },
      }));
      fetch(`/api/v1/discord/channels/${activeChannelId}/ack`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }, [activeServerId, activeChannelId, unreads.channels, token]);

  // Marca conversa direta (DM) ativa como lida e zera badges correspondentes
  useEffect(() => {
    const dmId = String(activeDMId);
    if (activeServerId === null && activeDMId && (unreads.dms?.[dmId] || 0) > 0) {
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
  }, [activeServerId, activeDMId, unreads.dms, token]);

  // Handler unificado de upload de anexos e áudios para Canais e DMs
  const handleGeneralUploadAttachment = async (file) => {
    if (activeServerId !== null) return await handleUploadAttachment(file);
    if (!activeDMId) throw new Error('Nenhuma DM ativa');
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/v1/discord/dms/conversations/${activeDMId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Falha ao fazer upload na conversa privada.');
    }
    return await res.json();
  };

  // Handlers unificados de envio/edição/deleção para Canais e DMs
  const handleGeneralSendMessage = async (msgPayload) => {
    if (activeServerId !== null) return handleSendMessage(msgPayload);
    if (!activeDMId) return;
    let attachmentData = msgPayload.attachment_file ? await handleGeneralUploadAttachment(msgPayload.attachment_file) : null;
    const res = await fetch(`/api/v1/discord/dms/conversations/${activeDMId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        content: msgPayload.content,
        attachment_url: attachmentData?.attachment_url || msgPayload.attachment_url,
        attachment_type: attachmentData?.attachment_type || msgPayload.attachment_type,
        attachment_size: attachmentData?.attachment_size || msgPayload.attachment_size,
        reply_to_id: msgPayload.reply_to_id,
      }),
    });
    if (res.ok) {
      const newMsg = await res.json();
      setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
      loadConversations();
    } else {
      const err = await res.json();
      throw new Error(err.detail || 'Falha ao enviar mensagem direta.');
    }
  };

  const handleGeneralEditMessage = async (arg1, arg2, arg3) => {
    const isThreeArgs = arg3 !== undefined;
    const chId = isThreeArgs ? arg1 : activeChannelId;
    const msgId = isThreeArgs ? arg2 : arg1;
    const newContent = isThreeArgs ? arg3 : arg2;
    if (activeServerId !== null) return handleEditMessage(chId, msgId, newContent);
    const res = await fetch(`/api/v1/discord/dms/messages/${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: newContent }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } else {
      const err = await res.json();
      throw new Error(err.detail || 'Falha ao editar mensagem.');
    }
  };

  const handleGeneralToggleReaction = async (arg1, arg2, arg3) => {
    const isThreeArgs = arg3 !== undefined;
    const chId = isThreeArgs ? arg1 : activeChannelId;
    const msgId = isThreeArgs ? arg2 : arg1;
    const emoji = isThreeArgs ? arg3 : arg2;
    if (activeServerId !== null) return handleToggleReaction(chId, msgId, emoji);
    const res = await fetch(`/api/v1/discord/dms/messages/${msgId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ emoji }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, reactions: data.reactions } : m)));
    }
  };

  const handleGeneralConfirmDelete = async (msgId) => {
    if (activeServerId !== null) return handleConfirmDeleteMessage(msgId);
    const res = await fetch(`/api/v1/discord/dms/messages/${msgId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      addToast('Mensagem excluída com sucesso.', 'info');
    } else {
      const err = await res.json();
      throw new Error(err.detail || 'Falha ao excluir mensagem.');
    }
  };

  const handleGeneralTogglePin = async (msg) => {
    const isDM = activeServerId === null;
    const targetId = isDM ? activeDMId : activeChannelId;
    if (!targetId) return;
    const updated = await handleTogglePin(msg, isDM, targetId);
    if (updated) handlePinUpdate(updated);
  };

  const handleOpenDeleteServer = (srv) => {
    setServerToDelete(srv || activeServer);
    setIsDeleteServerOpen(true);
  };

  const handleConfirmDeleteServer = async (srvId) => {
    await handleDeleteServer(srvId);
    setIsDeleteServerOpen(false);
    setServerToDelete(null);
  };

  const handleDisconnectVoice = () => {
    handleDisconnectVoicePresence(connectedVoiceChannelId);
    setConnectedVoiceChannelId(null);
    playDiscordSound('voice_leave');
    addToast('Você saiu do canal de voz.', 'info');
    const activeCh = channels.find((c) => c.id === activeChannelId);
    if (activeCh && activeCh.type === 'VOICE') {
      const textCh = channels.find((c) => c.type === 'TEXT');
      if (textCh) handleSelectChannel(textCh.id);
    }
  };

  const activeServer = servers.find((s) => s.id === activeServerId);
  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const connectedVoiceChannel = channels.find((c) => c.id === connectedVoiceChannelId);

  const activeDM = conversations.find((c) => c.id === activeDMId);
  const activeDMChannel = activeDM
    ? { id: activeDM.id, name: activeDM.other_user?.name || 'Amigo', is_dm: true, type: 'TEXT' }
    : null;

  const currentChatChannel = activeServerId === null ? activeDMChannel : activeChannel;
  const currentMember = members.find((m) => m.user_id === currentUser?.id);
  const currentUserRole = currentMember ? currentMember.role : (activeServer?.owner_id === currentUser?.id ? 'OWNER' : 'MEMBER');

  return (
    <div className="discord-container" data-testid="discord-app-root">
      {/* Coluna 1: Lista Vertical de Servidores */}
      <ServerListBar
        servers={servers}
        activeServerId={activeServerId}
        onSelectServer={handleSelectServer}
        onOpenCreateServer={() => setIsCreateServerOpen(true)}
        onToggleAppSidebar={onToggleAppSidebar}
        isAppSidebarHidden={isAppSidebarHidden}
        totalDMUnreads={unreads.total_dms}
        serverUnreads={unreads.servers}
      />

      {/* Coluna 2: Canais do Servidor Selecionado OU Lista de Mensagens Diretas */}
      {activeServerId === null ? (
        <DMSidebar
          conversations={conversations}
          activeConversationId={activeDMId}
          onSelectConversation={(id) => {
            setActiveDMId(id);
            localStorage.setItem('discord_active_dm_id', String(id));
          }}
          onOpenNewDM={() => setIsNewDMOpen(true)}
          currentUser={currentUser}
          dmUnreads={unreads.dms}
          isSoundMuted={soundMuted}
          onToggleSoundMute={handleToggleSoundMute}
          onOpenUserSettings={() => setIsUserSettingsOpen(true)}
          onOpenDeleteServer={handleOpenDeleteServer}
        />
      ) : (
        <ChannelSidebar
          server={activeServer}
          channels={channels}
          activeChannelId={activeChannelId}
          connectedVoiceChannelId={connectedVoiceChannelId}
          voiceChannelUsers={voiceChannelUsers}
          onlineUsers={onlineUsers}
          onSelectChannel={(chId) =>
            handleSelectChannel(chId, (vId) => {
              setConnectedVoiceChannelId(vId);
              playDiscordSound('voice_join');
            })
          }
          onOpenCreateChannel={() => setIsCreateChannelOpen(true)}
          onOpenInvite={() => setIsInviteOpen(true)}
          currentUser={currentUser}
          currentUserRole={currentUserRole}
          voiceStates={voiceStates}
          onDisconnectVoice={handleDisconnectVoice}
          channelUnreads={unreads.channels}
          isSoundMuted={soundMuted}
          onToggleSoundMute={handleToggleSoundMute}
          onOpenServerSettings={() => setIsServerSettingsOpen(true)}
          onOpenUserSettings={() => setIsUserSettingsOpen(true)}
          onOpenDeleteServer={handleOpenDeleteServer}
        />
      )}

      {/* Coluna 3: Chat Central (renderizado quando visualizando canal de texto ou DM) */}
      {currentChatChannel?.type !== 'VOICE' && (
        <ChatArea
          channel={currentChatChannel}
          messages={messages}
          channels={channels}
          pinnedMessages={pinnedMessages}
          onTogglePin={handleGeneralTogglePin}
          loadingPins={loadingPins}
          onSendMessage={handleGeneralSendMessage}
          onEditMessage={handleGeneralEditMessage}
          onToggleReaction={handleGeneralToggleReaction}
          onForwardMessage={handleForwardMessage}
          typingUsers={activeServerId === null ? dmTypingUsers : typingUsers}
          onSendTyping={activeServerId === null ? sendDMTyping : sendTyping}
          showMembers={showMembers}
          onToggleMembers={() => setShowMembers((prev) => !prev)}
          loading={loading}
          connectionStatus={activeServerId === null ? dmConnectionStatus : connectionStatus}
          currentUserId={currentUser?.id}
          currentUserRole={currentUserRole}
          members={activeServerId === null ? (activeDM ? [activeDM.other_user, currentUser].filter(Boolean) : []) : members}
          onRequestDeleteMessage={(msg) => {
            setMessageToDelete(msg);
            setIsDeleteModalOpen(true);
          }}
          onUploadAttachment={handleGeneralUploadAttachment}
          currentUser={currentUser}
          onlineUsers={onlineUsers}
          voiceStates={voiceStates}
          onSendVoiceState={sendVoiceState}
          onDisconnectVoice={handleDisconnectVoice}
        />
      )}

      {/* Sessão de Voz Persistente (permanece montada e exibe PiP ao navegar em canais de texto) */}
      {connectedVoiceChannel && (
        <VoiceChannelArea
          key={connectedVoiceChannel.id}
          channel={connectedVoiceChannel}
          currentUser={currentUser}
          onlineUsers={onlineUsers}
          voiceStates={voiceStates}
          onSendVoiceState={sendVoiceState}
          onDisconnectVoice={handleDisconnectVoice}
          showMembers={showMembers}
          onToggleMembers={() => setShowMembers((prev) => !prev)}
          isMinimized={activeChannel?.type !== 'VOICE'}
          onReturnToVoice={() => setActiveChannelId(connectedVoiceChannel.id)}
          token={token}
        />
      )}

      {/* Gaveta Lateral de Membros (apenas em servidores) */}
      {showMembers && activeServer && (
        <MemberListSidebar
          members={members}
          currentUserId={currentUser?.id}
          onStartDM={async (userId) => {
            await startOrSelectDM(userId);
            handleSelectServer(null);
          }}
        />
      )}

      {/* Modais de Ação */}
      <CreateServerModal isOpen={isCreateServerOpen} onClose={() => setIsCreateServerOpen(false)} onCreateServer={handleCreateServer} />
      <CreateChannelModal isOpen={isCreateChannelOpen} onClose={() => setIsCreateChannelOpen(false)} onCreateChannel={handleCreateChannel} serverId={activeServerId} token={token} />
      <ServerInviteModal isOpen={isInviteOpen} onClose={() => setIsInviteOpen(false)} server={activeServer} onCreateInvite={handleCreateInvite} />
      <ServerSettingsModal isOpen={isServerSettingsOpen} onClose={() => setIsServerSettingsOpen(false)} server={activeServer} onServerUpdated={(upd) => setServers((prev) => prev.map((s) => (s.id === upd.id ? { ...s, ...upd } : s)))} currentUser={currentUser} members={members} onMembersUpdated={(upd) => setMembers(upd)} onOpenDeleteServer={handleOpenDeleteServer} />
      <UserSettingsModal isOpen={isUserSettingsOpen} onClose={() => setIsUserSettingsOpen(false)} currentUser={currentUser} onUserUpdated={onUserUpdated} />
      <DeleteMessageModal isOpen={isDeleteModalOpen} message={messageToDelete} onClose={() => { setIsDeleteModalOpen(false); setMessageToDelete(null); }} onConfirmDelete={handleGeneralConfirmDelete} />
      <NewDMModal isOpen={isNewDMOpen} onClose={() => setIsNewDMOpen(false)} token={token} onSelectUser={async (userId) => { await startOrSelectDM(userId); handleSelectServer(null); }} />
      <DeleteServerModal isOpen={isDeleteServerOpen} server={serverToDelete} onClose={() => { setIsDeleteServerOpen(false); setServerToDelete(null); }} onConfirmDelete={handleConfirmDeleteServer} />
    </div>
  );
}
