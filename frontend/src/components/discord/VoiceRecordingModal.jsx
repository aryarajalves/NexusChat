import React from 'react';
import { Download, Trash2, X, Film, Volume2, Clock, HardDrive, Check } from 'lucide-react';

export default function VoiceRecordingModal({
  isOpen,
  onClose,
  channelName = 'voz',
  recordType = 'audio', // 'audio' | 'video'
  recordedUrl,
  recordedBlob,
  durationSeconds = 0,
  onExport,
}) {
  if (!isOpen || !recordedUrl) return null;

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
  const defaultFilename = `gravacao_${channelName.replace(/\s+/g, '_')}_${recordType}_${dateStr}_${timeStr}.webm`;

  const handleDownload = () => {
    if (onExport) {
      onExport(defaultFilename);
      return;
    }
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="modal-backdrop" data-testid="voice-recording-modal-backdrop">
      <div className="voice-recording-dialog" data-testid="voice-recording-modal">
        {/* Cabeçalho */}
        <div className="voice-recording-header">
          <div className="voice-recording-title-wrap">
            <div className="voice-recording-icon-badge">
              {recordType === 'video' ? <Film size={20} color="#5865f2" /> : <Volume2 size={20} color="#5865f2" />}
            </div>
            <div>
              <h3 className="voice-recording-title">Gravação Concluída</h3>
              <p className="voice-recording-subtitle">
                Canal #{channelName} • {recordType === 'video' ? 'Vídeo com Áudio' : 'Áudio da Conversa'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="voice-recording-close-btn"
            onClick={onClose}
            title="Fechar"
            data-testid="close-voice-recording-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* Player de Prévia */}
        <div className="voice-recording-preview-box">
          {recordType === 'video' ? (
            <video
              src={recordedUrl}
              controls
              playsInline
              className="voice-recording-video-player"
              data-testid="recorded-video-preview"
            />
          ) : (
            <div className="voice-recording-audio-card" data-testid="recorded-audio-preview">
              <div className="voice-recording-audio-info">
                <Volume2 size={32} color="#5865f2" />
                <div className="voice-recording-audio-meta">
                  <span className="voice-recording-audio-name">{defaultFilename}</span>
                  <span className="voice-recording-audio-sub">WebM Audio • Codec Opus</span>
                </div>
              </div>
              <audio src={recordedUrl} controls className="voice-recording-native-audio" />
            </div>
          )}
        </div>

        {/* Metadados da Gravação */}
        <div className="voice-recording-meta-grid">
          <div className="voice-recording-meta-item">
            <Clock size={16} color="#949ba4" />
            <span>Duração:</span>
            <strong>{formatTime(durationSeconds)}</strong>
          </div>
          <div className="voice-recording-meta-item">
            <HardDrive size={16} color="#949ba4" />
            <span>Tamanho:</span>
            <strong>{formatFileSize(recordedBlob?.size)}</strong>
          </div>
          <div className="voice-recording-meta-item">
            <Check size={16} color="#57f287" />
            <span>Formato:</span>
            <strong>WebM ({recordType.toUpperCase()})</strong>
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="voice-recording-footer">
          <button
            type="button"
            className="discord-btn discord-btn-secondary"
            onClick={onClose}
            data-testid="discard-recording-btn"
          >
            <Trash2 size={16} />
            <span>Descartar</span>
          </button>
          <button
            type="button"
            className="discord-btn discord-btn-primary"
            onClick={handleDownload}
            data-testid="export-recording-btn"
          >
            <Download size={16} />
            <span>Baixar / Exportar para o Computador</span>
          </button>
        </div>
      </div>
    </div>
  );
}
