import React, { useState, useRef, useEffect } from 'react';
import { Hash, AtSign, Users, UploadCloud, Pin, Menu, Film } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import VoiceChannelArea from './VoiceChannelArea';
import VoiceRecordingsGalleryModal from './VoiceRecordingsGalleryModal';
import ForwardMessageModal from './ForwardMessageModal';
import ChatMessageItem from './ChatMessageItem';
import ChatSearchBar from './ChatSearchBar';
import ChatInputForm from './ChatInputForm';
import PinnedMessagesPanel from './PinnedMessagesPanel';
import ThreadSidePanel from './ThreadSidePanel';
import { formatBrasiliaDateTime, formatFileSize } from './chatUtils';
import useVirtualMessageList from './useVirtualMessageList';

export { formatBrasiliaDateTime, formatFileSize };

export default function ChatArea({
  channel, messages = [], channels = [], onSendMessage, onEditMessage,
  onToggleReaction, onForwardMessage, typingUsers = [], onSendTyping,
  showMembers, onToggleMembers, loading = false, connectionStatus = 'connected',
  currentUserId, currentUserRole, onRequestDeleteMessage, onUploadAttachment,
  currentUser, onlineUsers = [], voiceStates = {}, onSendVoiceState,
  onDisconnectVoice, pinnedMessages = [], onTogglePin, loadingPins = false,
  members = [], onThreadUpdate, onStartDM, onToggleMobileNav,
}) {
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [isPinsOpen, setIsPinsOpen] = useState(false);
  const [isRecordingsOpen, setIsRecordingsOpen] = useState(false);
  const [activeThreadDetail, setActiveThreadDetail] = useState(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [droppedFile, setDroppedFile] = useState(null);

  const { addToast } = useToast();
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textInputRef = useRef(null);
  const dragCounterRef = useRef(0);

  const {
    isVirtual,
    visibleMessages,
    topSpacerHeight,
    bottomSpacerHeight,
  } = useVirtualMessageList({
    messages,
    containerRef: messagesContainerRef,
    enabledThreshold: 40,
  });

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const isFileDragEvent = (e) => {
    if (typeof document !== 'undefined' && document.querySelector('.voice-pip-floating-box.is-dragging, .webcam-pip-container.is-dragging')) {
      return false;
    }
    const types = Array.from(e.dataTransfer?.types || []);
    return types.includes('Files');
  };

  const handleDragEnter = (e) => {
    if (!isFileDragEvent(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDraggingOver(true);
  };

  const handleDragOver = (e) => {
    if (!isFileDragEvent(e)) return;
    e.preventDefault();
    e.stopPropagation();
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
    const file = e.dataTransfer?.files?.[0];
    if (file) setDroppedFile(file);
  };

  const handleStartReply = (messageToReply) => {
    setReplyingTo(messageToReply);
    textInputRef.current?.focus();
  };

  const handleScrollToMessage = (messageId) => {
    const el = document.getElementById(`message-item-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('message-highlight-pulse');
      setTimeout(() => {
        el.classList.remove('message-highlight-pulse');
      }, 2000);
    }
  };

  const handleOpenThread = async (threadId) => {
    setLoadingThread(true);
    const authToken = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
    try {
      const res = await fetch(`/api/v1/discord/threads/${threadId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setActiveThreadDetail(data);
        if (onThreadUpdate && data?.root_message_id) {
          const lastMsg = data.messages && data.messages.length > 0 ? data.messages[data.messages.length - 1] : null;
          onThreadUpdate(data.root_message_id, {
            id: data.id, channel_id: data.channel_id, root_message_id: data.root_message_id,
            creator_id: data.creator_id, creator_name: data.creator_name, name: data.name,
            message_count: data.messages?.length || 0,
            last_message_content: lastMsg ? lastMsg.content : null,
            last_message_author: lastMsg ? lastMsg.author_name : null,
            last_message_at: lastMsg ? lastMsg.created_at : data.created_at,
            created_at: data.created_at, updated_at: data.updated_at,
          });
        }
      } else {
        addToast('Não foi possível carregar o tópico.', 'error');
      }
    } catch {
      addToast('Erro de conexão ao abrir tópico.', 'error');
    } finally {
      setLoadingThread(false);
    }
  };

  const handleCreateOrOpenThread = async (targetMsg) => {
    if (!targetMsg) return;
    if (targetMsg.thread?.id) {
      handleOpenThread(targetMsg.thread.id);
      return;
    }

    setLoadingThread(true);
    const authToken = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
    const fallbackName = (targetMsg.content || '').slice(0, 40).trim() || 'Tópico da Mensagem';

    try {
      const res = await fetch(`/api/v1/discord/channels/${channel.id}/messages/${targetMsg.id}/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ name: fallbackName }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveThreadDetail(data);
        if (onThreadUpdate && data) {
          const lastMsg = data.messages && data.messages.length > 0 ? data.messages[data.messages.length - 1] : null;
          onThreadUpdate(targetMsg.id, {
            id: data.id, channel_id: data.channel_id, root_message_id: data.root_message_id,
            creator_id: data.creator_id, creator_name: data.creator_name, name: data.name,
            message_count: data.messages?.length || 0,
            last_message_content: lastMsg ? lastMsg.content : null,
            last_message_author: lastMsg ? lastMsg.author_name : null,
            last_message_at: lastMsg ? lastMsg.created_at : data.created_at,
            created_at: data.created_at, updated_at: data.updated_at,
          });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(err.detail || 'Falha ao criar tópico.', 'error');
      }
    } catch {
      addToast('Erro de conexão ao criar tópico.', 'error');
    } finally {
      setLoadingThread(false);
    }
  };

  const handleSendThreadMessage = async (threadId, content) => {
    const authToken = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
    try {
      const res = await fetch(`/api/v1/discord/threads/${threadId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setActiveThreadDetail((prev) => {
          if (!prev || prev.id !== threadId) return prev;
          const updatedMessages = [...(prev.messages || []), newMsg];
          const updatedDetail = { ...prev, messages: updatedMessages };
          if (onThreadUpdate && prev.root_message_id) {
            onThreadUpdate(prev.root_message_id, {
              id: prev.id,
              channel_id: prev.channel_id,
              root_message_id: prev.root_message_id,
              creator_id: prev.creator_id,
              creator_name: prev.creator_name,
              name: prev.name,
              message_count: updatedMessages.length,
              last_message_content: newMsg.content,
              last_message_author: newMsg.author_name,
              last_message_at: newMsg.created_at,
              created_at: prev.created_at,
              updated_at: newMsg.created_at,
            });
          }
          return updatedDetail;
        });
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(err.detail || 'Não foi possível enviar mensagem no tópico.', 'error');
      }
    } catch {
      addToast('Erro de conexão ao responder no tópico.', 'error');
    }
  };

  if (!channel) {
    return (
      <section className="discord-chat-area" aria-label="Área de Mensagens">
        <div className="chat-empty-state" style={{ margin: 'auto', textAlign: 'center' }}>
          <div className="chat-empty-icon" style={{ margin: '0 auto 16px auto' }}>
            <Hash size={32} />
          </div>
          <h2 className="chat-empty-title">Nenhum canal selecionado</h2>
          <p className="chat-empty-subtitle">Selecione um canal na barra lateral para começar a conversar.</p>
        </div>
      </section>
    );
  }

  if (channel.type === 'VOICE') {
    return (
      <VoiceChannelArea
        channel={channel}
        currentUser={currentUser}
        currentUserRole={currentUserRole}
        onlineUsers={onlineUsers}
        voiceStates={voiceStates}
        members={members}
        onSendVoiceState={onSendVoiceState}
        onDisconnectVoice={onDisconnectVoice}
        onDisconnect={onDisconnectVoice}
        onToggleMobileNav={onToggleMobileNav}
      />
    );
  }

  return (
    <section
      className={`discord-chat-area ${isDraggingOver ? 'drag-over-active' : ''}`}
      aria-label="Área de Mensagens"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Overlay Visual de Drag & Drop */}
      {isDraggingOver && (
        <div className="chat-drag-overlay" data-testid="chat-drag-overlay">
          <div className="chat-drag-modal">
            <UploadCloud size={48} className="chat-drag-icon" />
            <h3 className="chat-drag-title">Envie para #{channel.name}</h3>
            <p className="chat-drag-subtitle">Solte sua mídia aqui para adicionar e enviar com legenda!</p>
          </div>
        </div>
      )}

      {/* Topbar do Canal */}
      <div className="chat-topbar">
                <div className="chat-channel-info">
          {onToggleMobileNav && (
            <button
              type="button"
              className="chat-mobile-nav-btn"
              onClick={onToggleMobileNav}
              title="Abrir Canais"
              data-testid="chat-mobile-nav-btn"
            >
              <Menu size={22} />
            </button>
          )}
          {channel.is_dm ? <AtSign size={24} className="channel-hash-icon" /> : <Hash size={24} className="channel-hash-icon" />}
          <h1 className="chat-channel-name">{channel.is_dm ? `@${channel.name}` : channel.name}</h1>
          <span className="channel-topic-divider">|</span>
          <span className="channel-topic">{channel.is_dm ? 'Conversa Privada' : (channel.category || 'Canal de Discussão')}</span>
        </div>

        <div className="chat-topbar-actions">
          {/* Botão de Mensagens Fixadas */}
          <button
            type="button"
            className={`topbar-action-btn chat-topbar-pin-btn ${isPinsOpen ? 'active' : ''}`}
            onClick={() => setIsPinsOpen((prev) => !prev)}
            title="Mensagens Fixadas"
            data-testid="toggle-pins-btn"
          >
            <Pin size={20} />
            {pinnedMessages.length > 0 && (
              <span className="chat-pin-counter-badge" data-testid="pin-counter-badge">
                {pinnedMessages.length > 99 ? '99+' : pinnedMessages.length}
              </span>
            )}
          </button>

          {/* Botão de Gravações do Servidor */}
          {!channel.is_dm && channel.server_id && (
            <button
              type="button"
              className={`topbar-action-btn ${isRecordingsOpen ? 'active' : ''}`}
              onClick={() => setIsRecordingsOpen(true)}
              title="Gravações do Servidor"
              data-testid="toggle-server-recordings-btn"
            >
              <Film size={20} />
            </button>
          )}

          {/* Barra de Busca de Mensagens estilo Discord */}
          <ChatSearchBar
            channel={channel}
            onScrollToMessage={handleScrollToMessage}
          />

          <div
            className={`connection-pill pill-${connectionStatus}`}
            data-testid="connection-status-pill"
            title={`Status da Conexão: ${connectionStatus}`}
          >
            <span className="status-indicator-dot" />
            <span className="status-text">
              {connectionStatus === 'connected' && '🟢 Conectado'}
              {connectionStatus === 'connecting' && '🟡 Reconectando...'}
              {connectionStatus === 'disconnected' && '🔴 Desconectado'}
            </span>
          </div>

          {!channel.is_dm && (
            <button
              type="button"
              className={`topbar-action-btn ${showMembers ? 'active' : ''}`}
              onClick={onToggleMembers}
              title="Alternar Lista de Membros"
              data-testid="toggle-members-btn"
            >
              <Users size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Feed de Mensagens */}
      <div
        ref={messagesContainerRef}
        className="chat-messages-container"
        data-testid="chat-messages-feed"
      >
        {isVirtual && topSpacerHeight > 0 && (
          <div
            style={{ height: `${topSpacerHeight}px` }}
            data-testid="virtual-top-spacer"
            aria-hidden="true"
          />
        )}
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <div className="chat-empty-icon">
              {channel.is_dm ? <AtSign size={32} /> : <Hash size={32} />}
            </div>
            <h2 className="chat-empty-title">
              {channel.is_dm ? `Início da conversa com @${channel.name}` : `Bem-vindo a #${channel.name}!`}
            </h2>
            <p className="chat-empty-subtitle">
              {channel.is_dm ? `Histórico de mensagens privadas com @${channel.name}.` : `Este é o começo do canal #${channel.name}. Diga oi para o pessoal!`}
            </p>
          </div>
        ) : (
          visibleMessages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              msg={msg}
              channelId={channel.id}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              currentUser={currentUser}
              onEditMessage={onEditMessage}
              onToggleReaction={onToggleReaction}
              onRequestForward={(m) => setForwardingMessage(m)}
              onRequestDelete={(m) => onRequestDeleteMessage && onRequestDeleteMessage(m)}
              onRequestReply={handleStartReply}
              onTogglePin={onTogglePin}
              onRequestThread={handleCreateOrOpenThread}
              onOpenThread={handleOpenThread}
              repliedMessage={msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : null}
              onScrollToMessage={handleScrollToMessage}
              formatFileSize={formatFileSize}
              addToast={addToast}
              members={members}
              onStartDM={onStartDM}
            />
          ))
        )}
        {isVirtual && bottomSpacerHeight > 0 && (
          <div
            style={{ height: `${bottomSpacerHeight}px` }}
            data-testid="virtual-bottom-spacer"
            aria-hidden="true"
          />
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Formulário Modular de Envio e Digitação */}
      <ChatInputForm
        channel={channel}
        members={members}
        currentUser={currentUser}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        onSendMessage={onSendMessage}
        onUploadAttachment={onUploadAttachment}
        onSendTyping={onSendTyping}
        typingUsers={typingUsers}
        droppedFile={droppedFile}
        onClearDroppedFile={() => setDroppedFile(null)}
        externalInputRef={textInputRef}
      />

      {/* Modal de Encaminhamento de Mensagem */}
      <ForwardMessageModal
        isOpen={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        message={forwardingMessage}
        channels={channels}
        currentChannelId={channel?.id}
        onForwardMessage={onForwardMessage}
      />

      {/* Painel Lateral / Drawer de Mensagens Fixadas */}
      <PinnedMessagesPanel
        isOpen={isPinsOpen}
        onClose={() => setIsPinsOpen(false)}
        channel={channel}
        pinnedMessages={pinnedMessages}
        loading={loadingPins}
        onScrollToMessage={handleScrollToMessage}
        onTogglePin={onTogglePin}
      />

      {/* Painel Lateral de Tópico (Thread) estilo Discord */}
      <ThreadSidePanel
        isOpen={!!activeThreadDetail}
        onClose={() => setActiveThreadDetail(null)}
        threadDetail={activeThreadDetail}
        loading={loadingThread}
        onSendThreadMessage={handleSendThreadMessage}
        currentUserId={currentUserId}
        currentUser={currentUser}
        members={members}
      />

      {/* Modal de Galeria de Gravações do Servidor */}
      {!channel.is_dm && channel.server_id && isRecordingsOpen && (
        <VoiceRecordingsGalleryModal
          isOpen={isRecordingsOpen}
          onClose={() => setIsRecordingsOpen(false)}
          serverId={channel.server_id}
          channel={channel}
          currentUser={currentUser}
        />
      )}
    </section>
  );
}
