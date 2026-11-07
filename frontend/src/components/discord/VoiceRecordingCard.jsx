import React from 'react';
import { Film, Volume2, Clock, HardDrive, Download, Trash2, Edit3, Check, X } from 'lucide-react';
import VoiceRecordingAudioPlayer from './VoiceRecordingAudioPlayer';

export default function VoiceRecordingCard({
  rec,
  isSelected,
  onToggleSelect,
  editingId,
  editTitle,
  setEditTitle,
  onStartRename,
  onSaveRename,
  onCancelRename,
  isSavingTitle,
  onDeleteRequest,
  getMediaUrl,
  getHeaders,
  formatDuration,
  formatSize,
  formatDate,
}) {
  return (
    <div
      className={`voice-recording-card ${isSelected ? 'voice-recording-card-selected' : ''}`}
      data-testid={`recording-card-${rec.id}`}
    >
      <div className="voice-recording-card-header">
        {/* Checkbox individual */}
        <label
          className="voice-recording-checkbox-wrap"
          title={isSelected ? 'Desmarcar gravação' : 'Selecionar gravação'}
        >
          <input
            type="checkbox"
            className="voice-recording-checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(rec.id)}
            data-testid={`checkbox-recording-${rec.id}`}
          />
          <span className="voice-recording-custom-checkbox">
            {isSelected && <Check size={12} strokeWidth={3} />}
          </span>
        </label>

        <div className="voice-recording-card-title-wrap">
          {rec.record_type === 'video' ? (
            <Film size={18} color="#5865f2" />
          ) : (
            <Volume2 size={18} color="#5865f2" />
          )}

          {editingId === rec.id ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="voice-recording-rename-input"
                data-testid={`input-rename-${rec.id}`}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveRename(rec.id);
                  if (e.key === 'Escape') onCancelRename();
                }}
              />
              <button
                type="button"
                className="voice-recording-rename-btn"
                onClick={() => onSaveRename(rec.id)}
                disabled={isSavingTitle}
                title="Salvar Nome"
                data-testid={`save-rename-btn-${rec.id}`}
              >
                <Check size={16} color="#57f287" />
              </button>
              <button
                type="button"
                className="voice-recording-rename-btn"
                onClick={onCancelRename}
                disabled={isSavingTitle}
                title="Cancelar"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              <span className="voice-recording-card-title" title={rec.title}>
                {rec.title}
              </span>
              <button
                type="button"
                className="voice-recording-rename-btn"
                onClick={() => onStartRename(rec)}
                title="Renomear gravação"
                data-testid={`btn-start-rename-${rec.id}`}
              >
                <Edit3 size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Badges de Metadados */}
      <div className="voice-recording-card-badges">
        <span className="voice-recording-badge voice-recording-badge-type">
          {rec.record_type === 'video' ? 'Vídeo' : 'Áudio'}
        </span>
        <span className="voice-recording-badge">
          <Clock size={12} />
          {formatDuration(rec.duration_seconds)}
        </span>
        <span className="voice-recording-badge">
          <HardDrive size={12} />
          {formatSize(rec.file_size)}
        </span>
        <span className="voice-recording-badge">
          {formatDate(rec.created_at)}
        </span>
        {rec.author_name && (
          <span className="voice-recording-badge">
            Gravado por: <strong>{rec.author_name}</strong>
          </span>
        )}
        {rec.channel_name && (
          <span className="voice-recording-badge" data-testid={`channel-badge-${rec.id}`}>
            Canal: <strong>#{rec.channel_name}</strong>
          </span>
        )}
      </div>

      {/* Player Inline */}
      <div className="voice-recording-player-box">
        {rec.record_type === 'video' ? (
          <video
            src={getMediaUrl(rec.stream_url)}
            controls
            playsInline
            preload="auto"
            data-testid={`video-player-${rec.id}`}
          />
        ) : (
          <VoiceRecordingAudioPlayer
            recording={rec}
            getMediaUrl={getMediaUrl}
            getHeaders={getHeaders}
          />
        )}
      </div>

      {/* Ações */}
      <div className="voice-recording-card-actions">
        <a
          href={getMediaUrl(rec.download_url)}
          className="voice-recording-action-btn btn-download"
          download
          data-testid={`btn-download-${rec.id}`}
        >
          <Download size={15} />
          <span>Baixar</span>
        </a>

        <button
          type="button"
          className="voice-recording-action-btn btn-delete"
          onClick={() => onDeleteRequest(rec)}
          data-testid={`btn-delete-${rec.id}`}
        >
          <Trash2 size={15} />
          <span>Excluir</span>
        </button>
      </div>
    </div>
  );
}
