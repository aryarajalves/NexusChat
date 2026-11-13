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
import { useServerEmojis } from '../../context/ServerEmojisContext';
import { formatFileSize } from './chatUtils';
import { useChatMentions } from './useChatMentions';

export default function ChatInputForm({
  channel,
  currentUser,
  replyingTo,
  onCancelReply,
  onSendMessage,
  onUploadAttachment,
  onSendTyping,
  typingUsers = [],
  droppedFile = null,
  onClearDroppedFile,
  droppedFiles = [],
  onClearDroppedFiles,
  externalInputRef,
  members = [],
}) {
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isInputEmojiOpen, setIsInputEmojiOpen] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  const { addToast } = useToast();
  const fileInputRef = useRef(null);
  const internalInputRef = useRef(null);
  const textInputRef = externalInputRef || internalInputRef;
  const inputEmojiRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const {
    isMentionOpen,
    setIsMentionOpen,
    mentionQuery,
    mentionOptions,
    selectedMentionIndex,
    checkMentionTrigger,
    handleSelectMention,
    handleMentionKeyDown,
  } = useChatMentions({ members, inputText, setInputText, textInputRef });

  const pendingFile = pendingFiles[0]?.file || null;
  const pendingPreviewUrl = pendingFiles[0]?.previewUrl || null;

  const { emojis: customEmojis } = useServerEmojis();

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

  // Auto-resize do textarea conforme o usuário digita ou cola múltiplos parágrafos
  useEffect(() => {
    const el = textInputRef.current;
    if (!el || el.tagName !== 'TEXTAREA') return;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 180);
    el.style.height = `${Math.max(newHeight, 24)}px`;
  }, [inputText, textInputRef]);

  // Trata arquivos soltos via Drag & Drop na área de chat
  useEffect(() => {
    const list = droppedFiles?.length > 0 ? droppedFiles : (droppedFile ? [droppedFile] : []);
    if (list.length > 0) {
      processSelectedFiles(list);
      if (onClearDroppedFiles) onClearDroppedFiles();
      if (onClearDroppedFile) onClearDroppedFile();
    }
  }, [droppedFiles, droppedFile]);

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

  const handleKeyDown = (e) => {
    if (handleMentionKeyDown(e)) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isSuperAdmin = currentUser?.role === 'superadmin';

  const processSelectedFiles = (incomingFiles) => {
    if (!incomingFiles || incomingFiles.length === 0) return;
    const validItems = [];
    for (const file of incomingFiles) {
      if (!isSuperAdmin && file.size > 50 * 1024 * 1024) {
        addToast('O arquivo excede o limite máximo permitido de 50 MB.', 'error');
        continue;
      }
      let previewUrl = null;
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        try { previewUrl = URL.createObjectURL(file); } catch (_) {}
      }
      validItems.push({ file, previewUrl, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
    }
    if (validItems.length > 0) {
      setPendingFiles((prev) => [...prev, ...validItems]);
      setTimeout(() => textInputRef.current?.focus(), 50);
    }
  };

  const processSelectedFile = (file) => {
    if (file) processSelectedFiles([file]);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) processSelectedFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = (e) => {
    const pasteFiles = [];
    const items = e.clipboardData?.items;
    if (items && items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = typeof items[i].getAsFile === 'function' ? items[i].getAsFile() : items[i];
          if (file) pasteFiles.push(file);
        }
      }
    }
    if (pasteFiles.length === 0 && e.clipboardData?.files?.length > 0) {
      pasteFiles.push(...Array.from(e.clipboardData.files));
    }
    if (pasteFiles.length > 0) {
      processSelectedFiles(pasteFiles);
    }
  };

  const handleRemoveFile = (index) => {
    setPendingFiles((prev) => {
      const target = prev[index];
      if (target?.previewUrl) {
        try { URL.revokeObjectURL(target.previewUrl); } catch (_) {}
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleRemovePendingFile = () => {
    pendingFiles.forEach((item) => {
      if (item.previewUrl) {
        try { URL.revokeObjectURL(item.previewUrl); } catch (_) {}
      }
    });
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if ((!trimmed && pendingFiles.length === 0) || isSending) return;

    try {
      setIsSending(true);
      let uploadedAttachments = [];

      if (pendingFiles.length > 0 && onUploadAttachment) {
        setIsUploading(true);
        // Upload concorrente/paralelo via Promise.all para máxima velocidade
        uploadedAttachments = await Promise.all(
          pendingFiles.map((item) => onUploadAttachment(item.file))
        );
        setIsUploading(false);
      }

      if (uploadedAttachments.length > 0) {
        // Envia primeira mensagem com texto/legenda + 1ª mídia
        const first = uploadedAttachments[0];
        await onSendMessage({
          content: trimmed,
          attachment_url: first?.attachment_url,
          attachment_type: first?.attachment_type,
          attachment_size: first?.attachment_size,
          reply_to_id: replyingTo?.id || null,
        });

        // Envia demais mídias simultâneas consecutivamente
        for (let i = 1; i < uploadedAttachments.length; i++) {
          const extra = uploadedAttachments[i];
          await onSendMessage({
            content: '',
            attachment_url: extra?.attachment_url,
            attachment_type: extra?.attachment_type,
            attachment_size: extra?.attachment_size,
          });
        }
      } else {
        await onSendMessage({
          content: trimmed,
          reply_to_id: replyingTo?.id || null,
        });
      }

      setInputText('');
      if (onCancelReply) onCancelReply();
      handleRemovePendingFile();
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

      {/* Prévia de Anexo Pendente (Suporte a Múltiplas Mídias) */}
      <ChatPendingAttachment
        pendingFiles={pendingFiles}
        pendingFile={pendingFile}
        pendingPreviewUrl={pendingPreviewUrl}
        formatFileSize={formatFileSize}
        onRemoveFile={handleRemoveFile}
        onRemovePendingFile={handleRemovePendingFile}
        onAddMoreFiles={() => fileInputRef.current?.click()}
      />

      {/* Popover de Emojis */}
      {isInputEmojiOpen && (
        <EmojiPickerPopover
          placement="input"
          customEmojis={customEmojis}
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
            multiple
            data-testid="file-upload-input"
          />

          <button
            type="button"
            className="chat-attach-btn"
            onClick={() => fileInputRef.current?.click()}
            title={isSuperAdmin ? "Anexar arquivos ou mídias (Múltiplos / Ilimitado)" : "Anexar arquivos ou mídias (Múltiplos / máx 50MB)"}
            disabled={isSending || isUploading}
            data-testid="chat-attach-btn"
          >
            <Paperclip size={20} />
          </button>

          <textarea
            ref={textInputRef}
            className="chat-text-input"
            rows={1}
            placeholder={
              pendingFiles.length === 1
                ? `Adicionar uma legenda para ${pendingFiles[0].file.name}...`
                : pendingFiles.length > 1
                ? `Adicionar legenda para as ${pendingFiles.length} mídias selecionadas...`
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
            disabled={(!inputText.trim() && pendingFiles.length === 0) || isSending || isUploading}
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
