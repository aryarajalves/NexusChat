import React from 'react';
import { FileText, X, Trash2 } from 'lucide-react';

export default function ChatPendingAttachment({
  pendingFile,
  pendingPreviewUrl,
  formatFileSize,
  onRemovePendingFile,
}) {
  if (!pendingFile) return null;

  return (
    <div className="attachment-pending-container" data-testid="attachment-pending-box">
      {pendingPreviewUrl && pendingFile.type.startsWith('image/') ? (
        <div className="attachment-pending-media-card">
          <div className="pending-thumb-wrapper">
            <img
              src={pendingPreviewUrl}
              alt={pendingFile.name}
              className="pending-media-thumb"
              data-testid="pending-image-preview"
            />
            <button
              type="button"
              className="pending-remove-btn-floating"
              onClick={onRemovePendingFile}
              title="Remover anexo"
              data-testid="remove-pending-attachment-btn"
            >
              <Trash2 size={13} />
            </button>
          </div>
          <div className="pending-media-caption">
            <span className="pending-file-name" title={pendingFile.name}>{pendingFile.name}</span>
            <span className="pending-file-size">({formatFileSize(pendingFile.size)})</span>
          </div>
          <span className="pending-legend-badge">Digite uma legenda abaixo (opcional)</span>
        </div>
      ) : pendingPreviewUrl && pendingFile.type.startsWith('video/') ? (
        <div className="attachment-pending-media-card">
          <div className="pending-thumb-wrapper">
            <video
              src={pendingPreviewUrl}
              className="pending-media-thumb"
              data-testid="pending-video-preview"
              muted
            />
            <button
              type="button"
              className="pending-remove-btn-floating"
              onClick={onRemovePendingFile}
              title="Remover anexo"
              data-testid="remove-pending-attachment-btn"
            >
              <Trash2 size={13} />
            </button>
          </div>
          <div className="pending-media-caption">
            <span className="pending-file-name" title={pendingFile.name}>{pendingFile.name}</span>
            <span className="pending-file-size">({formatFileSize(pendingFile.size)})</span>
          </div>
          <span className="pending-legend-badge">Digite uma legenda abaixo (opcional)</span>
        </div>
      ) : (
        <div className="attachment-pending-preview">
          <FileText size={18} className="pending-file-icon" />
          <span className="pending-file-name" title={pendingFile.name}>{pendingFile.name}</span>
          <span className="pending-file-size">({formatFileSize(pendingFile.size)})</span>
          <button
            type="button"
            className="remove-pending-btn"
            onClick={onRemovePendingFile}
            title="Remover anexo"
            data-testid="remove-pending-attachment-btn"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
