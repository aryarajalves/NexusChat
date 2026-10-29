import React, { useState } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Modal de confirmação para exclusão de mensagens no Discord.
 * Conformidade com as regras de UX do projeto:
 * - Centralizado com painel preto translúcido (backdrop)
 * - Não fecha ao clicar no fundo translúcido
 * - Apenas 1 botão para fechar/cancelar além do botão principal de ação
 * - Feedback visual de loading
 */
export default function DeleteMessageModal({ isOpen, message, onClose, onConfirmDelete }) {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !message) return null;

  const handleDelete = async () => {
    if (loading) return;
    try {
      setLoading(true);
      await onConfirmDelete(message.id);
      onClose();
    } catch {
      // O erro já é tratado e notificado com toast no chamador
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="discord-modal-backdrop"
      data-testid="delete-message-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-modal-title"
    >
      <div className="discord-modal-card" data-testid="delete-message-modal">
        {/* Cabeçalho */}
        <div className="discord-modal-header delete-header">
          <div className="delete-icon-wrapper">
            <Trash2 size={24} className="delete-icon" />
          </div>
          <div>
            <h2 id="delete-modal-title" className="discord-modal-title">
              Apagar Mensagem
            </h2>
            <p className="discord-modal-subtitle">
              Esta ação é permanente e não poderá ser desfeita.
            </p>
          </div>
        </div>

        {/* Pré-visualização da Mensagem */}
        <div className="delete-message-preview">
          <div className="delete-preview-author">
            {message.author_name || 'Usuário'}
          </div>
          <div className="delete-preview-text">
            {message.content ? message.content : <em>[Arquivo em anexo]</em>}
          </div>
        </div>

        <div className="delete-warning-box">
          <AlertTriangle size={16} />
          <span>A mensagem será removida em tempo real para todos os participantes do canal.</span>
        </div>

        {/* Rodapé de Ações: Apenas 1 botão de fechar/cancelar + 1 botão de ação principal */}
        <div className="discord-modal-footer">
          <button
            type="button"
            className="discord-modal-btn btn-secondary"
            onClick={onClose}
            disabled={loading}
            data-testid="cancel-delete-btn"
          >
            Cancelar
          </button>

          <button
            type="button"
            className="discord-modal-btn btn-danger"
            onClick={handleDelete}
            disabled={loading}
            data-testid="confirm-delete-btn"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spinner" />
                <span>Apagando...</span>
              </>
            ) : (
              <span>Apagar Mensagem</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
