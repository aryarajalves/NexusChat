import React from 'react';
import { Volume2, Mic, MicOff, Headphones, VolumeX, PhoneOff, Settings, AudioLines } from 'lucide-react';

/**
 * Componente que renderiza a barra flutuante de conexão de voz
 * e o card do usuário logado no rodapé da barra lateral de canais.
 */
export default function ChannelSidebarFooter({
  connectedVoiceChannel,
  server,
  onSelectChannel,
  onDisconnectVoice,
  isNoiseSuppressionEnabled = true,
  onToggleNoiseSuppression,
  currentUser,
  onOpenUserSettings,
  isVoiceMuted,
  onToggleVoiceMute,
  isVoiceDeafened,
  onToggleVoiceDeafen,
  isSoundMuted,
  onToggleSoundMute,
}) {
  const userInitial = (currentUser?.name || 'U').charAt(0).toUpperCase();

  return (
    <>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className={`control-icon-btn ${isNoiseSuppressionEnabled ? 'active' : 'muted'}`}
              onClick={onToggleNoiseSuppression}
              title={
                isNoiseSuppressionEnabled
                  ? 'Supressão de Ruído Ativada (Clique para desativar)'
                  : 'Supressão de Ruído Desativada (Clique para ativar)'
              }
              data-testid="sidebar-noise-suppression-btn"
              style={{
                color: isNoiseSuppressionEnabled ? '#23a55a' : '#949ba4',
              }}
            >
              <AudioLines size={16} />
            </button>
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
        </div>
      )}

      {/* Card do Usuário Logado no Rodapé */}
      <div className="discord-user-bar">
        <div
          className="discord-user-info"
          data-testid="user-profile-bar"
          onClick={onOpenUserSettings}
          title="Abrir Configurações de Usuário"
        >
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
          <button
            type="button"
            className={`control-icon-btn ${isVoiceMuted ? 'muted' : ''}`}
            onClick={onToggleVoiceMute}
            title={isVoiceMuted ? 'Ativar Microfone' : 'Silenciar Microfone'}
            data-testid="mic-btn"
          >
            {isVoiceMuted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button
            type="button"
            className={`control-icon-btn ${isVoiceDeafened || isSoundMuted ? 'muted' : ''}`}
            onClick={onToggleVoiceDeafen || onToggleSoundMute}
            title={
              isVoiceDeafened
                ? 'Desativar Ensurdecer'
                : isSoundMuted
                  ? 'Ativar Efeitos Sonoros'
                  : 'Silenciar Efeitos Sonoros'
            }
            data-testid="audio-btn"
          >
            {isVoiceDeafened || isSoundMuted ? <VolumeX size={16} /> : <Headphones size={16} />}
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
    </>
  );
}
