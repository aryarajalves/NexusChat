import React, { useState, useRef, useEffect } from 'react';
import {
  Hash,
  Volume2,
  Radio,
  Lock,
  Plus,
  UserPlus,
  Headphones,
  MicOff,
  ChevronDown,
  Settings,
  Trash2,
  MessageSquare,
} from 'lucide-react';
import ChannelSidebarFooter from './ChannelSidebarFooter';
import VoiceChannelItem from './VoiceChannelItem';

export default function ChannelSidebar({
  server,
  channels = [],
  members = [],
  activeChannelId,
  connectedVoiceChannelId,
  onSelectChannel,
  onOpenVoiceChat,
  onOpenCreateChannel,
  onOpenInvite,
  currentUser,
  currentUserRole = 'MEMBER',
  voiceStates = {},
  onlineUsers = [],
  voiceChannelUsers = {},
  voiceChannelCallTimes = {},
  onDisconnectVoice,
  isNoiseSuppressionEnabled = true,
  onToggleNoiseSuppression,
  channelUnreads = {},
  isSoundMuted = false,
  onToggleSoundMute,
  isVoiceMuted = false,
  onToggleVoiceMute,
  isVoiceDeafened = false,
  onToggleVoiceDeafen,
  userVolumes = {},
  userLocalMutes = {},
  onSetUserVolume,
  onToggleUserLocalMute,
  onOpenServerSettings,
  onOpenUserSettings,
  onOpenDeleteServer,
  onOpenEditChannel,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isOwnerOrAdmin =
    currentUserRole === 'OWNER' ||
    currentUserRole === 'ADMIN' ||
    server?.owner_id === currentUser?.id ||
    currentUser?.role === 'superadmin';

  const isOwner =
    currentUserRole === 'OWNER' ||
    server?.owner_id === currentUser?.id ||
    currentUser?.role === 'superadmin';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Agrupa canais por categoria
  const textChannels = channels.filter((c) => c.type === 'TEXT');
  const stageChannels = channels.filter((c) => c.type === 'STAGE');
  const voiceChannels = channels.filter((c) => c.type === 'VOICE');

  const getAudioChannelUsers = (chId, isConnected) => {
    const channelUsers = voiceChannelUsers[chId] || [];
    const memberMap = new Map();
    (members || []).forEach((m) => { const mid = Number(m.user_id || m.id); if (mid) memberMap.set(mid, m); });
    const mapUser = (u, forceMe = false) => {
      const uid = u.user_id || u.id;
      const m = memberMap.get(Number(uid));
      const isMe = forceMe || Number(uid) === Number(currentUser?.id);
      return {
        user_id: uid,
        user_name: u.user_name || u.name || m?.user_name || m?.name,
        avatar_url: isMe ? currentUser?.avatar_url : (u.avatar_url || m?.avatar_url || null),
        is_muted: u.is_muted,
        is_deafened: u.is_deafened,
        is_speaking: u.is_speaking,
        is_screen_sharing: u.is_screen_sharing,
      };
    };

    const map = new Map();
    channelUsers.forEach((u) => {
      const uid = u.user_id || u.id;
      const m = memberMap.get(Number(uid));
      // Garante que membros explicitamente offline não sejam exibidos no canal de voz
      if (m && m.is_online === false && Number(uid) !== Number(currentUser?.id)) {
        return;
      }
      if (uid) map.set(uid, mapUser(u));
    });
    if (isConnected && currentUser) {
      map.set(currentUser.id, {
        user_id: currentUser.id,
        user_name: currentUser.name,
        avatar_url: currentUser.avatar_url || null,
        is_muted: isVoiceMuted,
        is_deafened: isVoiceDeafened,
      });
    }
    return Array.from(map.values()).sort((a, b) => Number(a.user_id) - Number(b.user_id));
  };

  const userInitial = (currentUser?.name || 'U').charAt(0).toUpperCase();
  const connectedVoiceChannel = channels.find((c) => c.id === connectedVoiceChannelId);

  return (
    <aside className="discord-channel-sidebar" aria-label="Canais do Servidor">
      {/* Cabeçalho do Servidor */}
      <div
        className={`server-header ${server ? 'clickable' : ''}`}
        data-testid="server-header"
        onClick={() => server && setIsMenuOpen((prev) => !prev)}
        style={{ cursor: server ? 'pointer' : 'default', position: 'relative' }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {server ? server.name : 'Mensagens Diretas'}
        </span>
        {server && (
          <div className="server-header-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="control-icon-btn"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title="Opções do Servidor"
              data-testid="server-header-dropdown-btn"
            >
              <ChevronDown
                size={16}
                style={{
                  transform: isMenuOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                }}
              />
            </button>
            <button
              type="button"
              className="control-icon-btn"
              onClick={onOpenInvite}
              title="Convidar Pessoas"
              data-testid="server-invite-btn"
            >
              <UserPlus size={16} />
            </button>
            <button
              type="button"
              className="control-icon-btn"
              onClick={onOpenCreateChannel}
              title="Criar Canal"
              data-testid="header-create-channel-btn"
            >
              <Plus size={16} />
            </button>
          </div>
        )}

        {/* Dropdown Menu Flutuante */}
        {server && isMenuOpen && (
          <div
            className="server-dropdown-menu"
            ref={menuRef}
            onClick={(e) => e.stopPropagation()}
            data-testid="server-dropdown-menu"
          >
            {isOwnerOrAdmin && (
              <button
                type="button"
                className="server-dropdown-item"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenServerSettings && onOpenServerSettings();
                }}
                data-testid="server-settings-menu-item"
              >
                <span>Configurações do Servidor</span>
                <Settings size={16} />
              </button>
            )}
            <button
              type="button"
              className="server-dropdown-item"
              onClick={() => {
                setIsMenuOpen(false);
                onOpenCreateChannel && onOpenCreateChannel();
              }}
              data-testid="server-create-channel-menu-item"
            >
              <span>Criar Canal</span>
              <Plus size={16} />
            </button>
            <button
              type="button"
              className="server-dropdown-item"
              onClick={() => {
                setIsMenuOpen(false);
                onOpenInvite && onOpenInvite();
              }}
              data-testid="server-invite-menu-item"
            >
              <span>Convidar Pessoas</span>
              <UserPlus size={16} />
            </button>
            {isOwner && (
              <>
                <div style={{ height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />
                <button
                  type="button"
                  className="server-dropdown-item"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onOpenDeleteServer && onOpenDeleteServer(server);
                  }}
                  data-testid="server-delete-menu-item"
                  style={{ color: '#f87171' }}
                >
                  <span>Excluir Servidor</span>
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Lista de Canais */}
      <div className="channel-list-container">
        {/* Canais de Texto */}
        {textChannels.length > 0 && (
          <div>
            <div className="channel-category">
              <span>Canais de Texto</span>
              <button
                type="button"
                className="channel-category-btn"
                onClick={onOpenCreateChannel}
                title="Criar Canal de Texto"
                data-testid="create-text-channel-btn"
              >
                <Plus size={14} />
              </button>
            </div>
            {textChannels.map((ch) => {
              const isActive = activeChannelId === ch.id;
              const unreadCount = (channelUnreads && channelUnreads[ch.id]) || 0;
              const isUnread = unreadCount > 0 && !isActive;

              return (
                <div
                  key={ch.id}
                  className={`channel-item ${isActive ? 'active' : ''} ${isUnread ? 'channel-item-unread' : ''}`}
                  onClick={() => onSelectChannel(ch.id)}
                  data-testid={`channel-item-${ch.id}`}
                  role="button"
                  tabIndex={0}
                  style={{ position: 'relative' }}
                >
                  {isUnread && (
                    <div className="channel-unread-dot" data-testid={`channel-unread-dot-${ch.id}`} />
                  )}
                  <div className="channel-item-left">
                    {ch.is_private ? (
                      <Lock size={16} className={`channel-icon ${isUnread ? 'channel-icon-unread' : ''}`} data-testid={`channel-lock-${ch.id}`} />
                    ) : (
                      <Hash size={16} className={`channel-icon ${isUnread ? 'channel-icon-unread' : ''}`} />
                    )}
                    <span className={isUnread ? 'channel-name-unread' : ''}>{ch.name}</span>
                  </div>
                  <div className="channel-item-actions">
                    {isUnread && (
                      <span className="channel-unread-badge" data-testid={`channel-unread-badge-${ch.id}`}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                    {isOwnerOrAdmin && (
                      <button
                        type="button"
                        className="channel-action-settings-btn"
                        title="Configurações do Canal"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEditChannel && onOpenEditChannel(ch);
                        }}
                        data-testid={`edit-channel-btn-${ch.id}`}
                      >
                        <Settings size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Canais de Aula / Palco */}
        {stageChannels.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <div className="channel-category">
              <span>Canais de Aula</span>
              <button
                type="button"
                className="channel-category-btn"
                onClick={onOpenCreateChannel}
                title="Criar Canal de Aula"
                data-testid="create-stage-channel-btn"
              >
                <Plus size={14} />
              </button>
            </div>
            {stageChannels.map((ch) => {
              const isActive = activeChannelId === ch.id;
              const isConnected = connectedVoiceChannelId === ch.id;
              const displayUsers = getAudioChannelUsers(ch.id, isConnected);
              return (
                <VoiceChannelItem
                  key={ch.id}
                  ch={ch}
                  isStage={true}
                  isActive={isActive}
                  isConnected={isConnected}
                  displayUsers={displayUsers}
                  voiceChannelCallTimes={voiceChannelCallTimes}
                  onSelectChannel={onSelectChannel}
                  onOpenVoiceChat={onOpenVoiceChat}
                  onOpenEditChannel={onOpenEditChannel}
                  isOwnerOrAdmin={isOwnerOrAdmin}
                  currentUser={currentUser}
                  voiceStates={voiceStates}
                  isVoiceMuted={isVoiceMuted}
                  isVoiceDeafened={isVoiceDeafened}
                  userVolumes={userVolumes}
                  userLocalMutes={userLocalMutes}
                  onSetUserVolume={onSetUserVolume}
                  onToggleUserLocalMute={onToggleUserLocalMute}
                />
              );
            })}
          </div>
        )}

        {/* Canais de Voz */}
        {voiceChannels.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <div className="channel-category">
              <span>Canais de Voz</span>
              <button
                type="button"
                className="channel-category-btn"
                onClick={onOpenCreateChannel}
                title="Criar Canal de Voz"
                data-testid="create-voice-channel-btn"
              >
                <Plus size={14} />
              </button>
            </div>
            {voiceChannels.map((ch) => {
              const isActive = activeChannelId === ch.id;
              const isConnected = connectedVoiceChannelId === ch.id;
              const displayUsers = getAudioChannelUsers(ch.id, isConnected);
              return (
                <VoiceChannelItem
                  key={ch.id}
                  ch={ch}
                  isStage={false}
                  isActive={isActive}
                  isConnected={isConnected}
                  displayUsers={displayUsers}
                  voiceChannelCallTimes={voiceChannelCallTimes}
                  onSelectChannel={onSelectChannel}
                  onOpenVoiceChat={onOpenVoiceChat}
                  onOpenEditChannel={onOpenEditChannel}
                  isOwnerOrAdmin={isOwnerOrAdmin}
                  currentUser={currentUser}
                  voiceStates={voiceStates}
                  isVoiceMuted={isVoiceMuted}
                  isVoiceDeafened={isVoiceDeafened}
                  userVolumes={userVolumes}
                  userLocalMutes={userLocalMutes}
                  onSetUserVolume={onSetUserVolume}
                  onToggleUserLocalMute={onToggleUserLocalMute}
                />
              );
            })}
          </div>
        )}
      </div>

      <ChannelSidebarFooter
        connectedVoiceChannel={connectedVoiceChannel}
        server={server}
        onSelectChannel={onSelectChannel}
        onDisconnectVoice={onDisconnectVoice}
        isNoiseSuppressionEnabled={isNoiseSuppressionEnabled}
        onToggleNoiseSuppression={onToggleNoiseSuppression}
        currentUser={currentUser}
        onOpenUserSettings={onOpenUserSettings}
        isVoiceMuted={isVoiceMuted}
        onToggleVoiceMute={onToggleVoiceMute}
        isVoiceDeafened={isVoiceDeafened}
        onToggleVoiceDeafen={onToggleVoiceDeafen}
        isSoundMuted={isSoundMuted}
        onToggleSoundMute={onToggleSoundMute}
      />
    </aside>
  );
}
