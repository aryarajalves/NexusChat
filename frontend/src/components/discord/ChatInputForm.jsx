import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Paperclip,
  X,
  Loader2,
  Smile,
  Reply,
  Mic,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import ChatPendingAttachment from './ChatPendingAttachment';
import ChatVoiceRecorder from './ChatVoiceRecorder';
import EmojiPickerPopover from './EmojiPickerPopover';
import MentionAutocompletePopover from './MentionAutocompletePopover';
import { formatFileSize } from './chatUtils';

export default function ChatInputForm({
  channel,
  replyingTo,
  onCancelReply,
  onSendMessage,
  onUploadAttachment,
  onSendTyping,
  typingUsers = [],
  droppedFile = null,
  onClearDroppedFile,
  externalInputRef,
  members = [],
}) {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isInputEmojiOpen, setIsInputEmojiOpen] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);

  const { addToast } = useToast();
  const fileInputRef = useRef(null);
  const internalInputRef = useRef(null);
  const textInputRef = externalInputRef || internalInputRef;
  const inputEmojiRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Fecha o seletor de emojis se clicar fora dele
  useEffect(() => {
    if (!isInputEmojiOpen) return;
    const handleClickOutside = (e) => {
      if (inputEmojiRef.current && !inputEmojiRef.current.contains(e.target)) {
        setIsInputEmojiOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isInputEmojiOpen]);

  // Limpa a URL do blob do preview quando o componente desmonta ou quando troca o arquivo
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) {
        try { URL.revokeObjectURL(pendingPreviewUrl); } catch (_) {}
      }
    };
  }, [pendingPreviewUrl]);

  // Foca no input quando o usuário inicia uma resposta (Reply)
  useEffect(() => {
    if (replyingTo) {
      textInputRef.current?.focus();
    }
  }, [replyingTo, textInputRef]);

  // Trata arquivos soltos via Drag & Drop na área de chat
  useEffect(() => {
    if (droppedFile) {
      processSelectedFile(droppedFile);
      if (onClearDroppedFile) onClearDroppedFile();
    }
  }, [droppedFile]);

  const mentionOptions = useMemo(() => {
    const list = [
      { id: 'everyone', name: 'everyone', description: 'Notifica todas as pessoas neste canal', isSpecial: true },
      { id: 'here', name: 'here', description: 'Notifica todos os membros online neste canal', isSpecial: true },
    ];
    const memberItems = (members || []).map((m) => {
      const displayName = m.nickname || m.name || 'Usuário';
      return { id: m.user_id || m.id, name: displayName, rawName: m.name, role: m.role, isSpecial: false };
    });
    const all = [...list, ...memberItems];
    if (!mentionQuery) return all;
    const q = mentionQuery.toLowerCase();
    return all.filter((item) => item.name.toLowerCase().includes(q) || (item.rawName && item.rawName.toLowerCase().includes(q)));
  }, [members, mentionQuery]);

  const checkMentionTrigger = (val, cursorPos) => {
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastAtPos = textBeforeCursor.lastIndexOf('@');
    if (lastAtPos !== -1) {
      const charBeforeAt = lastAtPos > 0 ? textBeforeCursor[lastAtPos - 1] : ' ';
      if (charBeforeAt === ' ' || charBeforeAt === '\n' || lastAtPos === 0) {
        const query = textBeforeCursor.slice(lastAtPos + 1);
        if (!query.includes(' ') && !query.includes('\n')) {
          setMentionStartIndex(lastAtPos);
          setMentionQuery(query);
          setIsMentionOpen(true);
          setSelectedMentionIndex(0);
          return;
        }
      }
    }
    setIsMentionOpen(false);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart ?? val.length;
    setInputText(val);
    checkMentionTrigger(val, cursorPos);
    if (onSendTyping) {
      if (!typingTimeoutRef.current) {
        onSendTyping();
      } else {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        typingTimeoutRef.current = null;
      }, 2500);
    }
  };

  const handleSelectMention = (item) => {
    const cursorPos = textInputRef.current?.selectionStart ?? inputText.length;
    const beforeMention = inputText.slice(0, mentionStartIndex);
    const afterCursor = inputText.slice(cursorPos);
    const mentionText = `@${item.name} `;
    const newText = `${beforeMention}${mentionText}${afterCursor}`;
    setInputText(newText);
    setIsMentionOpen(false);

    setTimeout(() => {
      if (textInputRef.current) {
        const newCursorPos = beforeMention.length + mentionText.length;
        textInputRef.current.focus();
        textInputRef.current.setSelectionRange?.(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (isMentionOpen && mentionOptions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev + 1) % mentionOptions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex((prev) => (prev - 1 + mentionOptions.length) % mentionOptions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const safeIdx = Math.min(selectedMentionIndex, mentionOptions.length - 1);
        handleSelectMention(mentionOptions[safeIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsMentionOpen(false);
        return;
      }
    }
  };

  const processSelectedFile = (file) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      addToast('O arquivo excede o limite máximo permitido de 50 MB.', 'error');
      return;
    }
    if (pendingPreviewUrl) {
      try { URL.revokeObjectURL(pendingPreviewUrl); } catch (_) {}
    }
    setPendingFile(file);
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      try {
        const url = URL.createObjectURL(file);
        setPendingPreviewUrl(url);
      } catch (_) {
        setPendingPreviewUrl(null);
      }
    } else {
      setPendingPreviewUrl(null);
    }
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 50);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = typeof items[i].getAsFile === 'function' ? items[i].getAsFile() : items[i];
          if (file) {
            processSelectedFile(file);
            return;
          }
        }
      }
    }
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  const handleRemovePendingFile = () => {
    if (pendingPreviewUrl) {
      try { URL.revokeObjectURL(pendingPreviewUrl); } catch (_) {}
    }
    setPendingFile(null);
    setPendingPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if ((!trimmed && !pendingFile) || isSending) return;

    try {
      setIsSending(true);
      let attachmentData = null;

      if (pendingFile && onUploadAttachment) {
        setIsUploading(true);
        attachmentData = await onUploadAttachment(pendingFile);
        setIsUploading(false);
      }

      await onSendMessage({
        content: trimmed,
        attachment_url: attachmentData?.attachment_url,
        attachment_type: attachmentData?.attachment_type,
        attachment_size: attachmentData?.attachment_size,
        reply_to_id: replyingTo?.id || null,
      });

      setInputText('');
      if (onCancelReply) onCancelReply();
      if (pendingPreviewUrl) {
        try { URL.revokeObjectURL(pendingPreviewUrl); } catch (_) {}
      }
      setPendingFile(null);
      setPendingPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      addToast(err.message || 'Erro ao enviar mensagem.', 'error');
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const handleFinishVoiceRecording = async (audioFile) => {
    setIsRecordingVoice(false);
    try {
      setIsUploading(true);
      let attachmentData = null;

      if (onUploadAttachment) {
        attachmentData = await onUploadAttachment(audioFile);
      }

      await onSendMessage({
        content: '',
        attachment_url: attachmentData?.attachment_url,
        attachment_type: attachmentData?.attachment_type || audioFile.type || 'audio/webm',
        attachment_size: attachmentData?.attachment_size || audioFile.size,
        reply_to_id: replyingTo?.id || null,
      });

      if (onCancelReply) onCancelReply();
    } catch (err) {
      addToast(err.message || 'Erro ao enviar mensagem de voz.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="chat-input-wrapper">
      {/* Banner de Resposta a Mensagem Específica */}
      {replyingTo && (
        <div className="chat-reply-banner" data-testid="chat-reply-banner">
          <div className="chat-reply-banner-left">
            <Reply size={14} className="chat-reply-banner-icon" />
            <span className="chat-reply-banner-text">
              Respondendo a <strong>{replyingTo.author_name}</strong>
            </span>
            <span className="chat-reply-banner-preview">
              {replyingTo.content || (replyingTo.attachment_url ? '[Anexo]' : '')}
            </span>
          </div>
          <button
            type="button"
            className="chat-reply-close-btn"
            onClick={onCancelReply}
            title="Cancelar resposta"
            data-testid="cancel-reply-btn"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Indicador de Digitação */}
      <div className="chat-typing-status" data-testid="chat-typing-status">
        {typingUsers.length > 0 && (
          <span>
            <strong>{typingUsers.join(', ')}</strong> {typingUsers.length === 1 ? 'está' : 'estão'} digitando...
          </span>
        )}
      </div>

      {/* Prévia de Anexo Pendente */}
      <ChatPendingAttachment
        pendingFile={pendingFile}
        pendingPreviewUrl={pendingPreviewUrl}
        formatFileSize={formatFileSize}
        onRemovePendingFile={handleRemovePendingFile}
      />

      {/* Popover de Emojis */}
      {isInputEmojiOpen && (
        <EmojiPickerPopover
          placement="input"
          onSelectEmoji={(emoji) => {
            setInputText((prev) => prev + emoji);
            setIsInputEmojiOpen(false);
            textInputRef.current?.focus();
          }}
          onClose={() => setIsInputEmojiOpen(false)}
          testId="chat-input-emoji-picker"
          itemTestIdPrefix="input-emoji-select"
        />
      )}

      {/* Popover de Autocompletar Menções (@) */}
      {isMentionOpen && mentionOptions.length > 0 && (
        <MentionAutocompletePopover
          query={mentionQuery}
          members={members}
          selectedIndex={Math.min(selectedMentionIndex, mentionOptions.length - 1)}
          onSelect={handleSelectMention}
        />
      )}

      {/* Formulário de Envio OU Gravador de Voz Ativo */}
      {isRecordingVoice ? (
        <ChatVoiceRecorder
          onCancel={() => setIsRecordingVoice(false)}
          onFinish={handleFinishVoiceRecording}
        />
      ) : (
        <form onSubmit={handleSubmit} className="chat-input-form">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            data-testid="file-upload-input"
          />

          <button
            type="button"
            className="chat-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Anexar arquivo ou mídia (máx 50MB)"
            disabled={isSending || isUploading}
            data-testid="chat-attach-btn"
          >
            <Paperclip size={20} />
          </button>

          <input
            type="text"
            ref={textInputRef}
            className="chat-text-input"
            placeholder={
              pendingFile
                ? `Adicionar uma legenda para ${pendingFile.name}...`
                : channel?.is_dm
                ? `Conversar com @${channel.name}`
                : `Conversar em #${channel?.name || 'geral'}`
            }
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={isSending || isUploading}
            maxLength={2000}
            data-testid="chat-message-input"
          />

          <button
            type="button"
            className="chat-emoji-btn"
            onClick={() => setIsInputEmojiOpen((prev) => !prev)}
            title="Escolha um emoji"
            disabled={isSending || isUploading}
            data-testid="chat-input-emoji-btn"
          >
            <Smile size={20} />
          </button>

          {/* Botão de Gravação de Áudio / Mensagem de Voz */}
          <button
            type="button"
            className="chat-mic-btn"
            onClick={() => setIsRecordingVoice(true)}
            title="Gravar mensagem de voz"
            disabled={isSending || isUploading}
            data-testid="chat-voice-record-btn"
          >
            <Mic size={20} />
          </button>

          <button
            type="submit"
            className="chat-send-btn"
            disabled={(!inputText.trim() && !pendingFile) || isSending || isUploading}
            title="Enviar mensagem"
            data-testid="chat-send-btn"
          >
            {isSending || isUploading ? <Loader2 size={18} className="spinner-icon" /> : <Send size={18} />}
          </button>
        </form>
      )}
    </div>
  );
}
