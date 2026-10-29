import React from 'react';
import { X, Search, FileText, CornerDownRight, Loader2 } from 'lucide-react';
import { formatBrasiliaDateTime } from './chatUtils';

export default function ChatSearchResultsPanel({
  isOpen,
  onClose,
  results = [],
  total = 0,
  loading = false,
  query = '',
  filterAttachment = false,
  onToggleFilterAttachment,
  onSelectResult,
}) {
  if (!isOpen) return null;

  const renderHighlightedContent = (content, searchTerm) => {
    if (!content) return null;
    if (!searchTerm || !searchTerm.trim()) return content;

    const term = searchTerm.trim();
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = content.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="chat-search-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div
      className="chat-search-panel"
      data-testid="chat-search-panel"
      role="region"
      aria-label="Resultados da pesquisa de mensagens"
    >
      <div className="chat-search-panel-header">
        <div className="chat-search-title-wrap">
          <Search size={16} color="#5865f2" />
          <span className="chat-search-title">Resultados da Busca</span>
          <span className="chat-search-count-badge" data-testid="chat-search-count-badge">
            {total} {total === 1 ? 'resultado' : 'resultados'}
          </span>
        </div>
        <button
          type="button"
          className="chat-search-close-btn"
          onClick={onClose}
          title="Fechar busca (Esc)"
          data-testid="chat-search-close-btn"
        >
          <X size={16} />
        </button>
      </div>

      <div className="chat-search-filters">
        <button
          type="button"
          className={`chat-search-filter-chip ${!filterAttachment ? 'active' : ''}`}
          onClick={() => onToggleFilterAttachment(false)}
          data-testid="chat-search-filter-all"
        >
          Todos
        </button>
        <button
          type="button"
          className={`chat-search-filter-chip ${filterAttachment ? 'active' : ''}`}
          onClick={() => onToggleFilterAttachment(true)}
          data-testid="chat-search-filter-attachment"
        >
          <FileText size={12} />
          Com anexo
        </button>
      </div>

      <div className="chat-search-results-list" data-testid="chat-search-results-list">
        {loading ? (
          <div className="chat-search-status-state" data-testid="chat-search-loading">
            <Loader2 size={24} className="spinner-icon" />
            <span>Pesquisando mensagens...</span>
          </div>
        ) : results.length === 0 ? (
          <div className="chat-search-status-state" data-testid="chat-search-empty">
            <Search size={32} opacity={0.4} />
            <span>Nenhuma mensagem encontrada.</span>
          </div>
        ) : (
          results.map((msg) => {
            const initial = (msg.author_name || 'U').charAt(0).toUpperCase();
            return (
              <div
                key={msg.id}
                className="chat-search-item"
                onClick={() => onSelectResult(msg.id)}
                data-testid={`chat-search-item-${msg.id}`}
              >
                <div className="chat-search-item-header">
                  <div className="chat-search-avatar">{initial}</div>
                  <span className="chat-search-author">{msg.author_name}</span>
                  <span className="chat-search-timestamp">
                    {formatBrasiliaDateTime(msg.created_at)}
                  </span>
                </div>

                {msg.content && (
                  <div className="chat-search-item-body">
                    {renderHighlightedContent(msg.content, query)}
                  </div>
                )}

                {msg.attachment_url && (
                  <div className="chat-search-item-attachment">
                    <FileText size={12} />
                    <span>Anexo anexado</span>
                  </div>
                )}

                <button
                  type="button"
                  className="chat-search-jump-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectResult(msg.id);
                  }}
                  title="Ir para a mensagem no chat"
                  data-testid={`chat-search-jump-btn-${msg.id}`}
                >
                  <CornerDownRight size={12} />
                  <span>Ir para mensagem</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
