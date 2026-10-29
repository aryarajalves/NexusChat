import React, { useState, useRef, useEffect } from 'react';
import {
  Hash,
  AtSign,
  Users,
  UploadCloud,
  Pin,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import VoiceChannelArea from './VoiceChannelArea';
import ForwardMessageModal from './ForwardMessageModal';
import ChatMessageItem from './ChatMessageItem';
import ChatSearchBar from './ChatSearchBar';
import ChatInputForm from './ChatInputForm';
import PinnedMessagesPanel from './PinnedMessagesPanel';
import { formatBrasiliaDateTime, formatFileSize } from './chatUtils';
import useVirtualMessageList from './useVirtualMessageList';

export { formatBrasiliaDateTime, formatFileSize };

export default function ChatArea({
  channel,
  messages = [],
  channels = [],
  onSendMessage,
  onEditMessage,
  onToggleReaction,
  onForwardMessage,
  typingUsers = [],
  onSendTyping,
  showMembers,
  onToggleMembers,
  loading = false,
  connectionStatus = 'connected',
  currentUserId,
  currentUserRole,
  onRequestDeleteMessage,
  onUploadAttachment,
  currentUser,
  onlineUsers = [],
  voiceStates = {},
  onSendVoiceState,
  onDisconnectVoice,
  pinnedMessages = [],
  onTogglePin,
  loadingPins = false,
  members = [],
}) {
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [isPinsOpen, setIsPinsOpen] = useState(false);
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

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (
      (e.dataTransfer?.items && e.dataTransfer.items.length > 0) ||
      (e.dataTransfer?.types && e.dataTransfer.types.length > 0) ||
      (e.dataTransfer?.files && e.dataTransfer.files.length > 0)
    ) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e) => {
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
        onlineUsers={onlineUsers}
        voiceStates={voiceStates}
        onSendVoiceState={onSendVoiceState}
        onDisconnect={onDisconnectVoice}
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
              repliedMessage={msg.reply_to_id ? messages.find((m) => m.id === msg.reply_to_id) : null}
              onScrollToMessage={handleScrollToMessage}
              formatFileSize={formatFileSize}
              addToast={addToast}
              members={members}
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
    </section>
  );
}
