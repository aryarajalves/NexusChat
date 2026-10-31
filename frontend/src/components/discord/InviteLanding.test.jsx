import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InviteLanding from './InviteLanding';
import { ToastProvider } from '../../context/ToastContext';

describe('InviteLanding Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading state initially and then displays server invite details', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v1/discord/invites/code123')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            code: 'code123',
            server_id: 1,
            server_name: 'Servidor dos Devs',
            server_icon: null,
            members_count: 5,
            is_expired: false,
          }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    render(
      <ToastProvider>
        <InviteLanding
          inviteCode="code123"
          currentUser={{ id: 10, name: 'Usuário Teste' }}
          token="fake-jwt-token"
          onJoinSuccess={vi.fn()}
          onNavigateLogin={vi.fn()}
        />
      </ToastProvider>
    );

    expect(screen.getByText(/Carregando dados do convite/i)).toBeInTheDocument();

    expect(await screen.findByTestId('server-invite-title')).toHaveTextContent('Servidor dos Devs');
    expect(screen.getByText('5 Membro(s)')).toBeInTheDocument();
    expect(screen.getByTestId('accept-invite-btn')).toBeInTheDocument();
    expect(screen.getByText(/Conectado como/i)).toHaveTextContent('Usuário Teste');
  });

  it('allows authenticated user to accept invite and calls onJoinSuccess', async () => {
    const handleJoinSuccess = vi.fn();

    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes('/api/v1/discord/invites/code123/join')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 1,
            name: 'Servidor dos Devs',
            owner_id: 2,
          }),
        });
      }
      if (url.includes('/api/v1/discord/invites/code123')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            code: 'code123',
            server_id: 1,
            server_name: 'Servidor dos Devs',
            members_count: 5,
            is_expired: false,
          }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    render(
      <ToastProvider>
        <InviteLanding
          inviteCode="code123"
          currentUser={{ id: 10, name: 'Usuário Teste' }}
          token="fake-jwt-token"
          onJoinSuccess={handleJoinSuccess}
          onNavigateLogin={vi.fn()}
        />
      </ToastProvider>
    );

    const acceptBtn = await screen.findByTestId('accept-invite-btn');
    fireEvent.click(acceptBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/invites/code123/join',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer fake-jwt-token',
          }),
        })
      );
      expect(handleJoinSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, name: 'Servidor dos Devs' })
      );
    });
  });

  it('renders login prompt button when user is not authenticated', async () => {
    const handleNavigateLogin = vi.fn();

    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v1/discord/invites/code123')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            code: 'code123',
            server_id: 1,
            server_name: 'Servidor dos Devs',
            members_count: 5,
            is_expired: false,
          }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    render(
      <ToastProvider>
        <InviteLanding
          inviteCode="code123"
          currentUser={null}
          token={null}
          onJoinSuccess={vi.fn()}
          onNavigateLogin={handleNavigateLogin}
        />
      </ToastProvider>
    );

    const loginBtn = await screen.findByTestId('login-to-join-btn');
    expect(loginBtn).toBeInTheDocument();
    fireEvent.click(loginBtn);

    expect(handleNavigateLogin).toHaveBeenCalled();
  });

  it('renders error state when invite is invalid or not found', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/v1/discord/invites/invalid_code')) {
        return Promise.resolve({
          ok: false,
          json: async () => ({ detail: 'Convite inválido ou inexistente' }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    render(
      <ToastProvider>
        <InviteLanding
          inviteCode="invalid_code"
          currentUser={{ id: 10, name: 'Usuário' }}
          token="fake-token"
          onJoinSuccess={vi.fn()}
          onNavigateLogin={vi.fn()}
        />
      </ToastProvider>
    );

    expect(await screen.findByTestId('invite-error-title')).toHaveTextContent('Convite Inválido');
    expect(screen.getByTestId('invite-error-desc')).toHaveTextContent('Convite inválido ou inexistente');
    expect(screen.getByTestId('back-to-home-btn')).toBeInTheDocument();
  });
});
