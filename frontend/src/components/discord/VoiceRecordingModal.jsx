import React, { useState, useEffect } from 'react';
import { Download, Trash2, Film, Volume2, Clock, HardDrive, Check, Zap, Loader2, Cloud, UploadCloud } from 'lucide-react';
import { processVideoExport } from './videoExportUtils';
import { useToast } from '../../context/ToastContext';

// Helper para formatar data e horário no padrão dd/MM/yy HH:mm
function formatRecordingDateTime(dateObj = new Date()) {
  const dd = String(dateObj.getDate()).padStart(2, '0');
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const yy = String(dateObj.getFullYear()).slice(-2);
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const min = String(dateObj.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

export default function VoiceRecordingModal({
  isOpen,
  onClose,
  channelId,
  channelName = 'voz',
  recordType = 'audio', // 'audio' | 'video'
  recordedUrl,
  recordedBlob,
  durationSeconds = 0,
  onExport,
  onSavedToCloud,
}) {
  const [exportFormat, setExportFormat] = useState('mp4'); // 'mp4' | 'webm'
  const [isCompressEnabled, setIsCompressEnabled] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Título inicial com formato dd/MM/yy HH:mm
  const [title, setTitle] = useState(() => `Gravação #${channelName} - ${formatRecordingDateTime()}`);
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [isCloudSaved, setIsCloudSaved] = useState(false);

  // Reseta completamente o estado de salvamento e atualiza a data/hora sempre que uma nova gravação chegar
  useEffect(() => {
    if (isOpen) {
      setTitle(`Gravação #${channelName} - ${formatRecordingDateTime()}`);
      setIsCloudSaved(false);
      setIsSavingToCloud(false);
    }
  }, [isOpen, channelName, recordedBlob, recordedUrl]);

  let addToast = () => {};
  try {
    const toastCtx = useToast();
    if (toastCtx?.addToast) addToast = toastCtx.addToast;
  } catch {}

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

      if (onExport) {
        onExport(defaultFilename, { blob: finalBlob, format: exportFormat, compress: isCompressEnabled });
      } else {
        const downloadUrl = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
        addToast('Gravação baixada com sucesso no seu computador!', 'success');
      }
    } catch (err) {
      console.error('[VoiceRecording] Erro na exportação:', err);
      const a = document.createElement('a');
      a.href = recordedUrl;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      addToast('Gravação baixada no formato original.', 'info');
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  // Upload direto para o Backblaze B2 (Zero HD no servidor)
  const handleSaveToCloud = async () => {
    if (!channelId) {
      addToast('Canal não identificado para salvar na nuvem.', 'warning');
      return;
    }

    try {
      setIsSavingToCloud(true);

      const finalBlob = recordType === 'video' && isCompressEnabled
        ? await processVideoExport({
            blob: recordedBlob,
            targetFormat: exportFormat,
            compress: isCompressEnabled,
            onProgress: (p) => setExportProgress(p),
          })
        : recordedBlob;

      const formData = new FormData();
      const sendFilename = `${(title || 'gravacao').replace(/\s+/g, '_')}.${ext}`;
      formData.append('file', finalBlob || recordedBlob, sendFilename);
      formData.append('title', (title || defaultInitialTitle).trim());
      formData.append('record_type', recordType);
      formData.append('duration_seconds', String(durationSeconds || 0));

      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
      const res = await fetch(`/api/v1/discord/channels/${channelId}/recordings`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Falha ao salvar gravação no servidor.');
      }

      const data = await res.json();
      setIsCloudSaved(true);
      addToast('Gravação salva com sucesso no Backblaze B2!', 'success');
      onSavedToCloud?.(data);

      // Após 4 segundos volta suavemente a exibir "Salvar no Servidor" para novas ações
      setTimeout(() => {
        setIsCloudSaved(false);
      }, 4000);
    } catch (err) {
      console.error('[VoiceRecording] Erro ao salvar na nuvem:', err);
      addToast(err.message || 'Erro ao salvar gravação na nuvem.', 'error');
    } finally {
      setIsSavingToCloud(false);
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

        {/* Campo de Nome/Título Personalizado da Gravação */}
        <div style={{ padding: '0 20px 8px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#b5bac1' }}>
            Nome da Gravação:
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setIsCloudSaved(false);
            }}
            placeholder="Digite um título para sua gravação..."
            style={{
              background: '#1e1f22',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#f2f3f5',
              fontSize: 14,
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            data-testid="recording-title-input"
          />
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

            {(isExporting || isSavingToCloud) && exportProgress > 0 && (
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
        <div className="voice-recording-footer" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="discord-btn discord-btn-secondary"
            onClick={onClose}
            disabled={isExporting || isSavingToCloud}
            data-testid="discard-recording-btn"
          >
            <Trash2 size={16} />
            <span>Descartar</span>
          </button>

          {channelId && (
            <button
              type="button"
              className="discord-btn"
              style={{
                background: isCloudSaved ? '#23a55a' : '#5865f2',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: isSavingToCloud || isExporting ? 'not-allowed' : 'pointer',
              }}
              onClick={handleSaveToCloud}
              disabled={isSavingToCloud || isExporting}
              data-testid="save-to-cloud-btn"
            >
              {isSavingToCloud ? (
                <Loader2 size={16} className="spin-anim" />
              ) : isCloudSaved ? (
                <Check size={16} />
              ) : (
                <UploadCloud size={16} />
              )}
              <span>{isCloudSaved ? 'Salvo no B2! (Salvar Novamente)' : isSavingToCloud ? 'Enviando...' : 'Salvar no Servidor'}</span>
            </button>
          )}

          <button
            type="button"
            className="discord-btn discord-btn-primary"
            onClick={handleDownload}
            disabled={isExporting || isSavingToCloud}
            data-testid="export-recording-btn"
          >
            {isExporting ? <Loader2 size={16} className="spin-anim" /> : <Download size={16} />}
            <span>
              {isExporting
                ? `Otimizando (${exportProgress}%)...`
                : `Baixar na Máquina`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
