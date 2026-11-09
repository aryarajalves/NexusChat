import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  FileText,
} from 'lucide-react';
import { formatBrasiliaDateTime, renderContentWithMentions } from './chatUtils';

export default function ThreadSidePanel({
  isOpen,
  onClose,
  threadDetail,
  loading = false,
  onSendThreadMessage,
  currentUserId,
  currentUser,
  members = [],
}) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const thread = threadDetail;

  const getAuthorAvatar = (authorId, fallbackUrl) => {
    if (authorId === currentUserId) return currentUser?.avatar_url || fallbackUrl;
    const m = members?.find((mem) => mem.user_id === authorId || mem.id === authorId);
    return m?.avatar_url || fallbackUrl;
  };

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, thread?.messages?.length]);

  if (!isOpen || !thread) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    const text = content.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      await onSendThreadMessage(thread.id, text);
      setContent('');
    } finally {
      setSending(false);
    }
  };

  const rootMsg = thread.root_message;

  return (
    <aside
      className="thread-side-panel"
      data-testid="thread-side-panel"
      role="region"
      aria-label={`Tópico: ${thread.name}`}
    >
      {/* Topbar do Painel */}
      <div className="thread-panel-header">
        <div className="thread-panel-header-title">
          <MessageSquare size={18} className="chat-thread-icon" />
          <span className="thread-panel-title-text" title={thread.name}>
            {thread.name}
          </span>
        </div>
        <div className="thread-panel-header-actions">
          <button
            type="button"
            className="thread-panel-action-btn"
            onClick={onClose}
            title="Fechar tópico (Esc)"
            data-testid="close-thread-panel-btn"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Corpo com Mensagem Raiz e Respostas */}
      <div className="thread-panel-body" data-testid="thread-panel-body">
        {loading ? (
          <div className="pinned-empty-state" data-testid="thread-loading">
            <Loader2 size={24} className="spinner-icon" />
            <span>Carregando tópico...</span>
          </div>
        ) : (
          <>
            {/* Header Hero com Ícone e Título do Tópico */}
            <div className="thread-panel-hero">
              <div className="thread-hero-icon-wrap">
                <MessageSquare size={26} />
              </div>
              <h2 className="thread-hero-title">{thread.name}</h2>
              <p className="thread-hero-subtitle">
                Iniciada por <span className="thread-hero-creator">{thread.creator_name || 'Usuário'}</span>
              </p>
            </div>

            {/* Mensagem Raiz Original Fixada */}
            {rootMsg && (
              <div className="thread-msg-item root-pinned-msg" data-testid="thread-root-message">
                {getAuthorAvatar(rootMsg.author_id, rootMsg.author_avatar_url) ? (
                  <img
                    src={getAuthorAvatar(rootMsg.author_id, rootMsg.author_avatar_url)}
                    alt={rootMsg.author_name}
                    className="thread-msg-avatar"
                  />
                ) : (
                  <div className="thread-msg-avatar-fallback">
                    {(rootMsg.author_name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="thread-msg-content-wrap">
                  <div className="thread-msg-header">
                    <span className="thread-msg-author">{rootMsg.author_name}</span>
                    <span className="thread-msg-time">
                      {formatBrasiliaDateTime(rootMsg.created_at)}
                    </span>
                  </div>
                  <div className="thread-msg-text">{renderContentWithMentions(rootMsg.content)}</div>
                  {rootMsg.attachment_url && (
                    <div style={{ marginTop: '6px' }}>
                      <a
                        href={rootMsg.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        className="chat-attachment-file-card"
                        style={{ padding: '6px 10px', fontSize: '12px' }}
                      >
                        <FileText size={14} />
                        <span>{rootMsg.attachment_url.split('/').pop()}</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Divisor de Data / Começo das Respostas */}
            <div className="thread-divider">
              <span>{formatBrasiliaDateTime(thread.created_at).split(',')[0]}</span>
            </div>

            {/* Lista de Mensagens da Thread */}
            <div className="thread-messages-list">
              {(thread.messages || []).map((tMsg) => (
                <div key={tMsg.id} className="thread-msg-item" data-testid={`thread-msg-${tMsg.id}`}>
                  {getAuthorAvatar(tMsg.author_id, tMsg.author_avatar_url) ? (
                    <img
                      src={getAuthorAvatar(tMsg.author_id, tMsg.author_avatar_url)}
                      alt={tMsg.author_name}
                      className="thread-msg-avatar"
                    />
                  ) : (
                    <div className="thread-msg-avatar-fallback">
                      {(tMsg.author_name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="thread-msg-content-wrap">
                    <div className="thread-msg-header">
                      <span className="thread-msg-author">{tMsg.author_name}</span>
                      <span className="thread-msg-time">
                        {formatBrasiliaDateTime(tMsg.created_at)}
                      </span>
                    </div>
                    <div className="thread-msg-text">{renderContentWithMentions(tMsg.content)}</div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </>
        )}
      </div>

      {/* Input de Envio Dentro do Tópico */}
      <div className="thread-panel-footer">
        <form onSubmit={handleSend} className="thread-input-box">
          <input
            type="text"
            className="thread-input-field"
            placeholder={`Conversar em "${thread.name}"`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={sending || loading}
            autoFocus
            data-testid="thread-message-input"
          />
          <button
            type="submit"
            className="thread-send-btn"
            disabled={!content.trim() || sending || loading}
            title="Enviar mensagem no tópico"
            data-testid="thread-send-btn"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </aside>
  );
}
