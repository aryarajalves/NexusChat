import React, { useState, useEffect } from 'react';
import { MessageSquare, Plus, Search, Mic, Headphones, VolumeX, Settings, X, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DMSidebar({
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onOpenNewDM,
  currentUser,
  dmUnreads = {},
  isSoundMuted = false,
  onToggleSoundMute,
  onOpenUserSettings,
}) {
  const [filterText, setFilterText] = useState('');

  const filtered = conversations.filter((c) => {
    const name = c.other_user?.name?.toLowerCase() || '';
    const email = c.other_user?.email?.toLowerCase() || '';
    const term = filterText.toLowerCase().trim();
    return name.includes(term) || email.includes(term);
  });

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const paginatedConversations = filtered.slice(startIndex, startIndex + PAGE_SIZE);

  const userInitial = (currentUser?.name || 'U').charAt(0).toUpperCase();

  return (
    <aside className="discord-channel-sidebar" aria-label="Mensagens Diretas" data-testid="dm-sidebar">
      {/* Topo / Header das DMs */}
      <div className="server-header" data-testid="dm-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={18} color="#5865f2" />
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#f2f3f5' }}>
            Mensagens Diretas
          </span>
        </div>
        <button
          type="button"
          className="control-icon-btn"
          onClick={onOpenNewDM}
          title="Nova Conversa Privada"
          data-testid="header-new-dm-btn"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Busca de Conversas */}
      <div style={{ padding: '10px 12px 6px 12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: '#1e1f22',
            padding: '6px 10px',
            borderRadius: '4px',
          }}
        >
          <Search size={14} color="#949ba4" />
          <input
            type="text"
            className="form-input"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              fontSize: '13px',
              color: '#dbdee1',
            }}
            placeholder="Buscar conversa..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            data-testid="filter-dms-input"
          />
          {filterText && (
            <button
              type="button"
              onClick={() => setFilterText('')}
              style={{ background: 'transparent', border: 'none', color: '#949ba4', cursor: 'pointer' }}
              title="Limpar filtro"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Lista de Conversas Diretas */}
      <div className="channels-scroll" style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
        <div className="channel-category-header" style={{ padding: '6px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="category-name">Conversas Diretas</span>
          {filtered.length > 0 && (
            <span style={{ fontSize: '10.5px', color: '#949ba4', fontWeight: 600 }} data-testid="dm-contacts-count">
              {filtered.length > PAGE_SIZE
                ? `${startIndex + 1}-${Math.min(filtered.length, startIndex + PAGE_SIZE)} de ${filtered.length}`
                : `${filtered.length}`}
            </span>
          )}
        </div>

        {conversations.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: '#949ba4', fontSize: '13px' }}>
            <p style={{ margin: '0 0 10px 0' }}>Nenhuma conversa iniciada.</p>
            <button
              type="button"
              className="discord-modal-btn btn-primary"
              style={{ width: '100%', fontSize: '12px', padding: '6px 10px' }}
              onClick={onOpenNewDM}
              data-testid="empty-start-dm-btn"
            >
              <Plus size={14} />
              <span>Iniciar conversa</span>
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '16px 8px', textAlign: 'center', color: '#949ba4', fontSize: '12px' }}>
            Nenhuma conversa encontrada.
          </div>
        ) : (
          paginatedConversations.map((conv) => {
            const isActive = activeConversationId === conv.id;
            const unreadCount = (dmUnreads && dmUnreads[conv.id]) || 0;
            const isUnread = unreadCount > 0 && !isActive;
            const friendName = conv.other_user?.name || 'Amigo';
            const initial = friendName.charAt(0).toUpperCase();
            const lastSnippet = conv.last_message?.content || (conv.last_message?.attachment_url ? '[Anexo de mídia]' : 'Clique para conversar');

            return (
              <div
                key={conv.id}
                className={`channel-item ${isActive ? 'active' : ''} ${isUnread ? 'channel-item-unread' : ''}`}
                onClick={() => onSelectConversation(conv.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '2px',
                  position: 'relative',
                }}
                data-testid={`dm-item-${conv.id}`}
              >
                {isUnread && (
                  <div className="channel-unread-dot" data-testid={`dm-unread-dot-${conv.id}`} />
                )}
                <div className="discord-avatar-wrapper" style={{ width: '32px', height: '32px', fontSize: '13px', flexShrink: 0, position: 'relative' }}>
                  {conv.other_user?.avatar_url ? (
                    <img
                      src={conv.other_user.avatar_url}
                      alt={friendName}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    initial
                  )}
                  {isUnread ? (
                    <span className="contact-unread-avatar-badge" data-testid={`contact-unread-avatar-badge-${conv.id}`}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  ) : (
                    <span className="discord-online-badge" />
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                  <span style={{ color: (isActive || isUnread) ? '#fff' : '#dbdee1', fontWeight: (isActive || isUnread) ? 700 : 600, fontSize: '13.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {friendName}
                  </span>
                  <span style={{ color: isUnread ? '#f2f3f5' : '#949ba4', fontWeight: isUnread ? 600 : 400, fontSize: '11.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lastSnippet}
                  </span>
                </div>
                {isUnread && (
                  <span className="dm-unread-badge" data-testid={`dm-unread-badge-${conv.id}`}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
            );
          })
        )}

        {/* Controles de Paginação (20 contatos por página) */}
        {totalPages > 1 && (
          <div
            className="dm-pagination-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              marginTop: '8px',
              marginBottom: '4px',
              background: '#2b2d31',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              fontSize: '11.5px',
              color: '#949ba4',
            }}
            data-testid="dm-pagination-controls"
          >
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                background: safePage <= 1 ? 'transparent' : '#35373c',
                color: safePage <= 1 ? '#4e5058' : '#f2f3f5',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 8px',
                cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                fontSize: '11px',
                fontWeight: 600,
              }}
              data-testid="dm-pagination-prev"
            >
              <ChevronLeft size={13} />
              Anterior
            </button>

            <span data-testid="dm-pagination-info" style={{ fontWeight: 600, color: '#dbdee1' }}>
              {safePage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                background: safePage >= totalPages ? 'transparent' : '#35373c',
                color: safePage >= totalPages ? '#4e5058' : '#f2f3f5',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 8px',
                cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                fontSize: '11px',
                fontWeight: 600,
              }}
              data-testid="dm-pagination-next"
            >
              Próxima
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Barra de Perfil do Usuário Logado */}
      <div className="discord-user-bar" data-testid="dm-user-profile-bar">
        <div
          className="discord-user-info"
          onClick={onOpenUserSettings}
          role="button"
          tabIndex={0}
          title="Abrir Configurações de Usuário"
        >
          <div className="discord-avatar-wrapper">
            {currentUser?.avatar_url ? (
              <img
                src={currentUser.avatar_url}
                alt={currentUser.name}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              userInitial
            )}
            <span className="discord-online-badge" />
          </div>
          <div className="discord-user-names">
            <span className="discord-name-text">{currentUser?.name || 'Usuário'}</span>
            <span className="discord-status-text">Online</span>
          </div>
        </div>
        <div className="discord-user-controls">
          <button type="button" className="control-icon-btn" title="Microfone" data-testid="dm-mic-btn">
            <Mic size={16} />
          </button>
          <button
            type="button"
            className={`control-icon-btn ${isSoundMuted ? 'muted' : ''}`}
            onClick={onToggleSoundMute}
            title={isSoundMuted ? 'Ativar Efeitos Sonoros' : 'Silenciar Efeitos Sonoros'}
            data-testid="dm-headphones-btn"
          >
            {isSoundMuted ? <VolumeX size={16} /> : <Headphones size={16} />}
          </button>
          <button
            type="button"
            className="control-icon-btn"
            onClick={onOpenUserSettings}
            title="Configurações do Usuário"
            data-testid="dm-settings-btn"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
