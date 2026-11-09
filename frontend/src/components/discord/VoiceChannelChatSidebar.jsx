// VoiceChannelChatSidebar.jsx - Painel Lateral de Bate-Papo de Texto da Call (Estilo Discord)
import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Paperclip, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
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
  if (!dateString) return '';
  const d = new Date(dateString);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function VoiceChannelChatSidebar({ channel, currentUser, token, onClose }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  let addToast = () => {};
  try {
    const toastCtx = useToast();
    if (toastCtx?.addToast) addToast = toastCtx.addToast;
  } catch {}

  const authToken = token || localStorage.getItem('auth_token') || localStorage.getItem('token') || '';

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

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      addToast('O arquivo excede o limite máximo permitido de 50 MB.', 'warning');
      return;
    }
    setSelectedFile(file);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const cleanContent = inputText.trim();
    if (!cleanContent && !selectedFile) return;
    if (!channel?.id) return;

    setSending(true);
    let attachmentUrl = null;
    let attachmentType = null;
    let attachmentSize = null;

    try {
      if (selectedFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', selectedFile);
        const uploadRes = await fetch('/api/v1/discord/attachments/upload', {
          method: 'POST',
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          attachmentUrl = uploadData.attachment_url || uploadData.url;
          attachmentType = selectedFile.type;
          attachmentSize = selectedFile.size;
        } else {
          addToast('Falha ao enviar anexo na call.', 'error');
        }
      }

      const res = await fetch(`/api/v1/discord/channels/${channel.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          content: cleanContent,
          attachment_url: attachmentUrl,
          attachment_type: attachmentType,
          attachment_size: attachmentSize,
        }),
      });

      if (res.ok) {
        const newMsg = await res.json();
        setMessages((prev) => [...prev, newMsg]);
        setInputText('');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(err.detail || 'Não foi possível enviar a mensagem.', 'error');
      }
    } catch {
      addToast('Erro ao enviar mensagem no bate-papo de voz.', 'error');
    } finally {
      setSending(false);
      setUploading(false);
    }
  };

  return (
    <aside className="voice-chat-sidebar" data-testid="voice-chat-sidebar" aria-label="Bate-papo de texto da call">
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
                    <span className="voice-chat-msg-time">{formatMessageTime(m.created_at)}</span>
                  </div>
                  {m.content && <div className="voice-chat-msg-text">{renderTextWithLinks(m.content)}</div>}
                  {m.attachment_url && (
                    <div className="voice-chat-attachment">
                      {m.attachment_type?.startsWith('image/') || m.attachment_url.match(/\.(png|jpe?g|gif|webp)$/i) ? (
                        <img src={m.attachment_url} alt="Anexo da call" />
                      ) : (
                        <a href={m.attachment_url} target="_blank" rel="noopener noreferrer" style={{ color: '#00a8fc', fontSize: '12px' }}>
                          📎 Ver anexo ({m.attachment_url.split('/').pop()})
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Barra de Input */}
      <div className="voice-chat-input-bar">
        {selectedFile && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1e1f22', padding: '6px 10px', borderRadius: '6px', marginBottom: '8px', fontSize: '11.5px', color: '#dbdee1' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '240px' }}>
              📎 {selectedFile.name}
            </span>
            <button
              type="button"
              onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
              style={{ background: 'transparent', border: 'none', color: '#f23f43', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>
        )}
        <form onSubmit={handleSendMessage} className="voice-chat-form">
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            data-testid="voice-chat-file-input"
          />
          <button
            type="button"
            className="voice-chat-action-btn"
            title="Anexar arquivo"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || uploading}
            data-testid="voice-chat-attach-btn"
          >
            <Paperclip size={18} />
          </button>
          <input
            type="text"
            className="voice-chat-input"
            placeholder={`Conversar em #${channel?.name || 'voz'}...`}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={sending || uploading}
            data-testid="voice-chat-input"
          />
          <button
            type="submit"
            className="voice-chat-action-btn voice-chat-send-btn"
            title="Enviar mensagem"
            disabled={(!inputText.trim() && !selectedFile) || sending || uploading}
            data-testid="voice-chat-send-btn"
          >
            {sending || uploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </form>
      </div>
    </aside>
  );
}
