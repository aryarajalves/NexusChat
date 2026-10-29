import React from 'react';
import { Database, Users, LogOut, Terminal, Server, MessageSquare } from 'lucide-react';

export default function Sidebar({ activeTab = 'discord', onSelectTab, user, onLogout }) {
  const isSuperAdmin = user?.role === 'superadmin';

  // Navegação categorizada (Opção 2: Estilo SaaS / Produto Moderno)
  const categories = [
    {
      title: 'APLICAÇÃO',
      items: [
        { id: 'discord', label: 'Comunidades (Discord)', icon: MessageSquare },
      ],
    },
    ...(isSuperAdmin
      ? [
          {
            title: 'GESTÃO',
            items: [
              { id: 'users', label: 'Gestão de Usuário', icon: Users },
            ],
          },
          {
            title: 'INFRAESTRUTURA & DADOS',
            items: [
              { id: 'infrastructure', label: 'Infraestrutura e Recursos', icon: Server },
              { id: 'logs', label: 'Gerenciamento de logs', icon: Terminal },
              { id: 'backup', label: 'Backup Automático', icon: Database },
            ],
          },
        ]
      : []),
  ];

  const handleSelect = (id) => {
    if (onSelectTab) {
      onSelectTab(id);
    }
  };

  const userName = user?.name || 'Super Admin';
  const userEmail = user?.email || 'aryarajmarketing@gmail.com';
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <aside className="sidebar" aria-label="Menu Lateral">
      <div className="sidebar-top">
        {/* Logo header */}
        <div className="logo-container">
          <div className="logo-icon" data-testid="logo-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="logo-text">NexusChat</span>
        </div>

        {/* Navigation Groups by Category */}
        <nav className="nav-menu">
          {categories.map((category) => (
            <div
              key={category.title}
              className="nav-category-group"
              data-testid={`category-group-${category.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
            >
              <div className="nav-category-header">{category.title}</div>
              {category.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`nav-button ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelect(item.id)}
                    data-testid={`nav-item-${item.id}`}
                  >
                    <Icon className="nav-icon" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* User profile footer with Logout */}
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="avatar" data-testid="user-avatar">{userInitial}</div>
          <div className="user-info">
            <span className="user-name">{userName}</span>
            <span className="user-email">{userEmail}</span>
          </div>
          {onLogout && (
            <button
              type="button"
              className="logout-button"
              onClick={onLogout}
              title="Desconectar"
              data-testid="logout-btn"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
