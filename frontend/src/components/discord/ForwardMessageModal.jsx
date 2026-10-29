import React, { useState } from 'react';
import { Share2, Hash, X } from 'lucide-react';

export default function ForwardMessageModal({
  isOpen,
  onClose,
  message,
  channels = [],
  currentChannelId,
  onForwardMessage,
}) {
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !message) return null;

  // Filtra canais de texto
  const textChannels = channels.filter((c) => c.type === 'TEXT');

  const handleForward = async (e) => {
    e.preventDefault();
    if (!selectedChannelId) {
      setError('Por favor, selecione um canal de destino.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onForwardMessage(message.id, parseInt(selectedChannelId, 10));
      onClose();
    } catch (err) {
      setError(err.message || 'Erro ao encaminhar mensagem.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="discord-modal-backdrop"
      data-testid="forward-message-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forward-modal-title"
    >
      <div className="discord-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="discord-modal-header">
          <div>
            <h3 id="forward-modal-title" className="discord-modal-title">Encaminhar Mensagem</h3>
            <p className="discord-modal-subtitle">Escolha o canal de texto para onde deseja encaminhar esta mensagem.</p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Fechar"
            data-testid="close-forward-modal-btn"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleForward}>
          <div className="discord-modal-body">
            {error && (
              <div className="form-error-banner" role="alert" data-testid="forward-modal-error">
                {error}
              </div>
            )}

            {/* Prévia da Mensagem */}
            <div
              style={{
                background: '#2b2d31',
                padding: '12px 14px',
                borderRadius: '8px',
                borderLeft: '4px solid #5865f2',
                fontSize: '13px',
                color: '#dbdee1',
              }}
              data-testid="forward-message-preview"
            >
              <div style={{ fontWeight: 600, color: '#f23f43', marginBottom: '4px' }}>
                {message.author_name || 'Usuário'}
              </div>
              <div style={{ color: '#b5bac1', wordBreak: 'break-word' }}>
                {message.content || (message.attachment_url ? '📎 Anexo' : '')}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="target-channel-select" className="form-label">
                Canal de Destino <span style={{ color: '#ed4245' }}>*</span>
              </label>
              <select
                id="target-channel-select"
                className="form-input"
                value={selectedChannelId}
                onChange={(e) => {
                  setSelectedChannelId(e.target.value);
                  setError(null);
                }}
                required
                data-testid="target-channel-select"
              >
                <option value="">Selecione um canal...</option>
                {textChannels.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.name} {ch.id === currentChannelId ? '(Canal Atual)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="discord-modal-footer">
            <button
              type="button"
              className="discord-modal-btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="cancel-forward-btn"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="discord-modal-btn btn-primary"
              disabled={isSubmitting || !selectedChannelId}
              data-testid="confirm-forward-btn"
            >
              <Share2 size={16} />
              {isSubmitting ? 'Encaminhando...' : 'Encaminhar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
