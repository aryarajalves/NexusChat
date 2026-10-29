import React, { useState } from 'react';
import { MessageSquare, Plus, Search, Mic, Headphones, VolumeX, Settings, X } from 'lucide-react';

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
        <div className="channel-category-header" style={{ padding: '6px 8px' }}>
          <span className="category-name">Conversas Diretas</span>
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
          filtered.map((conv) => {
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
                <div className="discord-avatar-wrapper" style={{ width: '32px', height: '32px', fontSize: '13px', flexShrink: 0 }}>
                  {initial}
                  <span className="discord-online-badge" />
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
      </div>

      {/* Barra de Perfil do Usuário Logado */}
      <div className="user-profile-bar" data-testid="dm-user-profile-bar">
        <div className="user-avatar-wrap">
          <div className="discord-avatar-wrapper" style={{ width: '32px', height: '32px', fontSize: '13px' }}>
            {userInitial}
            <span className="discord-online-badge" />
          </div>
          <div className="user-text-info">
            <span className="user-display-name">{currentUser?.name || 'Usuário'}</span>
            <span className="user-sub-tag">Online</span>
          </div>
        </div>
        <div className="user-controls-btns">
          <button type="button" className="control-icon-btn" title="Microfone" data-testid="dm-mic-btn">
            <Mic size={18} />
          </button>
          <button
            type="button"
            className={`control-icon-btn ${isSoundMuted ? 'muted' : ''}`}
            onClick={onToggleSoundMute}
            title={isSoundMuted ? 'Ativar Efeitos Sonoros' : 'Silenciar Efeitos Sonoros'}
            data-testid="dm-headphones-btn"
          >
            {isSoundMuted ? <VolumeX size={18} /> : <Headphones size={18} />}
          </button>
          <button
            type="button"
            className="control-icon-btn"
            onClick={onOpenUserSettings}
            title="Configurações do Usuário"
            data-testid="dm-settings-btn"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
