import { useState, useEffect } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import AutomatedBackup from './components/AutomatedBackup';
import LogManagement from './components/LogManagement';
import { InfrastructureManagement } from './components/infrastructure';
import { DiscordApp } from './components/discord';
import Register from './components/Register';
import ResetPassword from './components/ResetPassword';
import LogoutConfirmModal from './components/LogoutConfirmModal';
import { useToast } from './context/ToastContext';
import { AUTH_EXPIRED_EVENT } from './services/authInterceptor';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('active_tab') || 'users';
  });
  const [isSidebarHidden, setIsSidebarHidden] = useState(() => {
    return (localStorage.getItem('active_tab') || 'users') === 'discord';
  });
  const [pathname, setPathname] = useState(window.location.pathname);
  const { addToast } = useToast();

  const handleSelectTab = (tabId) => {
    setActiveTab(tabId);
    localStorage.setItem('active_tab', tabId);
    if (tabId === 'discord') {
      setIsSidebarHidden(true);
    }
  };

  const handleToggleAppSidebarFromDiscord = () => {
    setIsSidebarHidden(false);
    setActiveTab('');
    localStorage.removeItem('active_tab');
  };

  useEffect(() => {
    // Check local storage for existing session
    const savedToken = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        // ignore error
      }

      // Sincronizar dados frescos do perfil (avatar_url, nome, role)
      fetch('/api/v1/auth/me', {
        headers: { Authorization: 'Bearer ' + savedToken },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((freshUser) => {
          if (freshUser) {
            setUser(freshUser);
            localStorage.setItem('auth_user', JSON.stringify(freshUser));
          }
        })
        .catch(() => {});
    }

    // Ouvinte para logout automático quando o token expirar
    const handleExpired = () => {
      setUser(null);
      setToken(null);
      setShowLogoutModal(false);
      addToast('Sua sessão expirou. Por favor, faça login novamente.', 'error');
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    };
  }, [addToast]);

  const handleUserUpdated = (updatedUser) => {
    setUser((prev) => {
      const merged = { ...prev, ...updatedUser };
      localStorage.setItem('auth_user', JSON.stringify(merged));
      return merged;
    });
  };

  const handleLoginSuccess = (loggedInUser, userToken) => {
    setUser(loggedInUser);
    setToken(userToken);
  };

  const handlePromptLogout = () => {
    setShowLogoutModal(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutModal(false);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('active_tab');
    localStorage.removeItem('active_subtab_usermanagement');
    localStorage.removeItem('active_backup_tab');
    localStorage.removeItem('active_subtab_infrastructure');
    localStorage.removeItem('discord_active_server_id');
    localStorage.removeItem('discord_active_channel_id');
    localStorage.removeItem('discord_active_dm_id');
    setUser(null);
    setToken(null);
  };

  // Se o caminho for de redefinição de senha (/reset-password)
  const isResetPasswordPage = pathname.includes('/reset-password');
  if (isResetPasswordPage) {
    return (
      <ResetPassword
        onResetSuccess={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  // Se o caminho for de cadastro via convite (/register ou ?token=...)
  const isRegisterPage = pathname.includes('/register') || (window.location.search.includes('token=') && !isResetPasswordPage);

  if (isRegisterPage) {
    return (
      <Register
        onRegisterSuccess={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  // Se o usuário não está autenticado, exibe a tela de Login
  if (!user || !token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const isSuperAdmin = user?.role === 'superadmin';

  return (
    <div className={`app-container ${isSidebarHidden ? 'sidebar-hidden' : ''}`}>
      {!isSidebarHidden && (
        <Sidebar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          user={user}
          onLogout={handlePromptLogout}
        />
      )}
      <main
        className="main-content"
        aria-label="Conteúdo Principal"
        style={
          activeTab === 'discord'
            ? { padding: 0, height: '100vh', overflow: 'hidden' }
            : !activeTab
            ? { padding: 0, height: '100vh', backgroundColor: '#0f1012', overflow: 'hidden' }
            : undefined
        }
      >
        {!activeTab && (
          <div
            className="empty-dashboard-screen"
            data-testid="empty-dashboard-screen"
            style={{ width: '100%', height: '100%', backgroundColor: '#0f1012' }}
          />
        )}
        {activeTab === 'discord' && (
          <DiscordApp
            currentUser={user}
            onUserUpdated={handleUserUpdated}
            onToggleAppSidebar={handleToggleAppSidebarFromDiscord}
            isAppSidebarHidden={isSidebarHidden}
          />
        )}
        {isSuperAdmin && (
          <>
            {activeTab === 'users' && <UserManagement currentUser={user} />}
            {activeTab === 'backup' && <AutomatedBackup currentUser={user} />}
            {activeTab === 'logs' && <LogManagement currentUser={user} />}
            {activeTab === 'infrastructure' && <InfrastructureManagement currentUser={user} />}
          </>
        )}
        {!isSuperAdmin && activeTab && activeTab !== 'discord' && (
          <div className="restricted-access-container user-welcome-container" data-testid="restricted-access-screen">
            <div className="restricted-card user-welcome-card">
              <div className="user-welcome-icon-box">
                <div className="welcome-avatar-badge" data-testid="welcome-avatar-badge">
                  {(user?.name || 'U').charAt(0).toUpperCase()}
                </div>
              </div>
              <h2>Olá, {user?.name || 'Usuário'}!</h2>
              <p className="welcome-subtext">
                Bem-vindo ao <strong>NexusChat</strong>. Sua conta está ativa e pronta para uso.
              </p>

              <div className="welcome-info-grid">
                <div className="welcome-info-item">
                  <span className="info-item-label">E-mail</span>
                  <span className="info-item-value">{user?.email || '—'}</span>
                </div>
                <div className="welcome-info-item">
                  <span className="info-item-label">Status</span>
                  <span className="info-item-badge status-active">
                    <span className="status-dot"></span> Ativo
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <LogoutConfirmModal
        isOpen={showLogoutModal}
        onConfirm={handleConfirmLogout}
        onClose={() => setShowLogoutModal(false)}
      />
    </div>
  );
}

export default App;
