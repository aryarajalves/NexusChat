import React from 'react';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';

export default function VoiceRecordingDeleteModal({
  recording,
  isDeleting,
  onClose,
  onConfirm,
}) {
  if (!recording) return null;

  return (
    <div className="modal-backdrop" data-testid="delete-confirm-backdrop">
      <div className="delete-confirm-popup" data-testid="delete-recording-modal">
        <h4 className="delete-confirm-title">
          <AlertTriangle size={20} />
          Excluir Gravação Permanentemente?
        </h4>
        <p className="delete-confirm-message">
          Tem certeza de que deseja apagar a gravação <strong>"{recording.title}"</strong>? Esta ação removerá o arquivo definitivamente do servidor e do Backblaze B2. Não será possível recuperá-lo.
        </p>
        <div className="delete-confirm-footer">
          <button
            type="button"
            className="discord-btn discord-btn-secondary"
            onClick={onClose}
            disabled={isDeleting}
            data-testid="cancel-delete-recording-btn"
          >
            <span>Cancelar</span>
          </button>
          <button
            type="button"
            className="discord-btn discord-btn-danger"
            onClick={onConfirm}
            disabled={isDeleting}
            data-testid="confirm-delete-recording-btn"
          >
            {isDeleting ? <Loader2 size={16} className="spin-anim" /> : <Trash2 size={16} />}
            <span>{isDeleting ? 'Apagando do B2...' : 'Sim, Excluir Gravação'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
