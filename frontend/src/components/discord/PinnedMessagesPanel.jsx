import React, { useState, useEffect } from 'react';
import { Pin, X, CornerDownRight, Trash2, FileText, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatBrasiliaDateTime } from './chatUtils';

const PAGE_SIZE = 20;

export default function PinnedMessagesPanel({
  isOpen,
  onClose,
  channel,
  pinnedMessages = [],
  loading = false,
  onScrollToMessage,
  onTogglePin,
}) {
  const [currentPage, setCurrentPage] = useState(1);

  // Reseta para a primeira página sempre que o canal for alterado
  useEffect(() => {
    setCurrentPage(1);
  }, [channel?.id, channel?.is_dm]);

  if (!isOpen) return null;

  const totalPages = Math.ceil(pinnedMessages.length / PAGE_SIZE) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedMessages = pinnedMessages.slice(startIndex, startIndex + PAGE_SIZE);

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
          paginatedMessages.map((msg) => {
            const initial = (msg.author_name || 'U').charAt(0).toUpperCase();

            const isImage =
              msg.attachment_type?.startsWith('image/') ||
              /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(msg.attachment_url || '');
            const isAudio =
              msg.attachment_type?.startsWith('audio/') ||
              /\.(mp3|ogg|wav|m4a|aac|opus)(\?.*)?$/i.test(msg.attachment_url || '');
            const isVideo =
              !isAudio &&
              (msg.attachment_type?.startsWith('video/') ||
                /\.(mp4|webm|mov|mkv)(\?.*)?$/i.test(msg.attachment_url || ''));

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

                {/* Renderização rica de mídia fixada */}
                {msg.attachment_url && (
                  <div className="pinned-card-media-wrapper" data-testid={`pinned-media-${msg.id}`}>
                    {isImage ? (
                      <img
                        src={msg.attachment_url}
                        alt="Mídia fixada"
                        className="pinned-media-image"
                        onClick={() => window.open(msg.attachment_url, '_blank')}
                        title="Clique para abrir imagem original"
                      />
                    ) : isVideo ? (
                      <video
                        src={msg.attachment_url}
                        controls
                        className="pinned-media-video"
                      />
                    ) : isAudio ? (
                      <audio
                        src={msg.attachment_url}
                        controls
                        className="pinned-media-audio"
                      />
                    ) : (
                      <a
                        href={msg.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pinned-card-attachment"
                        title="Abrir anexo"
                      >
                        <FileText size={12} />
                        <span>Anexo</span>
                      </a>
                    )}
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

      {/* Barra de Paginação (20 por página) */}
      {totalPages > 1 && (
        <div className="pinned-pagination-bar" data-testid="pinned-pagination-bar">
          <button
            type="button"
            className="pinned-page-nav-btn"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
            data-testid="pinned-prev-page-btn"
            title="Página anterior"
          >
            <ChevronLeft size={14} />
            <span>Anterior</span>
          </button>
          <span className="pinned-page-indicator" data-testid="pinned-page-indicator">
            Página {safePage} de {totalPages}
          </span>
          <button
            type="button"
            className="pinned-page-nav-btn"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            data-testid="pinned-next-page-btn"
            title="Próxima página"
          >
            <span>Próxima</span>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
