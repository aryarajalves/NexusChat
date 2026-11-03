import React, { useState } from 'react';
import { MessageSquarePlus, X } from 'lucide-react';

export default function CreateThreadModal({
  isOpen,
  onClose,
  message,
  onCreateThread,
}) {
  const [threadName, setThreadName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !message) return null;

  const defaultName = (message.content || 'Novo Tópico').slice(0, 40).trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalName = threadName.trim() || defaultName;
    setIsSubmitting(true);
    try {
      await onCreateThread(message, finalName);
      setThreadName('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="create-thread-modal-backdrop"
      data-testid="create-thread-modal-backdrop"
      role="dialog"
      aria-modal="true"
    >
      <div className="create-thread-modal" data-testid="create-thread-modal">
        <div className="create-thread-modal-header">
          <h3>
            <MessageSquarePlus size={18} color="#5865f2" />
            <span>Criar Tópico</span>
          </h3>
          <button
            type="button"
            className="thread-panel-action-btn"
            onClick={onClose}
            title="Fechar (Esc)"
            data-testid="close-create-thread-modal-btn"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="create-thread-modal-body">
            <label className="create-thread-label" htmlFor="thread-name-input">
              Nome do Tópico
            </label>
            <input
              id="thread-name-input"
              type="text"
              className="create-thread-input"
              placeholder={defaultName}
              value={threadName}
              onChange={(e) => setThreadName(e.target.value)}
              maxLength={100}
              autoFocus
              data-testid="thread-name-input"
            />
          </div>

          <div className="create-thread-modal-footer">
            <button
              type="button"
              className="discord-btn discord-btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="discord-btn discord-btn-primary"
              disabled={isSubmitting}
              data-testid="confirm-create-thread-btn"
            >
              {isSubmitting ? 'Criando...' : 'Criar Tópico'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
