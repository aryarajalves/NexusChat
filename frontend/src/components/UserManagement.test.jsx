import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UserManagement from './UserManagement';
import { ToastProvider } from '../context/ToastContext';

describe('UserManagement Component Tabs', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('auth_token', 'mock_token');
    vi.restoreAllMocks();
  });

  it('renders the 2 tabs: "Usuários Criados" and "Convites Gerados"', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/users')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 1, name: 'Aryaraj', email: 'aryaraj@gmail.com', role: 'superadmin', is_active: true, created_at: new Date().toISOString() },
          ],
        });
      }
      if (url.includes('/invites')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 1,
              token: 'token123',
              role: 'admin',
              is_used: false,
              is_expired: false,
              time_remaining: '23h 59m restantes',
              used_by_email: null,
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      return Promise.reject(new Error('Unknown url'));
    });

    render(
      <ToastProvider>
        <UserManagement currentUser={{ role: 'superadmin' }} />
      </ToastProvider>
    );

    // Verifica presença dos botões das abas
    const usersTabBtn = screen.getByTestId('tab-users-btn');
    const invitesTabBtn = screen.getByTestId('tab-invites-btn');
    expect(usersTabBtn).toBeInTheDocument();
    expect(invitesTabBtn).toBeInTheDocument();

    // Aba inicial é 'users'
    expect(screen.getByTestId('users-table-view')).toBeInTheDocument();

    // Clica na aba de convites
    fireEvent.click(invitesTabBtn);

    // Agora deve exibir a tabela de convites com informações de status e tempo restante
    await waitFor(() => {
      expect(screen.getByTestId('invites-table-view')).toBeInTheDocument();
      expect(screen.getByText('Status do Convite')).toBeInTheDocument();
      expect(screen.getByText('Tempo Restante')).toBeInTheDocument();
      expect(screen.getByText('Usado Por')).toBeInTheDocument();
      expect(screen.getByText('23h 59m restantes')).toBeInTheDocument();
      expect(screen.getByText('Pendente')).toBeInTheDocument();
    });
  });

  it('filters users by role and supports pagination with 20 items per page', async () => {
    // Cria 25 usuários fictícios (15 admin e 10 user)
    const mockUsers = Array.from({ length: 25 }, (_, i) => ({
      id: i + 2,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      role: i < 15 ? 'admin' : 'user',
      is_active: true,
      created_at: new Date().toISOString(),
    }));

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/users')) {
        return Promise.resolve({
          ok: true,
          json: async () => mockUsers,
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(
      <ToastProvider>
        <UserManagement currentUser={{ id: 1, role: 'superadmin' }} />
      </ToastProvider>
    );

    // Página 1 deve ter 20 itens exibidos
    expect(await screen.findByTestId('users-pagination')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 1 a 20 de 25 usuários/i)).toBeInTheDocument();

    // Filtra apenas por 'user'
    const roleSelect = screen.getByTestId('filter-user-role-select');
    fireEvent.change(roleSelect, { target: { value: 'user' } });

    // Agora há apenas 10 usuários, cabem na Página 1 de 1
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 1 a 10 de 10 usuários/i)).toBeInTheDocument();

    // Seleciona todos os usuários visíveis
    const selectAllCheckbox = screen.getByTestId('select-all-users-checkbox');
    fireEvent.click(selectAllCheckbox);

    // O botão de exclusão em massa deve aparecer com contagem
    expect(screen.getByTestId('selected-users-count')).toHaveTextContent('10 selecionado(s)');
    expect(screen.getByTestId('bulk-delete-users-btn')).toBeInTheDocument();
  });

  it('filters invites by status and supports bulk selection', async () => {
    const mockInvites = [
      { id: 1, token: 'tok1', role: 'admin', is_used: false, is_expired: false, time_remaining: '20h', created_at: new Date().toISOString() },
      { id: 2, token: 'tok2', role: 'user', is_used: true, is_expired: false, used_by_email: 'a@a.com', created_at: new Date().toISOString() },
      { id: 3, token: 'tok3', role: 'user', is_used: false, is_expired: true, time_remaining: 'Expirado', created_at: new Date().toISOString() },
    ];

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/invites')) {
        return Promise.resolve({ ok: true, json: async () => mockInvites });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(
      <ToastProvider>
        <UserManagement currentUser={{ id: 1, role: 'superadmin' }} />
      </ToastProvider>
    );

    // Vai para a aba de convites
    fireEvent.click(screen.getByTestId('tab-invites-btn'));

    expect(await screen.findByTestId('invites-pagination')).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 1 a 3 de 3 convites/i)).toBeInTheDocument();

    // Filtra por convites pendentes
    const statusSelect = screen.getByTestId('filter-invite-status-select');
    fireEvent.change(statusSelect, { target: { value: 'pending' } });

    expect(screen.getByText(/Mostrando 1 a 1 de 1 convites/i)).toBeInTheDocument();

    // Seleciona o convite
    const selectAll = screen.getByTestId('select-all-invites-checkbox');
    fireEvent.click(selectAll);

    expect(screen.getByTestId('selected-invites-count')).toHaveTextContent('1 convite(s) selecionado(s)');
    expect(screen.getByTestId('bulk-delete-invites-btn')).toBeInTheDocument();
  });

  it('restores last active sub-tab from localStorage upon reload', async () => {
    localStorage.setItem('active_subtab_usermanagement', 'invites');
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/invites')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: 99,
              token: 'token_saved',
              role: 'user',
              is_used: false,
              is_expired: false,
              time_remaining: '10h restantes',
              created_at: new Date().toISOString(),
            },
          ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(
      <ToastProvider>
        <UserManagement currentUser={{ id: 1, role: 'superadmin' }} />
      </ToastProvider>
    );

    // Deve abrir diretamente na tabela de convites
    expect(await screen.findByTestId('invites-table-view')).toBeInTheDocument();
    expect(screen.queryByTestId('users-table-view')).not.toBeInTheDocument();
  });

  it('opens confirmation popup when deleting user and prevents closing on backdrop click', async () => {
    let deletedUserId = null;
    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes('/users') && options?.method === 'DELETE') {
        deletedUserId = 2;
        return Promise.resolve({ ok: true, json: async () => ({ message: 'Usuário excluído' }) });
      }
      if (url.includes('/users')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 1, name: 'Super Admin', email: 'admin@test.com', role: 'superadmin', is_active: true, created_at: new Date().toISOString() },
            { id: 2, name: 'Aryaraj Test', email: 'test@test.com', role: 'admin', is_active: true, created_at: new Date().toISOString() },
          ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(
      <ToastProvider>
        <UserManagement currentUser={{ id: 1, role: 'superadmin' }} />
      </ToastProvider>
    );

    const deleteBtn = await screen.findByTestId('delete-user-btn-2');
    fireEvent.click(deleteBtn);

    // O modal deve aparecer centralizado
    const modalContent = screen.getByTestId('confirm-delete-modal-content');
    expect(modalContent).toBeInTheDocument();
    expect(screen.getByTestId('confirm-delete-title')).toHaveTextContent('Excluir Usuário');
    expect(screen.getByTestId('confirm-delete-message')).toHaveTextContent('Aryaraj Test');

    // Clicar fora (no backdrop) NÃO deve fechar o popup
    const overlay = screen.getByTestId('confirm-delete-modal-overlay');
    fireEvent.click(overlay);
    expect(screen.getByTestId('confirm-delete-modal-content')).toBeInTheDocument();

    // Clicar no botão 'Sim, Excluir'
    const confirmBtn = screen.getByTestId('confirm-delete-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deletedUserId).toBe(2);
    });
  });

  it('renders "Criar Conta" button and opens CreateUserModal when clicked', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/users')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 1, name: 'Aryaraj', email: 'aryaraj@gmail.com', role: 'superadmin', is_active: true, created_at: new Date().toISOString() },
          ],
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(
      <ToastProvider>
        <UserManagement currentUser={{ id: 1, role: 'superadmin' }} />
      </ToastProvider>
    );

    const openCreateBtn = screen.getByTestId('open-create-user-modal-btn');
    expect(openCreateBtn).toBeInTheDocument();
    expect(openCreateBtn).toHaveTextContent('Criar Conta');

    fireEvent.click(openCreateBtn);

    expect(screen.getByTestId('create-user-modal-overlay')).toBeInTheDocument();
    expect(screen.getByText('Criar Conta de Usuário')).toBeInTheDocument();
  });
});



