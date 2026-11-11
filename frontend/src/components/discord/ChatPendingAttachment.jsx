import React from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';

export default function ChatPendingAttachment({
  pendingFiles = [],
  pendingFile = null,
  pendingPreviewUrl = null,
  formatFileSize,
  onRemoveFile,
  onRemovePendingFile,
  onAddMoreFiles,
}) {
  const items = pendingFiles && pendingFiles.length > 0
    ? pendingFiles
    : pendingFile
      ? [{ file: pendingFile, previewUrl: pendingPreviewUrl, id: 'legacy-0' }]
      : [];

  if (items.length === 0) return null;

  return (
    <div className="attachment-pending-container" data-testid="attachment-pending-box">
      <div className="attachment-pending-scroll-row">
        {items.map((item, index) => {
          const { file, previewUrl, id } = item;
          const isImg = file?.type?.startsWith('image/');
          const isVid = file?.type?.startsWith('video/');

          const handleRemove = () => {
            if (onRemoveFile) {
              onRemoveFile(index);
            } else if (onRemovePendingFile) {
              onRemovePendingFile();
            }
          };

          return (
            <div key={id || index} className="attachment-pending-media-card" data-testid={`pending-card-${index}`}>
              <div className="pending-thumb-wrapper">
                {previewUrl && isImg ? (
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="pending-media-thumb"
                    data-testid={index === 0 ? 'pending-image-preview' : `pending-image-preview-${index}`}
                  />
                ) : previewUrl && isVid ? (
                  <video
                    src={previewUrl}
                    className="pending-media-thumb"
                    data-testid={index === 0 ? 'pending-video-preview' : `pending-video-preview-${index}`}
                    muted
                  />
                ) : (
                  <div className="pending-file-generic-thumb">
                    <FileText size={32} className="pending-file-icon" />
                  </div>
                )}
                <button
                  type="button"
                  className="pending-remove-btn-floating"
                  onClick={handleRemove}
                  title="Remover anexo"
                  data-testid={index === 0 ? 'remove-pending-attachment-btn' : `remove-pending-attachment-btn-${index}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="pending-media-caption">
                <span className="pending-file-name" title={file.name}>{file.name}</span>
                <span className="pending-file-size">({formatFileSize ? formatFileSize(file.size) : `${Math.round(file.size / 1024)} KB`})</span>
              </div>
            </div>
          );
        })}

        {onAddMoreFiles && (
          <button
            type="button"
            className="attachment-add-more-btn"
            onClick={onAddMoreFiles}
            title="Adicionar mais arquivos"
            data-testid="add-more-attachments-btn"
          >
            <Plus size={24} />
            <span>Adicionar</span>
          </button>
        )}
      </div>
      <span className="pending-legend-badge">
        {items.length === 1
          ? 'Digite uma legenda abaixo (opcional)'
          : `${items.length} mídias selecionadas (envio simultâneo). Digite uma legenda se desejar.`}
      </span>
    </div>
  );
}
