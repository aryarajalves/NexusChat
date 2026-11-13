// VoiceChannelChatSidebar.jsx - Painel Lateral de Bate-Papo de Texto da Call (Estilo Discord)
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Paperclip, Loader2, Sparkles, UploadCloud, FileText } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { formatBrasiliaDateTime, formatFileSize } from './chatUtils';
import VoiceChatAttachmentPreview from './VoiceChatAttachmentPreview';
import '../../styles/discord-voice-chat.css';

function renderTextWithLinks(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return (
        <a key={index} href={href} target="_blank" rel="noopener noreferrer">
          {part}
        </a>
      );
    }
    return part;
  });
}

function formatMessageTime(dateString) {
  return formatBrasiliaDateTime(dateString);
}

export default function VoiceChannelChatSidebar({ channel, currentUser, token, onClose }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  let addToast = () => {};
  try {
    const toastCtx = useToast();
    if (toastCtx?.addToast) addToast = toastCtx.addToast;
  } catch {}

  const authToken = token || localStorage.getItem('auth_token') || localStorage.getItem('token') || '';

  // Limpa URLs de preview criadas ao desmontar
  useEffect(() => {
    return () => {
      pendingFiles.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, []);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const fetchMessages = async () => {
    if (!channel?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/discord/channels/${channel.id}/messages`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data) ? data : []);
      }
    } catch {
      // Ignora erro de rede em background
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [channel?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Polling leve para manter chat da call sincronizado em tempo real entre os participantes
  useEffect(() => {
    if (!channel?.id) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/discord/channels/${channel.id}/messages?limit=30`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setMessages((prev) => {
              if (data.length !== prev.length || (data.length > 0 && data[data.length - 1]?.id !== prev[prev.length - 1]?.id)) {
                return data;
              }
              return prev;
            });
          }
        }
      } catch {}
    }, 3500);

    return () => clearInterval(interval);
  }, [channel?.id, authToken]);

  const addFilesToPending = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const newItems = [];
    for (const file of fileList) {
      if (file.size > 50 * 1024 * 1024) {
        addToast(`O arquivo "${file.name}" excede o limite de 50 MB.`, 'warning');
        continue;
      }
      const isMedia = file.type?.startsWith('image/') || file.type?.startsWith('video/');
      const previewUrl = isMedia ? URL.createObjectURL(file) : null;
      newItems.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        previewUrl,
      });
    }
    if (newItems.length > 0) {
      setPendingFiles((prev) => [...prev, ...newItems]);
    }
  };

  const handleRemovePendingFile = (idToRemove) => {
    setPendingFiles((prev) => {
      const target = prev.find((item) => item.id === idToRemove);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== idToRemove);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearAllPendingFiles = () => {
    pendingFiles.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    addFilesToPending(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag and Drop Handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer?.files || []);
    addFilesToPending(files);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const cleanContent = inputText.trim();
    if (!cleanContent && pendingFiles.length === 0) return;
    if (!channel?.id) return;

    setSending(true);

    try {
      let uploadedAttachments = [];
      if (pendingFiles.length > 0) {
        setUploading(true);
        const uploadPromises = pendingFiles.map(async (item) => {
          const formData = new FormData();
          formData.append('file', item.file);
          const uploadRes = await fetch(`/api/v1/discord/channels/${channel.id}/attachments`, {
            method: 'POST',
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
            body: formData,
          });

          if (!uploadRes.ok) {
            const errData = await uploadRes.json().catch(() => ({}));
            throw new Error(errData.detail || `Falha ao enviar o arquivo "${item.file.name}".`);
          }

          const uploadData = await uploadRes.json();
          return {
            attachment_url: uploadData.attachment_url || uploadData.url,
            attachment_type: uploadData.attachment_type || item.file.type,
            attachment_size: uploadData.attachment_size || item.file.size,
          };
        });

        uploadedAttachments = await Promise.all(uploadPromises);
        setUploading(false);
      }

      if (uploadedAttachments.length > 0) {
        // Envia primeira mensagem com a legenda + 1ª mídia
        const first = uploadedAttachments[0];
        const resFirst = await fetch(`/api/v1/discord/channels/${channel.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            content: cleanContent,
            attachment_url: first.attachment_url,
            attachment_type: first.attachment_type,
            attachment_size: first.attachment_size,
          }),
        });

        if (resFirst.ok) {
          const firstMsg = await resFirst.json();
          setMessages((prev) => [...prev, firstMsg]);
        }

        // Envia as demais mídias consecutivamente em sequência
        for (let i = 1; i < uploadedAttachments.length; i++) {
          const extra = uploadedAttachments[i];
          const resExtra = await fetch(`/api/v1/discord/channels/${channel.id}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            body: JSON.stringify({
              content: '',
              attachment_url: extra.attachment_url,
              attachment_type: extra.attachment_type,
              attachment_size: extra.attachment_size,
            }),
          });
          if (resExtra.ok) {
            const extraMsg = await resExtra.json();
            setMessages((prev) => [...prev, extraMsg]);
          }
        }
      } else {
        const res = await fetch(`/api/v1/discord/channels/${channel.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            content: cleanContent,
            attachment_url: null,
            attachment_type: null,
            attachment_size: null,
          }),
        });

        if (res.ok) {
          const newMsg = await res.json();
          setMessages((prev) => [...prev, newMsg]);
        } else {
          const err = await res.json().catch(() => ({}));
          addToast(err.detail || 'Não foi possível enviar a mensagem.', 'error');
        }
      }

      setInputText('');
      handleClearAllPendingFiles();
    } catch (err) {
      addToast(err.message || 'Erro ao enviar mídia na call.', 'error');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  return (
    <aside
      className={`voice-chat-sidebar ${isDraggingOver ? 'is-drag-over' : ''}`}
      data-testid="voice-chat-sidebar"
      aria-label="Bate-papo de texto da call"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Overlay de Drag & Drop para envio rápido de mídia */}
      {isDraggingOver && (
        <div className="voice-chat-drag-overlay" data-testid="voice-chat-drag-overlay">
          <div className="voice-chat-drag-modal">
            <UploadCloud size={38} className="voice-chat-drag-icon" />
            <h4 className="voice-chat-drag-title">Envie para #{channel?.name || 'voz'}</h4>
            <p className="voice-chat-drag-subtitle">Solte sua mídia aqui para enviar com legenda!</p>
          </div>
        </div>
      )}

      {/* Cabeçalho do Bate-papo */}
      <div className="voice-chat-header">
        <div className="voice-chat-header-info">
          <MessageSquare size={18} className="voice-chat-header-icon" />
          <span className="voice-chat-header-title">{channel?.name || 'Sala de Voz'}</span>
          <span className="voice-chat-header-badge">Call</span>
        </div>
        <button
          type="button"
          className="voice-chat-close-btn"
          onClick={onClose}
          title="Fechar Bate-papo da Call"
          data-testid="voice-chat-close-btn"
        >
          <X size={18} />
        </button>
      </div>

      {/* Feed de Mensagens */}
      <div className="voice-chat-messages-container" data-testid="voice-chat-messages-container">
        {loading && messages.length === 0 ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#949ba4' }}>
            <Loader2 size={24} className="animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="voice-chat-welcome" data-testid="voice-chat-welcome">
            <div className="voice-chat-welcome-icon">
              <Sparkles size={24} />
            </div>
            <div className="voice-chat-welcome-title">Bate-papo de #{channel?.name}</div>
            <div className="voice-chat-welcome-desc">
              Este é o espaço de texto desta call. Digite anotações importantes, compartilhe links e documentos enquanto conversa na sala de voz.
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const authorName = m.author_name || m.author?.name || 'Membro';
            const initial = authorName.charAt(0).toUpperCase();
            const avatarUrl = m.author_avatar_url || m.author?.avatar_url;

            return (
              <div key={m.id} className="voice-chat-msg-item" data-testid={`voice-chat-msg-${m.id}`}>
                <div className="voice-chat-avatar">
                  {avatarUrl ? <img src={avatarUrl} alt={authorName} /> : initial}
                </div>
                <div className="voice-chat-msg-content">
                  <div className="voice-chat-msg-header">
                    <span className="voice-chat-msg-author">{authorName}</span>
                    <span className="voice-chat-msg-time">{formatBrasiliaDateTime(m.created_at)}</span>
                  </div>
                  {m.content && <div className="voice-chat-msg-text">{renderTextWithLinks(m.content)}</div>}
                  {m.attachment_url && <VoiceChatAttachmentPreview msg={m} />}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Barra de Input com suporte a prévia de múltiplos anexos e legenda */}
      <div className="voice-chat-input-bar">
        {pendingFiles.length > 0 && (
          <div className="voice-chat-attachments-row" data-testid="voice-chat-attachments-row">
            {pendingFiles.map((item, idx) => {
              const isImg = item.file.type?.startsWith('image/');
              const isVid = item.file.type?.startsWith('video/');

              return (
                <div key={item.id} className="voice-chat-attachment-preview" data-testid={`voice-chat-attachment-preview-${idx}`}>
                  <div className="voice-chat-thumb-box">
                    {item.previewUrl && isImg ? (
                      <img src={item.previewUrl} alt={item.file.name} className="voice-chat-thumb-img" data-testid={`voice-chat-preview-img-${idx}`} />
                    ) : item.previewUrl && isVid ? (
                      <video src={item.previewUrl} className="voice-chat-thumb-img" muted playsInline data-testid={`voice-chat-preview-video-${idx}`} />
                    ) : (
                      <FileText size={24} className="voice-chat-thumb-file-icon" />
                    )}
                  </div>
                  <div className="voice-chat-attachment-meta">
                    <div className="voice-chat-attachment-name" title={item.file.name}>
                      {item.file.name}
                    </div>
                    <div className="voice-chat-attachment-size">
                      {formatFileSize(item.file.size)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="voice-chat-remove-attachment-btn"
                    onClick={() => handleRemovePendingFile(item.id)}
                    title={`Remover ${item.file.name}`}
                    data-testid={`voice-chat-remove-attachment-btn-${idx}`}
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <form onSubmit={handleSendMessage} className="voice-chat-form">
          <input
            type="file"
            ref={fileInputRef}
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            data-testid="voice-chat-file-input"
          />
          <button
            type="button"
            className="voice-chat-action-btn"
            title="Anexar arquivos ou mídias"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading}
            data-testid="voice-chat-attach-btn"
          >
            <Paperclip size={18} />
          </button>
          <input
            type="text"
            className="voice-chat-input"
            placeholder={
              pendingFiles.length === 1
                ? 'Adicione uma legenda... (opcional)'
                : pendingFiles.length > 1
                ? `Adicione uma legenda para as ${pendingFiles.length} mídias... (opcional)`
                : `Conversar em #${channel?.name || 'voz'}...`
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={sending || uploading}
            data-testid="voice-chat-input"
          />
          <button
            type="submit"
            className="voice-chat-action-btn voice-chat-send-btn"
            title="Enviar mensagem"
            disabled={(!inputText.trim() && pendingFiles.length === 0) || sending || uploading}
            data-testid="voice-chat-send-btn"
          >
            {sending || uploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </aside>
  );
}
