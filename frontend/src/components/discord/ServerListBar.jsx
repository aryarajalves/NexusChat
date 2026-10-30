import React, { useState } from 'react';
import { Plus, MessageSquare, Menu } from 'lucide-react';

export default function ServerListBar({
  servers = [],
  activeServerId,
  onSelectServer,
  onOpenCreateServer,
  onToggleAppSidebar,
  isAppSidebarHidden,
  totalDMUnreads = 0,
  serverUnreads = {},
}) {
  const [failedIcons, setFailedIcons] = useState({});
  return (
    <nav className="discord-server-list" aria-label="Servidores">
      {/* Botão para alternar exibição do menu geral do sistema */}
      {onToggleAppSidebar && (
        <>
          <button
            type="button"
            className="server-icon-btn server-icon-app-toggle"
            onClick={onToggleAppSidebar}
            title={isAppSidebarHidden ? 'Mostrar menu do sistema' : 'Maximizar Discord'}
            data-testid="toggle-app-sidebar-btn"
          >
            <Menu size={20} />
          </button>
          <div className="server-separator" />
        </>
      )}

      {/* Botão de DMs / Início */}
      <button
        type="button"
        className={`server-icon-btn ${!activeServerId ? 'active' : ''}`}
        onClick={() => onSelectServer(null)}
        title="Mensagens Diretas"
        data-testid="dm-server-btn"
        style={{ position: 'relative' }}
      >
        <MessageSquare size={22} />
        {totalDMUnreads > 0 && activeServerId !== null && (
          <span className="server-unread-badge" data-testid="dm-unread-badge">
            {totalDMUnreads > 99 ? '99+' : totalDMUnreads}
          </span>
        )}
      </button>

      <div className="server-separator" />

      {/* Lista de Servidores do Usuário */}
      {servers.map((server) => {
        const isActive = activeServerId === server.id;
        const initial = (server.name || 'S').charAt(0).toUpperCase();
        const unreadCount = (serverUnreads && serverUnreads[server.id]) || 0;
        const hasUnread = unreadCount > 0 && !isActive;

        return (
          <button
            key={server.id}
            type="button"
            className={`server-icon-btn ${isActive ? 'active' : ''}`}
            onClick={() => onSelectServer(server.id)}
            title={server.name}
            data-testid={`server-icon-${server.id}`}
            style={{ position: 'relative' }}
          >
            {hasUnread && (
              <div className="server-unread-pill-indicator" data-testid={`server-unread-indicator-${server.id}`} />
            )}
            {server.icon_url && !failedIcons[server.id] ? (
              <img
                src={server.icon_url}
                alt={server.name}
                style={{ width: '100%', height: '100%', borderRadius: 'inherit', objectFit: 'cover' }}
                onError={() => setFailedIcons(prev => ({ ...prev, [server.id]: true }))}
              />
            ) : (
              initial
            )}
            {hasUnread && (
              <span className="server-unread-badge" data-testid={`server-unread-badge-${server.id}`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        );
      })}

      {/* Botão de Adicionar / Criar Servidor */}
      <button
        type="button"
        className="server-icon-btn server-icon-add"
        onClick={onOpenCreateServer}
        title="Adicionar um Servidor"
        data-testid="add-server-btn"
      >
        <Plus size={24} />
      </button>
    </nav>
  );
}
