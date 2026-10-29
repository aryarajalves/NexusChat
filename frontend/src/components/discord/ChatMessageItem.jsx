import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Download,
  Smile,
  SmilePlus,
  Share2,
  Pencil,
  Trash2,
  Reply,
  MoreHorizontal,
  Copy,
  Pin,
} from 'lucide-react';
import { formatBrasiliaDateTime, renderContentWithMentions } from './chatUtils';
import EmojiPickerPopover from './EmojiPickerPopover';

const QUICK_EMOJIS = ['🀄', '😀', '❤️', '🔥', '👍', '🎉', '😂', '👀', '🚀', '⭐', '🙏', '✨', '👏', '😍', '🤔', '🥳', '🙌', '💯'];

export default function ChatMessageItem({
  msg,
  channelId,
  currentUserId,
  currentUserRole,
  currentUser,
  onEditMessage,
  onToggleReaction,
  onRequestForward,
  onRequestDelete,
  onRequestReply,
  onTogglePin,
  repliedMessage,
  onScrollToMessage,
  formatFileSize,
  addToast,
  members = [],
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingContent, setEditingContent] = useState(msg.content || '');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isFullEmojiPickerOpen, setIsFullEmojiPickerOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [popoverPlacement, setPopoverPlacement] = useState('bottom');
  const actionsRef = useRef(null);

  useEffect(() => {
    if (!isEmojiPickerOpen && !isMoreMenuOpen && !isFullEmojiPickerOpen) return;
    const handleClickOutside = (e) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) {
        setIsEmojiPickerOpen(false); setIsFullEmojiPickerOpen(false); setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEmojiPickerOpen, isMoreMenuOpen, isFullEmojiPickerOpen]);

  const toggleEmojiPicker = (e) => {
    e.stopPropagation();
    if (!isEmojiPickerOpen && e?.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      setPopoverPlacement(rect.top < 180 ? 'bottom' : 'top');
    }
    setIsMoreMenuOpen(false); setIsFullEmojiPickerOpen(false); setIsEmojiPickerOpen((prev) => !prev);
  };

  const toggleMoreMenu = (e) => {
    e.stopPropagation();
    if (!isMoreMenuOpen && e?.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      setPopoverPlacement(rect.top < 240 ? 'bottom' : 'top');
    }
    setIsEmojiPickerOpen(false); setIsFullEmojiPickerOpen(false); setIsMoreMenuOpen((prev) => !prev);
  };

  const handleCopyContent = async () => {
    try {
      if (msg.content && navigator.clipboard) {
        await navigator.clipboard.writeText(msg.content);
        if (addToast) addToast('Texto copiado para a área de transferência!', 'success');
      }
    } catch {
      // fallback
    }
    setIsMoreMenuOpen(false);
  };

  const initial = (msg.author_name || 'U').charAt(0).toUpperCase();
  const canDelete = msg.author_id === currentUserId || currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';
  const isAuthor = msg.author_id === currentUserId;
  const authorMember = members?.find((m) => m.user_id === msg.author_id);
  const roleColor = msg.author_role_color || authorMember?.role_color;
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

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditingContent(msg.content || '');
    setIsEmojiPickerOpen(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingContent(msg.content || '');
  };

  const handleSaveEdit = async () => {
    const trimmed = editingContent.trim();
    if (!trimmed) return;
    if (onEditMessage) {
      await onEditMessage(channelId, msg.id, trimmed);
    }
    setIsEditing(false);
  };

  const currentUserName = currentUser?.name || '';
  const isMentioned = Boolean(
    msg.content && (
      /@everyone\b/i.test(msg.content) ||
      /@here\b/i.test(msg.content) ||
      (currentUserName && new RegExp(`@${currentUserName}\\b`, 'i').test(msg.content))
    )
  );

  return (
    <div
      className={`chat-message-row ${isMentioned ? 'is-mentioned' : ''}`}
      id={`message-item-${msg.id}`}
      data-testid={`message-item-${msg.id}`}
    >
      {/* Citação / Referência de Resposta (Discord Style) */}
      {msg.reply_to_id && (
        <div
          className="chat-reply-reference"
          onClick={() => onScrollToMessage && onScrollToMessage(msg.reply_to_id)}
          title="Clique para ir até a mensagem original"
          data-testid={`reply-reference-${msg.id}`}
        >
          <div className="chat-reply-spine" />
          <div className="chat-reply-ref-avatar">
            {repliedMessage?.author_name ? repliedMessage.author_name.charAt(0).toUpperCase() : '?'}
          </div>
          <span className="chat-reply-ref-author">
            @{repliedMessage?.author_name || 'Usuário'}
          </span>
          <span className="chat-reply-ref-content">
            {repliedMessage
              ? (repliedMessage.content || (repliedMessage.attachment_url ? '[Anexo de mídia]' : ''))
              : 'Mensagem original excluída ou não disponível.'}
          </span>
        </div>
      )}

      <div className="chat-message-main-content">
        <div className="chat-author-avatar">{initial}</div>
        <div className="chat-message-body">
          <div className="chat-message-meta">
            <span
              className="chat-author-name"
              style={roleColor ? { color: roleColor, fontWeight: 600 } : {}}
              data-testid={`message-author-${msg.id}`}
            >
              {msg.author_name}
            </span>
            <span className="chat-timestamp-brasilia" data-testid={`message-timestamp-${msg.id}`}>
              {formatBrasiliaDateTime(msg.created_at)}
            </span>
            {msg.is_pinned && (
              <span className="chat-pinned-badge" title="Mensagem fixada" data-testid={`pinned-badge-${msg.id}`}>
                <Pin size={12} color="#f0b232" />
                <span>Fixada</span>
              </span>
            )}
          </div>

          {/* Edição Inline vs Exibição de Conteúdo */}
          {isEditing ? (
            <div className="message-edit-container" data-testid={`message-edit-box-${msg.id}`}>
              <textarea
                className="message-edit-input"
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit();
                  } else if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
                autoFocus
                data-testid={`edit-msg-input-${msg.id}`}
              />
              <div className="message-edit-actions">
                <span>
                  esc para <button type="button" className="message-edit-btn btn-cancel" onClick={handleCancelEdit} data-testid={`cancel-edit-btn-${msg.id}`}>cancelar</button> • enter para <button type="button" className="message-edit-btn btn-save" onClick={handleSaveEdit} data-testid={`save-edit-btn-${msg.id}`}>salvar</button>
                </span>
              </div>
            </div>
          ) : (
            msg.content && (
              <div className="chat-text-content" data-testid={`message-content-${msg.id}`}>
                {renderContentWithMentions(msg.content, currentUserName)}
                {msg.is_edited && (
                  <span className="chat-message-edited" data-testid={`message-edited-badge-${msg.id}`}>
                    (editado)
                  </span>
                )}
              </div>
            )
          )}

          {/* Renderização de Anexos */}
          {msg.attachment_url && (
            <div className="chat-attachment-wrapper">
              {isImage ? (
                <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="chat-attachment-img-link">
                  <img src={msg.attachment_url} alt="Anexo de imagem" className="chat-attachment-img" loading="lazy" />
                </a>
              ) : isVideo ? (
                <div className="chat-attachment-video-wrapper">
                  <video src={msg.attachment_url} controls playsInline className="chat-attachment-video" />
                </div>
              ) : isAudio ? (
                <div className="chat-attachment-audio-wrapper">
                  <audio src={msg.attachment_url} controls className="chat-attachment-audio" />
                </div>
              ) : (
                <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="chat-attachment-file-card" download>
                  <FileText size={24} className="attachment-file-icon" />
                  <div className="attachment-file-info">
                    <span className="attachment-filename">{msg.attachment_url.split('/').pop()}</span>
                    <span className="attachment-filesize">{formatFileSize(msg.attachment_size)}</span>
                  </div>
                  <Download size={16} className="attachment-download-icon" />
                </a>
              )}
            </div>
          )}

          {/* Linha de Reações com Emojis (Chips estilo Discord) */}
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
              onClick={toggleEmojiPicker}
              title="Adicionar reação"
              data-testid={`add-reaction-btn-${msg.id}`}
            >
              <Smile size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Barra de Ações ao Passar o Mouse (Hover) */}
      <div
        ref={actionsRef}
        className={`chat-message-actions ${isEmojiPickerOpen || isMoreMenuOpen || isFullEmojiPickerOpen ? 'has-open-picker' : ''}`}
        data-testid={`message-actions-bar-${msg.id}`}
      >
        <button
          type="button"
          className="message-action-btn"
          onClick={toggleEmojiPicker}
          title="Adicionar reação"
          data-testid={`hover-react-btn-${msg.id}`}
        >
          <Smile size={16} />
        </button>

        <button
          type="button"
          className="message-action-btn"
          onClick={() => onRequestReply && onRequestReply(msg)}
          title="Responder"
          data-testid={`hover-reply-btn-${msg.id}`}
        >
          <Reply size={15} />
        </button>

        <button
          type="button"
          className="message-action-btn"
          onClick={() => onRequestForward(msg)}
          title="Encaminhar"
          data-testid={`hover-forward-btn-${msg.id}`}
        >
          <Share2 size={15} />
        </button>

        {isAuthor && (
          <button
            type="button"
            className="message-action-btn"
            onClick={handleStartEdit}
            title="Editar"
            data-testid={`hover-edit-btn-${msg.id}`}
          >
            <Pencil size={15} />
          </button>
        )}

        {canDelete && (
          <button
            type="button"
            className="message-action-btn delete-btn"
            onClick={() => onRequestDelete(msg)}
            title="Apagar mensagem"
            data-testid={`delete-msg-btn-${msg.id}`}
          >
            <Trash2 size={15} />
          </button>
        )}

        {/* Botão de 3 Pontinhos (Mais Opções) */}
        <button
          type="button"
          className={`message-action-btn ${isMoreMenuOpen ? 'active' : ''}`}
          onClick={toggleMoreMenu}
          title="Mais opções"
          data-testid={`hover-more-btn-${msg.id}`}
        >
          <MoreHorizontal size={16} />
        </button>

        {/* Popover Rápido de Emojis */}
        {isEmojiPickerOpen && (
          <div
            className={`quick-emoji-popover placement-${popoverPlacement}`}
            data-testid={`quick-emoji-popover-${msg.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="quick-emoji-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onToggleReaction) onToggleReaction(channelId, msg.id, emoji);
                  setIsEmojiPickerOpen(false);
                }}
                data-testid={`quick-emoji-item-${emoji}`}
                title={`Reagir com ${emoji}`}
              >
                {emoji}
              </button>
            ))}
            <button
              type="button"
              className="quick-emoji-btn quick-emoji-more-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsEmojiPickerOpen(false);
                setIsFullEmojiPickerOpen(true);
              }}
              data-testid={`open-full-emoji-picker-${msg.id}`}
              title="Mais emojis..."
            >
              <SmilePlus size={16} />
            </button>
          </div>
        )}

        {/* Popover Completo de Emojis para Reações */}
        {isFullEmojiPickerOpen && (
          <EmojiPickerPopover
            placement={popoverPlacement === 'bottom' ? 'reaction-bottom' : 'reaction'}
            onSelectEmoji={(emoji) => {
              if (onToggleReaction) onToggleReaction(channelId, msg.id, emoji);
              setIsFullEmojiPickerOpen(false);
            }}
            onClose={() => setIsFullEmojiPickerOpen(false)}
            testId={`full-emoji-picker-${msg.id}`}
            itemTestIdPrefix="reaction-emoji-select"
          />
        )}

        {/* Menu Popover dos 3 Pontinhos (Mais Opções) */}
        {isMoreMenuOpen && (
          <div
            className={`message-more-popover placement-${popoverPlacement}`}
            data-testid={`message-more-menu-${msg.id}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="more-menu-item"
              onClick={() => {
                setIsMoreMenuOpen(false);
                if (onRequestReply) onRequestReply(msg);
              }}
              data-testid={`more-reply-action-${msg.id}`}
            >
              <Reply size={15} />
              <span>Responder</span>
            </button>

            {msg.content && (
              <button
                type="button"
                className="more-menu-item"
                onClick={handleCopyContent}
                data-testid={`more-copy-action-${msg.id}`}
              >
                <Copy size={15} />
                <span>Copiar Texto</span>
              </button>
            )}

            {onTogglePin && (
              <button
                type="button"
                className="more-menu-item"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onTogglePin(msg);
                }}
                data-testid={`more-pin-action-${msg.id}`}
              >
                <Pin size={15} color="#f0b232" />
                <span>{msg.is_pinned ? 'Desafixar Mensagem' : 'Fixar Mensagem'}</span>
              </button>
            )}

            <button
              type="button"
              className="more-menu-item"
              onClick={() => {
                setIsMoreMenuOpen(false);
                onRequestForward(msg);
              }}
              data-testid={`more-forward-action-${msg.id}`}
            >
              <Share2 size={15} />
              <span>Encaminhar Mensagem</span>
            </button>

            {isAuthor && (
              <button
                type="button"
                className="more-menu-item"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  handleStartEdit();
                }}
                data-testid={`more-edit-action-${msg.id}`}
              >
                <Pencil size={15} />
                <span>Editar Mensagem</span>
              </button>
            )}

            {canDelete && (
              <button
                type="button"
                className="more-menu-item more-menu-danger"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onRequestDelete(msg);
                }}
                data-testid={`more-delete-action-${msg.id}`}
              >
                <Trash2 size={15} />
                <span>Excluir Mensagem</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
