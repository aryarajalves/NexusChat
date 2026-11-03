import React, { useState } from 'react';
import { Download, Trash2, Film, Volume2, Clock, HardDrive, Check, Zap, Loader2 } from 'lucide-react';
import { processVideoExport } from './videoExportUtils';

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
  const [exportFormat, setExportFormat] = useState('mp4'); // 'mp4' | 'webm'
  const [isCompressEnabled, setIsCompressEnabled] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

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
  const ext = recordType === 'video' ? exportFormat : 'webm';
  const defaultFilename = `gravacao_${channelName.replace(/\s+/g, '_')}_${recordType}_${dateStr}_${timeStr}.${ext}`;

  const handleDownload = async () => {
    if (onExport) {
      onExport(defaultFilename, { format: exportFormat, compress: isCompressEnabled });
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress(10);

      const finalBlob = recordType === 'video'
        ? await processVideoExport({
            blob: recordedBlob,
            targetFormat: exportFormat,
            compress: isCompressEnabled,
            onProgress: (p) => setExportProgress(p),
          })
        : recordedBlob;

      const downloadUrl = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('[VoiceRecording] Erro na exportação:', err);
      // Fallback para download original
      const a = document.createElement('a');
      a.href = recordedUrl;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
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
            <strong>{recordType === 'video' ? exportFormat.toUpperCase() : 'WebM (AUDIO)'}</strong>
          </div>
        </div>

        {/* Opções de Exportação e Compressão (Vídeo) */}
        {recordType === 'video' && (
          <div className="voice-recording-options-section" data-testid="voice-recording-options">
            <div className="voice-recording-format-row">
              <span className="voice-recording-format-label">Formato de Exportação:</span>
              <div className="voice-recording-format-pills">
                <button
                  type="button"
                  className={`voice-format-pill ${exportFormat === 'mp4' ? 'active' : ''}`}
                  onClick={() => setExportFormat('mp4')}
                  data-testid="format-pill-mp4"
                >
                  MP4 (Padrão)
                </button>
                <button
                  type="button"
                  className={`voice-format-pill ${exportFormat === 'webm' ? 'active' : ''}`}
                  onClick={() => setExportFormat('webm')}
                  data-testid="format-pill-webm"
                >
                  WebM
                </button>
              </div>
            </div>

            <div
              className={`voice-recording-compress-card ${isCompressEnabled ? 'active' : ''}`}
              onClick={() => setIsCompressEnabled(!isCompressEnabled)}
              data-testid="toggle-compression-card"
            >
              <div className="voice-recording-compress-info">
                <div className="voice-recording-compress-header-row">
                  <Zap size={15} color={isCompressEnabled ? '#57f287' : '#949ba4'} />
                  <strong className="voice-recording-compress-title">Comprimir vídeo sem perder qualidade</strong>
                  {isCompressEnabled && (
                    <span className="voice-recording-compress-badge">~50% menor</span>
                  )}
                </div>
                <p className="voice-recording-compress-sub">
                  Otimização inteligente H.264 que reduz o tamanho do arquivo preservando resolução e nitidez.
                </p>
              </div>
              <div className={`channel-toggle-switch ${isCompressEnabled ? 'active' : ''}`}>
                <div className="channel-toggle-handle" />
              </div>
            </div>

            {isExporting && exportProgress > 0 && (
              <div className="voice-recording-progress-bar-wrap">
                <div
                  className="voice-recording-progress-bar-fill"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Rodapé com Ações */}
        <div className="voice-recording-footer">
          <button
            type="button"
            className="discord-btn discord-btn-secondary"
            onClick={onClose}
            disabled={isExporting}
            data-testid="discard-recording-btn"
          >
            <Trash2 size={16} />
            <span>Descartar</span>
          </button>
          <button
            type="button"
            className="discord-btn discord-btn-primary"
            onClick={handleDownload}
            disabled={isExporting}
            data-testid="export-recording-btn"
          >
            {isExporting ? <Loader2 size={16} className="spin-anim" /> : <Download size={16} />}
            <span>
              {isExporting
                ? `Otimizando e Exportando (${exportProgress}%)...`
                : `Baixar em ${recordType === 'video' ? exportFormat.toUpperCase() : 'WebM'}`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
