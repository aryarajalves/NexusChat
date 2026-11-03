import React, { useState, useEffect } from 'react';
import { Monitor, Volume2, VolumeX, Loader2 } from 'lucide-react';

export default function ShareScreenModal({
  isOpen,
  onClose,
  onConfirmShare,
}) {
  const [captureAudio, setCaptureAudio] = useState(() => {
    try {
      const saved = localStorage.getItem('discord_capture_pc_audio');
      return saved === 'true';
    } catch {
      return false;
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem('discord_capture_pc_audio');
        setCaptureAudio(saved === 'true');
      } catch {}
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleAudio = () => {
    const nextVal = !captureAudio;
    setCaptureAudio(nextVal);
    try {
      localStorage.setItem('discord_capture_pc_audio', String(nextVal));
    } catch {}
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirmShare({ captureAudio });
      onClose();
    } catch {
      setLoading(false);
    }
  };

  return (
    <div
      className="discord-modal-backdrop"
      data-testid="share-screen-modal"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="discord-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px' }}
      >
        <div className="discord-modal-header" style={{ padding: '20px 24px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Monitor size={22} color="#5865f2" />
            <h3 className="discord-modal-title" style={{ fontSize: '18px' }}>
              Compartilhar Tela
            </h3>
          </div>
        </div>

        <div className="discord-modal-body" style={{ padding: '16px 24px 22px' }}>
          <p style={{ color: '#dbdee1', fontSize: '13.5px', margin: '0 0 16px 0', lineHeight: 1.5 }}>
            Escolha como deseja transmitir sua tela ou janela para os membros da sala de voz.
          </p>

          <div
            onClick={handleToggleAudio}
            style={{
              background: '#2b2d31',
              borderRadius: '8px',
              padding: '14px 16px',
              border: `1px solid ${captureAudio ? 'rgba(87, 242, 135, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: captureAudio ? '0 0 14px rgba(87, 242, 135, 0.12)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {captureAudio ? (
                <Volume2 size={20} color="#57f287" style={{ flexShrink: 0 }} />
              ) : (
                <VolumeX size={20} color="#949ba4" style={{ flexShrink: 0 }} />
              )}
              <div>
                <div style={{ color: '#ffffff', fontSize: '13px', fontWeight: 600 }}>
                  Capturar som do computador
                </div>
                <div style={{ color: '#949ba4', fontSize: '11.5px', marginTop: '2px' }}>
                  Transmita o áudio de jogos, músicas e vídeos do seu PC
                </div>
              </div>
            </div>

            <div className={`channel-toggle-switch ${captureAudio ? 'active' : ''}`}>
              <div className="channel-toggle-handle" />
              <input
                type="checkbox"
                checked={captureAudio}
                onChange={handleToggleAudio}
                style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }}
                data-testid="toggle-capture-pc-audio-checkbox"
                aria-label="Capturar som do computador"
              />
            </div>
          </div>
        </div>

        <div className="discord-modal-footer">
          <button
            type="button"
            className="discord-modal-btn btn-secondary"
            onClick={onClose}
            disabled={loading}
            data-testid="cancel-share-screen-btn"
          >
            Cancelar
          </button>
          <button
            type="button"
            className="discord-modal-btn btn-primary"
            onClick={handleConfirm}
            disabled={loading}
            data-testid="confirm-share-screen-btn"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spinner" />
                <span>Iniciando...</span>
              </>
            ) : (
              <span>Compartilhar</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
