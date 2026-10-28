import React from 'react';
import { Database, Users, LogOut, Terminal, Server } from 'lucide-react';

export default function Sidebar({ activeTab = 'users', onSelectTab, user, onLogout }) {
  const isSuperAdmin = user?.role === 'superadmin';

  // Regra: A tela de gestão de usuário, backup e logs só vai aparecer para quem é super admin
  const menuItems = isSuperAdmin
    ? [
        { id: 'backup', label: 'Backup Automático', icon: Database },
        { id: 'logs', label: 'Gerenciamento de logs', icon: Terminal },
        { id: 'infrastructure', label: 'Infraestrutura e Recursos', icon: Server },
        { id: 'users', label: 'Gestão de Usuário', icon: Users },
      ]
    : [];

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
          <span className="logo-text">Projeto Base</span>
        </div>

        {/* Navigation Buttons (Removido 'Meus vídeos') */}
        <nav className="nav-menu">
          {menuItems.map((item) => {
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
              onClick={onLogout}
              className="logout-button"
              title="Sair"
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
