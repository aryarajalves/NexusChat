import React from 'react';
import {
  FileText,
  Download,
  Smile,
  MessageSquare,
} from 'lucide-react';

export function MessageAttachmentPreview({ msg, formatFileSize }) {
  if (!msg.attachment_url) return null;

  const isAudio =
    msg.attachment_type?.startsWith('audio/') ||
    /\.(mp3|ogg|wav|m4a|aac|opus)(\?.*)?$/i.test(msg.attachment_url || '');

  const isVideo =
    !isAudio &&
    (msg.attachment_type?.startsWith('video/') ||
      /\.(mp4|webm|mov|mkv)(\?.*)?$/i.test(msg.attachment_url || ''));

  const isImage =
    !isAudio &&
    !isVideo &&
    (msg.attachment_type?.startsWith('image/') ||
      /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(msg.attachment_url || ''));

  return (
    <div className="chat-attachment-container">
      {isImage ? (
        <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="chat-attachment-img-link">
          <img src={msg.attachment_url} alt="Anexo de imagem" className="chat-attachment-img" decoding="async" loading="lazy" />
        </a>
      ) : isVideo ? (
        <video src={msg.attachment_url} controls playsInline className="chat-attachment-video" />
      ) : isAudio ? (
        <audio src={msg.attachment_url} controls className="chat-attachment-audio" />
      ) : (
        <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="chat-attachment-file-card" download>
          <FileText size={24} className="attachment-file-icon" />
          <div className="attachment-file-info">
            <span className="attachment-filename">{msg.attachment_url.split('/').pop()}</span>
            <span className="attachment-filesize">{formatFileSize ? formatFileSize(msg.attachment_size) : ''}</span>
          </div>
          <Download size={16} className="attachment-download-icon" />
        </a>
      )}
    </div>
  );
}

export function MessageReactionsRow({ msg, channelId, onToggleReaction, onOpenEmojiPicker }) {
  return (
    <div className="message-reactions-row" data-testid={`message-reactions-${msg.id}`}>
      {(msg.reactions || []).map((r) => (
        <button
          key={r.emoji}
          type="button"
          className={`reaction-badge ${r.reacted_by_me ? 'active' : ''}`}
          onClick={() => onToggleReaction && onToggleReaction(channelId, msg.id, r.emoji)}
          title={r.reacted_by_me ? `Remover reação ${r.emoji}` : `Reagir com ${r.emoji}`}
          data-testid={`reaction-chip-${msg.id}-${r.emoji}`}
        >
          <span>{r.emoji}</span>
          <span className="reaction-badge-count">{r.count}</span>
        </button>
      ))}
      <button
        type="button"
        className="reaction-badge-add"
        onClick={onOpenEmojiPicker}
        title="Adicionar reação"
        data-testid={`add-reaction-btn-${msg.id}`}
      >
        <Smile size={14} />
      </button>
    </div>
  );
}

export function MessageThreadBadge({ thread, onOpenThread }) {
  if (!thread) return null;

  return (
    <div className="chat-thread-badge-wrap" data-testid={`thread-badge-wrap-${thread.root_message_id}`}>
      <div className="chat-thread-spine" aria-hidden="true" />
      <div
        className="chat-thread-card"
        onClick={() => onOpenThread && onOpenThread(thread.id)}
        title={`Abrir tópico: ${thread.name}`}
        data-testid={`open-thread-card-${thread.root_message_id}`}
        role="button"
        tabIndex={0}
      >
        <div className="chat-thread-card-header">
          <MessageSquare size={14} className="chat-thread-icon" />
          <span className="chat-thread-name">{thread.name}</span>
          <span className="chat-thread-count-link">
            {thread.message_count || 1} {thread.message_count === 1 ? 'mensagem' : 'mensagens'} ›
          </span>
        </div>
        {thread.last_message_content && (
          <div className="chat-thread-card-preview">
            <div className="chat-thread-preview-avatar-fallback">
              {(thread.last_message_author || 'U').charAt(0).toUpperCase()}
            </div>
            <span className="chat-thread-preview-author">{thread.last_message_author}</span>
            <span className="chat-thread-preview-text">{thread.last_message_content}</span>
          </div>
        )}
      </div>
    </div>
  );
}
