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
});


