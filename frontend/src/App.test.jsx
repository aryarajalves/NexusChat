import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import App from './App';
import { ToastProvider } from './context/ToastContext';

describe('App Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders login screen when unauthenticated', () => {
    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    expect(screen.getByTestId('login-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit-btn')).toBeInTheDocument();
  });

  it('renders authenticated dashboard with sidebar when token and user exist', () => {
    localStorage.setItem('auth_token', 'mock_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 1,
        name: 'Super Admin',
        email: 'aryarajmarketing@gmail.com',
        role: 'superadmin',
      })
    );

    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );
    expect(screen.getByRole('complementary', { name: /menu lateral/i })).toBeInTheDocument();
    expect(screen.getByText('Gestão de Usuários')).toBeInTheDocument();
  });

  it('restores last active tab from localStorage upon page reload', () => {
    localStorage.setItem('auth_token', 'mock_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 1,
        name: 'Super Admin',
        email: 'aryarajmarketing@gmail.com',
        role: 'superadmin',
      })
    );
    localStorage.setItem('active_tab', 'backup');

    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );

    expect(screen.getByTestId('automated-backup-page')).toBeInTheDocument();
    expect(screen.queryByText('Gestão de Usuários')).not.toBeInTheDocument();
  });

  it('renders infrastructure management view when active_tab is infrastructure', () => {
    localStorage.setItem('auth_token', 'mock_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 1,
        name: 'Super Admin',
        email: 'aryarajmarketing@gmail.com',
        role: 'superadmin',
      })
    );
    localStorage.setItem('active_tab', 'infrastructure');

    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );

    expect(screen.getByTestId('infrastructure-management-view')).toBeInTheDocument();
  });

  it('renders welcome screen for non-superadmin users without mentioning restricted areas', () => {
    localStorage.setItem('auth_token', 'mock_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 2,
        name: 'Usuário Comum',
        email: 'user@test.com',
        role: 'user',
      })
    );

    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );

    expect(screen.getByTestId('restricted-access-screen')).toBeInTheDocument();
    expect(screen.getByText('Olá, Usuário Comum!')).toBeInTheDocument();
    expect(screen.getAllByText('user@test.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/acesso exclusivo/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Gestão de Usuários')).not.toBeInTheDocument();
    expect(screen.queryByTestId('automated-backup-page')).not.toBeInTheDocument();
  });

  it('opens logout confirmation modal when clicking logout and proceeds only on confirm', () => {
    localStorage.setItem('auth_token', 'mock_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 1,
        name: 'Super Admin',
        email: 'admin@test.com',
        role: 'superadmin',
      })
    );

    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );

    const logoutBtn = screen.getByTestId('logout-btn');
    fireEvent.click(logoutBtn);

    // Modal de confirmação aberto
    expect(screen.getByTestId('logout-modal-content')).toBeInTheDocument();
    expect(screen.getByText('Encerrar Sessão')).toBeInTheDocument();

    // Clicar em cancelar fecha o modal e mantém o usuário logado
    const cancelBtn = screen.getByTestId('cancel-logout-btn');
    fireEvent.click(cancelBtn);
    expect(screen.queryByTestId('logout-modal-content')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: /menu lateral/i })).toBeInTheDocument();

    // Clicar novamente no logout e depois em confirmar
    fireEvent.click(logoutBtn);
    expect(screen.getByTestId('logout-modal-content')).toBeInTheDocument();

    const confirmBtn = screen.getByTestId('confirm-logout-btn');
    fireEvent.click(confirmBtn);

    // Usuário deslogado com sucesso e redirecionado para a tela de login
    expect(screen.queryByTestId('logout-modal-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('login-email-input')).toBeInTheDocument();
    expect(localStorage.getItem('auth_token')).toBeNull();
  });

  it('automatically logs out user and shows toast when session expires (AUTH_EXPIRED_EVENT)', async () => {
    localStorage.setItem('auth_token', 'expired_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 1,
        name: 'Super Admin',
        email: 'admin@test.com',
        role: 'superadmin',
      })
    );

    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );

    // Confirma que está logado
    expect(screen.getByRole('complementary', { name: /menu lateral/i })).toBeInTheDocument();

    // Dispara evento de sessão expirada
    window.dispatchEvent(new CustomEvent('auth:session_expired'));

    // Deve redirecionar para tela de login e exibir toast
    expect(await screen.findByTestId('login-email-input')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: /menu lateral/i })).not.toBeInTheDocument();
    expect(screen.getByText('Sua sessão expirou. Por favor, faça login novamente.')).toBeInTheDocument();
  });

  it('starts on DashboardWelcome (Image 02) and shows system sidebar when reloaded from discord', () => {
    localStorage.setItem('auth_token', 'mock_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 1,
        name: 'Super Admin',
        email: 'admin@test.com',
        role: 'superadmin',
      })
    );
    localStorage.setItem('active_tab', 'discord');

    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );

    // Deve abrir diretamente na tela de boas-vindas do sistema (Imagem 02)
    expect(screen.getByRole('complementary', { name: /menu lateral/i })).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-welcome-container')).toBeInTheDocument();
    expect(screen.getByTestId('welcome-enter-discord-btn')).toBeInTheDocument();
    expect(localStorage.getItem('active_tab')).toBeNull();
  });

  it('toggles system sidebar from discord without unmounting discord or leaving voice', async () => {
    localStorage.setItem('auth_token', 'mock_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 1,
        name: 'Super Admin',
        email: 'admin@test.com',
        role: 'superadmin',
      })
    );

    global.fetch = vi.fn().mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('/servers')) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );

    // Clica no botão de acessar comunidade Discord no menu lateral
    const enterDiscordBtn = screen.getByTestId('nav-item-discord');
    fireEvent.click(enterDiscordBtn);

    // Agora no Discord, sidebar do sistema escondida
    expect(screen.queryByRole('complementary', { name: /menu lateral/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('discord-app-wrapper')).toBeInTheDocument();

    // Clica no botão dos 3 tracinhos para exibir a barra lateral do sistema
    const toggleBtn = screen.getByTestId('toggle-app-sidebar-btn');
    fireEvent.click(toggleBtn);

    // Abre o menu lateral do sistema e exibe a tela de Boas-Vindas à direita (sem os chats do Discord)
    expect(screen.getByRole('complementary', { name: /menu lateral/i })).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-welcome-container')).toBeInTheDocument();

    // O DiscordApp continua montado continuamente em segundo plano (display: none) para não derrubar a call de voz!
    const discordWrapper = screen.getByTestId('discord-app-wrapper');
    expect(discordWrapper).toBeInTheDocument();
    expect(discordWrapper).toHaveStyle({ display: 'none' });

    // Ao clicar em 'Comunidades (Discord)', o usuário retorna instantaneamente para o Discord
    fireEvent.click(screen.getByTestId('nav-item-discord'));
    expect(discordWrapper).toHaveStyle({ display: 'contents' });
    expect(screen.queryByTestId('dashboard-welcome-container')).not.toBeInTheDocument();
  });

  it('desloga a aba antiga quando outra aba realiza login ou atualiza auth_session_id', async () => {
    localStorage.setItem('auth_token', 'mock_token');
    localStorage.setItem(
      'auth_user',
      JSON.stringify({
        id: 1,
        name: 'Super Admin',
        email: 'admin@test.com',
        role: 'superadmin',
      })
    );
    localStorage.setItem('auth_session_id', 'session_aba_1');
    sessionStorage.setItem('current_session_id', 'session_aba_1');

    render(
      <ToastProvider>
        <App />
      </ToastProvider>
    );

    // Dashboard está autenticado
    expect(screen.getByRole('complementary', { name: /menu lateral/i })).toBeInTheDocument();

    // Outra aba faz login e atualiza a chave auth_session_id
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'auth_session_id',
        newValue: 'session_aba_2',
      })
    );

    // Esta aba antiga deve deslogar e exibir a tela de login
    expect(await screen.findByTestId('login-email-input')).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: /menu lateral/i })).not.toBeInTheDocument();
  });
});


