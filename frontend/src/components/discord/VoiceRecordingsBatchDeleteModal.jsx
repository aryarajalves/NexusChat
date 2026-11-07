import React from 'react';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';

export default function VoiceRecordingsBatchDeleteModal({
  isOpen,
  selectedCount,
  isDeleting,
  onClose,
  onConfirm,
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" data-testid="batch-delete-confirm-backdrop">
      <div className="delete-confirm-popup" data-testid="batch-delete-confirm-modal">
        <h4 className="delete-confirm-title">
          <AlertTriangle size={20} />
          Excluir {selectedCount} Gravações em Lote?
        </h4>
        <p className="delete-confirm-message">
          Tem certeza de que deseja apagar as <strong>{selectedCount} gravações selecionadas</strong>? Esta ação removerá definitivamente todos os arquivos de áudio/vídeo do servidor e do Backblaze B2. Não será possível recuperá-los.
        </p>
        <div className="delete-confirm-footer">
          <button
            type="button"
            className="discord-btn discord-btn-secondary"
            onClick={onClose}
            disabled={isDeleting}
            data-testid="cancel-batch-delete-btn"
          >
            <span>Cancelar</span>
          </button>
          <button
            type="button"
            className="discord-btn discord-btn-danger"
            onClick={onConfirm}
            disabled={isDeleting}
            data-testid="confirm-batch-delete-btn"
          >
            {isDeleting ? <Loader2 size={16} className="spin-anim" /> : <Trash2 size={16} />}
            <span>{isDeleting ? 'Apagando do B2...' : `Sim, Excluir (${selectedCount})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
