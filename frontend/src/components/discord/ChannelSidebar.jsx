import React, { useState, useRef, useEffect } from 'react';
import {
  Hash,
  Volume2,
  Lock,
  Plus,
  UserPlus,
  Mic,
  Headphones,
  VolumeX,
  PhoneOff,
  MicOff,
  ChevronDown,
  Settings,
  Trash2,
} from 'lucide-react';

export default function ChannelSidebar({
  server,
  channels = [],
  activeChannelId,
  connectedVoiceChannelId,
  onSelectChannel,
  onOpenCreateChannel,
  onOpenInvite,
  currentUser,
  currentUserRole = 'MEMBER',
  voiceStates = {},
  onDisconnectVoice,
  channelUnreads = {},
  isSoundMuted = false,
  onToggleSoundMute,
  onOpenServerSettings,
  onOpenUserSettings,
  onOpenDeleteServer,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isOwnerOrAdmin =
    currentUserRole === 'OWNER' ||
    currentUserRole === 'ADMIN' ||
    server?.owner_id === currentUser?.id;

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
  const voiceChannels = channels.filter((c) => c.type === 'VOICE');

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
                  {isUnread && (
                    <span className="channel-unread-badge" data-testid={`channel-unread-badge-${ch.id}`}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
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

              return (
                <div key={ch.id} className="voice-channel-wrapper">
                  <div
                    className={`channel-item ${isActive ? 'active' : ''} ${isConnected ? 'voice-connected' : ''}`}
                    onClick={() => onSelectChannel(ch.id)}
                    data-testid={`channel-item-${ch.id}`}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="channel-item-left">
                      {ch.is_private ? (
                        <Lock size={16} className={`channel-icon ${isConnected ? 'voice-active-icon' : ''}`} data-testid={`channel-lock-${ch.id}`} />
                      ) : (
                        <Volume2 size={16} className={`channel-icon ${isConnected ? 'voice-active-icon' : ''}`} />
                      )}
                      <span>{ch.name}</span>
                    </div>
                  </div>

                  {/* Usuários Conectados no Canal de Voz (Bolinha do Perfil) */}
                  {isConnected && currentUser && (
                    <div className="voice-channel-users-list" data-testid={`voice-channel-users-${ch.id}`}>
                      <div
                        className={`voice-user-item ${voiceStates[currentUser.id]?.is_speaking ? 'speaking' : ''}`}
                        data-testid={`voice-user-item-${currentUser.id}`}
                      >
                        <div
                          className={`voice-user-avatar ${
                            voiceStates[currentUser.id]?.is_speaking ? 'speaking-halo' : ''
                          }`}
                        >
                          {userInitial}
                        </div>
                        <span className="voice-user-name">{currentUser.name || 'Super Admin'}</span>
                        {voiceStates[currentUser.id]?.is_muted && (
                          <MicOff size={13} className="voice-user-muted-icon" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Barra de Status de Conexão de Voz Flutuante no Rodapé */}
      {connectedVoiceChannel && (
        <div className="discord-voice-connection-status" data-testid="discord-voice-status-bar">
          <div
            className="voice-connection-info"
            onClick={() => onSelectChannel(connectedVoiceChannel.id)}
            title="Ir para o Canal de Voz"
            role="button"
            tabIndex={0}
          >
            <div className="voice-connection-title">
              <Volume2 size={15} className="voice-conn-icon" />
              <span>Voz Conectada</span>
            </div>
            <div className="voice-connection-channel-name">
              {connectedVoiceChannel.name} / {server?.name || 'Servidor'}
            </div>
          </div>
          <button
            type="button"
            className="voice-disconnect-btn"
            onClick={onDisconnectVoice}
            title="Desconectar da Voz"
            data-testid="sidebar-voice-disconnect-btn"
          >
            <PhoneOff size={16} />
          </button>
        </div>
      )}

      {/* Card do Usuário Logado no Rodapé */}
      <div className="discord-user-bar">
        <div className="discord-user-info" data-testid="user-profile-bar" onClick={onOpenUserSettings} title="Abrir Configurações de Usuário">
          <div className="discord-avatar-wrapper">
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.name}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              userInitial
            )}
            <span className="discord-online-badge" />
          </div>
          <div className="discord-user-names">
            <span className="discord-name-text">{currentUser?.name || 'Usuário'}</span>
            <span className="discord-status-text">Online</span>
          </div>
        </div>

        <div className="discord-user-controls">
          <button type="button" className="control-icon-btn" title="Microfone" data-testid="mic-btn">
            <Mic size={16} />
          </button>
          <button
            type="button"
            className={`control-icon-btn ${isSoundMuted ? 'muted' : ''}`}
            onClick={onToggleSoundMute}
            title={isSoundMuted ? 'Ativar Efeitos Sonoros' : 'Silenciar Efeitos Sonoros'}
            data-testid="audio-btn"
          >
            {isSoundMuted ? <VolumeX size={16} /> : <Headphones size={16} />}
          </button>
          <button
            type="button"
            className="control-icon-btn"
            onClick={onOpenUserSettings}
            title="Configurações do Usuário"
            data-testid="user-settings-btn"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
