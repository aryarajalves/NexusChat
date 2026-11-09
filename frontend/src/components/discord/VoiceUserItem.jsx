import React, { useState } from 'react';
import { MicOff, Headphones, Volume2, Volume1, VolumeX } from 'lucide-react';
import VoiceUserVolumePopover from './VoiceUserVolumePopover';

export default function VoiceUserItem({
  user,
  currentUser,
  voiceStates = {},
  isVoiceMuted = false,
  isVoiceDeafened = false,
  userVolumes = {},
  userLocalMutes = {},
  onSetUserVolume,
  onToggleUserLocalMute,
}) {
  const [isVolumeOpen, setIsVolumeOpen] = useState(false);

  const uid = user.user_id || user.id;
  const isMe = Number(uid) === Number(currentUser?.id);
  const uname = user.user_name || user.name || (isMe ? (currentUser?.name || 'Você') : 'Membro');
  const userState = voiceStates[uid] || voiceStates[Number(uid)] || voiceStates[String(uid)] || {};

  const isMuted = isMe ? isVoiceMuted : Boolean(userState.is_muted !== undefined ? userState.is_muted : (user.is_muted ?? true));
  const isDeafened = isMe ? isVoiceDeafened : Boolean(userState.is_deafened !== undefined ? userState.is_deafened : user.is_deafened);
  const isSpeaking = !isMuted && !isDeafened && Boolean(userState.is_speaking !== undefined ? userState.is_speaking : user.is_speaking);
  const isSharingScreen = Boolean(userState.is_screen_sharing || userState.isScreenSharing || user.is_screen_sharing);
  const initial = (uname || 'U').trim().charAt(0).toUpperCase();

  const volume = userVolumes[uid] ?? userVolumes[String(uid)] ?? 100;
  const isLocallyMuted = Boolean(userLocalMutes[uid] ?? userLocalMutes[String(uid)]);

  const handleContextMenu = (e) => {
    if (!isMe) {
      e.preventDefault();
      setIsVolumeOpen((prev) => !prev);
    }
  };

  return (
    <div
      className={`voice-user-item ${isSpeaking ? 'speaking' : ''}`}
      data-testid={`voice-user-item-${uid}`}
      onContextMenu={handleContextMenu}
      style={{ position: 'relative' }}
    >
      <div className={`voice-user-avatar ${isSpeaking ? 'speaking-halo' : ''}`}>
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={uname}
            className="voice-user-avatar-img"
            data-testid={`voice-user-avatar-img-${uid}`}
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          initial
        )}
      </div>

      <span className="voice-user-name" title={uname}>
        {uname}
      </span>

      <div className="voice-user-icons" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {isSharingScreen && (
          <span
            className="voice-user-live-badge"
            title="Transmitindo tela ao vivo"
            data-testid={`voice-user-live-badge-${uid}`}
            style={{
              background: '#f23f43',
              color: '#ffffff',
              fontSize: '9px',
              fontWeight: 700,
              padding: '1px 4px',
              borderRadius: '4px',
              letterSpacing: '0.4px',
              lineHeight: '12px',
            }}
          >
            AO VIVO
          </span>
        )}

        {isMuted && (
          <MicOff
            size={13}
            className="voice-user-muted-icon"
            title="Microfone Mutado"
            data-testid={`voice-user-muted-${uid}`}
          />
        )}

        {isDeafened && (
          <Headphones
            size={13}
            className="voice-user-deaf-icon"
            title="Áudio Desativado (Ensurdecido)"
            data-testid={`voice-user-deaf-${uid}`}
          />
        )}

        {/* Botão de Controle de Volume (exibido no hover para outros contatos) */}
        {!isMe && (
          <button
            type="button"
            className={`voice-user-volume-trigger ${isVolumeOpen ? 'is-open' : ''} ${isLocallyMuted ? 'is-muted' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsVolumeOpen((prev) => !prev);
            }}
            data-testid={`voice-user-volume-trigger-${uid}`}
            title={`Ajustar volume de ${uname} (${isLocallyMuted ? 'Silenciado' : `${volume}%`})`}
          >
            {isLocallyMuted ? (
              <VolumeX size={13} />
            ) : volume < 50 ? (
              <Volume1 size={13} />
            ) : (
              <Volume2 size={13} />
            )}
          </button>
        )}
      </div>

      {/* Popover de Volume Individual */}
      {isVolumeOpen && !isMe && (
        <VoiceUserVolumePopover
          user={user}
          volume={volume}
          isLocallyMuted={isLocallyMuted}
          onSetVolume={(vol) => onSetUserVolume?.(uid, vol)}
          onToggleMute={() => onToggleUserLocalMute?.(uid)}
          onClose={() => setIsVolumeOpen(false)}
        />
      )}
    </div>
  );
}
