import React, { useState, useEffect } from 'react';
import { Settings, Shield, Users, X } from 'lucide-react';
import ServerGeneralTab from './ServerGeneralTab';
import ServerRolesTab from './ServerRolesTab';
import ServerMembersTab from './ServerMembersTab';

export default function ServerSettingsModal({
  isOpen,
  onClose,
  server,
  onServerUpdated,
  currentUser,
  members = [],
  onMembersUpdated,
}) {
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'roles' | 'members'
  const [roles, setRoles] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);

  const token = localStorage.getItem('auth_token');

  const fetchRoles = async () => {
    if (!server?.id || !token) return;
    try {
      setLoadingRoles(true);
      const res = await fetch(`/api/v1/discord/servers/${server.id}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRoles(data);
      }
    } catch {
      // Ignora erro de carregamento silencioso
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    if (isOpen && server?.id) {
      fetchRoles();
    }
  }, [isOpen, server?.id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !server) return null;

  return (
    <div className="modal-backdrop" data-testid="server-settings-modal-backdrop">
      <div className="server-settings-dialog" data-testid="server-settings-modal">
        {/* Barra Lateral do Modal (Navegação de Abas) */}
        <aside className="server-settings-sidebar">
          <div className="server-settings-sidebar-header">
            <span className="server-settings-server-name" title={server.name}>
              {server.name}
            </span>
          </div>

          <nav className="server-settings-nav">
            <button
              type="button"
              className={`server-settings-nav-btn ${activeTab === 'general' ? 'active' : ''}`}
              onClick={() => setActiveTab('general')}
              data-testid="tab-general-btn"
            >
              <Settings size={16} /> Visão Geral
            </button>
            <button
              type="button"
              className={`server-settings-nav-btn ${activeTab === 'roles' ? 'active' : ''}`}
              onClick={() => setActiveTab('roles')}
              data-testid="tab-roles-btn"
            >
              <Shield size={16} /> Cargos ({roles.length})
            </button>
            <button
              type="button"
              className={`server-settings-nav-btn ${activeTab === 'members' ? 'active' : ''}`}
              onClick={() => setActiveTab('members')}
              data-testid="tab-members-btn"
            >
              <Users size={16} /> Membros ({members.length})
            </button>
          </nav>
        </aside>

        {/* Área Central / Conteúdo da Aba */}
        <main className="server-settings-main">
          {activeTab === 'general' && (
            <ServerGeneralTab
              server={server}
              onServerUpdated={onServerUpdated}
              token={token}
            />
          )}

          {activeTab === 'roles' && (
            <ServerRolesTab
              server={server}
              roles={roles}
              onRolesUpdated={(newRoles) => setRoles(newRoles)}
              token={token}
            />
          )}

          {activeTab === 'members' && (
            <ServerMembersTab
              server={server}
              members={members}
              roles={roles}
              onMembersUpdated={onMembersUpdated}
              token={token}
              currentUserId={currentUser?.id}
            />
          )}
        </main>

        {/* Botão de Fechar / ESC no Canto Superior Direito */}
        <div className="server-settings-close-box">
          <button
            type="button"
            className="server-settings-close-circle"
            onClick={onClose}
            title="Fechar (ESC)"
            data-testid="close-server-settings-btn"
          >
            <X size={18} />
          </button>
          <span className="server-settings-esc-hint">ESC</span>
        </div>
      </div>
    </div>
  );
}
