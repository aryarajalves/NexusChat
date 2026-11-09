import React, { useEffect, useRef } from 'react';
import { Volume2, Volume1, VolumeX, RotateCcw } from 'lucide-react';

export default function VoiceUserVolumePopover({
  user,
  volume = 100,
  isLocallyMuted = false,
  onSetVolume,
  onToggleMute,
  onClose,
}) {
  const popoverRef = useRef(null);
  const userName = user?.user_name || user?.name || 'Membro';
  const effectiveVolume = isLocallyMuted ? 0 : volume;

  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.();
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose?.();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleSliderChange = (e) => {
    const val = Number(e.target.value);
    onSetVolume?.(val);
    if (isLocallyMuted && val > 0) {
      onToggleMute?.();
    }
  };

  const handleReset = (e) => {
    e.stopPropagation();
    onSetVolume?.(100);
    if (isLocallyMuted) {
      onToggleMute?.();
    }
  };

  return (
    <div
      ref={popoverRef}
      className="voice-user-volume-popover"
      data-testid={`voice-user-volume-popover-${user?.id || user?.user_id}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="voice-user-volume-header">
        <div className="voice-user-volume-title-group">
          {isLocallyMuted || effectiveVolume === 0 ? (
            <VolumeX size={15} className="voice-user-volume-icon" style={{ color: '#ed4245' }} />
          ) : effectiveVolume < 50 ? (
            <Volume1 size={15} className="voice-user-volume-icon" />
          ) : (
            <Volume2 size={15} className="voice-user-volume-icon" />
          )}
          <span className="voice-user-volume-name" title={userName}>
            {userName}
          </span>
        </div>
        <span
          className={`voice-user-volume-badge ${isLocallyMuted ? 'is-muted' : ''}`}
          data-testid="voice-user-volume-badge"
        >
          {isLocallyMuted ? 'Silenciado' : `${volume}%`}
        </span>
      </div>

      <div className="voice-user-volume-slider-wrap">
        <div className="voice-user-volume-slider-row">
          <input
            type="range"
            min="0"
            max="200"
            step="1"
            value={effectiveVolume}
            onChange={handleSliderChange}
            className="voice-user-volume-slider"
            data-testid="voice-user-volume-slider"
            style={{
              background: `linear-gradient(to right, #5865f2 0%, #5865f2 ${effectiveVolume / 2}%, #1e1f22 ${effectiveVolume / 2}%, #1e1f22 100%)`,
            }}
            title={`Volume de ${userName}: ${effectiveVolume}%`}
          />
        </div>
      </div>

      <div className="voice-user-volume-actions">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute?.();
          }}
          className={`voice-user-volume-mute-btn ${isLocallyMuted ? 'is-muted' : ''}`}
          data-testid="voice-user-mute-toggle-btn"
          title={isLocallyMuted ? 'Desativar silenciamento' : 'Silenciar este usuário para mim'}
        >
          <VolumeX size={12} />
          <span>{isLocallyMuted ? 'Desmutar' : 'Silenciar'}</span>
        </button>

        <button
          type="button"
          onClick={handleReset}
          className="voice-user-volume-reset-btn"
          data-testid="voice-user-volume-reset-btn"
          title="Restaurar para o volume normal de 100%"
        >
          <RotateCcw size={11} style={{ marginRight: '3px', verticalAlign: '-1px' }} />
          100% (Padrão)
        </button>
      </div>
    </div>
  );
}
