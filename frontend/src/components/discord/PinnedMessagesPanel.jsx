import React from 'react';
import { Pin, X, CornerDownRight, Trash2, FileText, Loader2 } from 'lucide-react';
import { formatBrasiliaDateTime } from './chatUtils';

export default function PinnedMessagesPanel({
  isOpen,
  onClose,
  channel,
  pinnedMessages = [],
  loading = false,
  onScrollToMessage,
  onTogglePin,
}) {
  if (!isOpen) return null;

  return (
    <div
      className="pinned-messages-panel"
      data-testid="pinned-messages-panel"
      role="dialog"
      aria-label="Mensagens Fixadas"
    >
      <div className="pinned-panel-header">
        <div className="pinned-panel-title-wrap">
          <Pin size={16} color="#f0b232" />
          <span className="pinned-panel-title">Mensagens Fixadas</span>
          <span className="pinned-panel-count-badge" data-testid="pinned-count-badge">
            {pinnedMessages.length}
          </span>
        </div>
        <button
          type="button"
          className="pinned-panel-close-btn"
          onClick={onClose}
          title="Fechar painel de fixadas (Esc)"
          data-testid="close-pinned-panel-btn"
        >
          <X size={16} />
        </button>
      </div>

      <div className="pinned-messages-list" data-testid="pinned-messages-list">
        {loading ? (
          <div className="pinned-empty-state" data-testid="pinned-loading">
            <Loader2 size={24} className="spinner-icon" />
            <span>Carregando mensagens fixadas...</span>
          </div>
        ) : pinnedMessages.length === 0 ? (
          <div className="pinned-empty-state" data-testid="pinned-empty-state">
            <Pin size={36} opacity={0.3} color="#f0b232" />
            <span className="pinned-empty-title">Nenhuma mensagem fixada ainda</span>
            <span className="pinned-empty-desc">
              Mensagens importantes fixadas no canal {channel?.is_dm ? `@${channel.name}` : `#${channel?.name || 'geral'}`} aparecerão aqui para acesso rápido.
            </span>
          </div>
        ) : (
          pinnedMessages.map((msg) => {
            const initial = (msg.author_name || 'U').charAt(0).toUpperCase();
            return (
              <div
                key={msg.id}
                className="pinned-card"
                data-testid={`pinned-card-${msg.id}`}
              >
                <div className="pinned-card-header">
                  <div className="pinned-card-avatar">{initial}</div>
                  <span className="pinned-card-author">{msg.author_name}</span>
                  <span className="pinned-card-timestamp">
                    {formatBrasiliaDateTime(msg.created_at)}
                  </span>
                </div>

                {msg.content && (
                  <div className="pinned-card-body">{msg.content}</div>
                )}

                {msg.attachment_url && (
                  <div className="pinned-card-attachment">
                    <FileText size={12} />
                    <span>Anexo</span>
                  </div>
                )}

                <div className="pinned-card-actions">
                  <button
                    type="button"
                    className="pinned-jump-btn"
                    onClick={() => onScrollToMessage(msg.id)}
                    title="Ir para a mensagem no feed"
                    data-testid={`pinned-jump-btn-${msg.id}`}
                  >
                    <CornerDownRight size={13} />
                    <span>Ir para mensagem</span>
                  </button>

                  {onTogglePin && (
                    <button
                      type="button"
                      className="pinned-unpin-btn"
                      onClick={() => onTogglePin(msg)}
                      title="Desafixar mensagem"
                      data-testid={`unpin-btn-${msg.id}`}
                    >
                      <Trash2 size={13} />
                      <span>Desafixar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
