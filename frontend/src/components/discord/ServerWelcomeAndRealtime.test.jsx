import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import ServerWelcomeTab from './ServerWelcomeTab';
import ServerSettingsModal from './ServerSettingsModal';
import MemberListSidebar from './MemberListSidebar';
import useDiscordUserWS from './useDiscordUserWS';
import useDiscordVoicePresence from './useDiscordVoicePresence';

const mockAddToast = vi.fn();

vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

describe('Sistema de Boas-Vindas e Sincronização Realtime', () => {
  let mockWsInstance = null;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('auth_token', 'fake-jwt-token');

    class MockWS {
      static OPEN = 1;
      constructor(url) {
        this.url = url;
        this.readyState = 1;
        this.send = vi.fn();
        this.close = vi.fn();
        mockWsInstance = this;
      }
    }
    global.WebSocket = MockWS;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza ServerWelcomeTab apenas com canais TEXT, atualiza prévia e salva via PATCH', async () => {
    const onServerUpdated = vi.fn();
    const server = {
      id: 7,
      name: 'Comunidade Gamer',
      owner_id: 1,
      welcome_enabled: false,
      welcome_channel_id: 101,
      welcome_message: 'Olá {user}, bem-vindo ao {server}!',
    };
    const channels = [
      { id: 101, name: 'geral', type: 'TEXT' },
      { id: 102, name: 'boas-vindas', type: 'TEXT' },
      { id: 103, name: 'call-voz', type: 'VOICE' },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...server,
        welcome_enabled: true,
        welcome_channel_id: 102,
        welcome_message: 'Olá {user}, bem-vindo ao {server}! {server}',
      }),
    });

    render(
      <ServerWelcomeTab
        server={server}
        channels={channels}
        onServerUpdated={onServerUpdated}
        token="fake-jwt-token"
      />
    );

    // Canal de voz não deve aparecer no select de boas-vindas
    const select = screen.getByTestId('welcome-channel-select');
    expect(select.querySelectorAll('option')).toHaveLength(2);

    // Ativa o switch
    const toggle = screen.getByTestId('welcome-toggle-btn');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    // Seleciona #boas-vindas e insere variável {server}
    fireEvent.change(select, { target: { value: '102' } });
    fireEvent.click(screen.getByTestId('insert-var-server-btn'));

    // Verifica prévia com @NovoMembro e nome do servidor
    const preview = screen.getByTestId('welcome-preview-box');
    expect(preview.textContent).toContain('@NovoMembro');
    expect(preview.textContent).toContain('Comunidade Gamer');

    // Salva
    fireEvent.click(screen.getByTestId('save-welcome-btn'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/servers/7',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            welcome_enabled: true,
            welcome_channel_id: 102,
            welcome_message: 'Olá {user}, bem-vindo ao {server}! {server}',
          }),
        })
      );
      expect(onServerUpdated).toHaveBeenCalled();
    });
  });

  it('exibe a aba Boas-Vindas dentro do ServerSettingsModal', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(
      <ServerSettingsModal
        isOpen={true}
        onClose={vi.fn()}
        server={{ id: 5, name: 'Servidor Teste', owner_id: 1 }}
        channels={[{ id: 10, name: 'geral', type: 'TEXT' }]}
        currentUser={{ id: 1, name: 'Admin', role: 'superadmin' }}
        members={[]}
      />
    );

    const welcomeTabBtn = screen.getByTestId('tab-welcome-btn');
    fireEvent.click(welcomeTabBtn);

    expect(await screen.findByTestId('server-welcome-tab')).toBeTruthy();
  });

  it('useDiscordUserWS encaminha eventos server:member_joined, voice:channel_update e user:presence', () => {
    const onServerMemberJoined = vi.fn();
    const onVoiceChannelUpdate = vi.fn();
    const onUserPresence = vi.fn();

    renderHook(() =>
      useDiscordUserWS({
        token: 'jwt-123',
        onUnreadUpdate: vi.fn(),
        onDMMessageNew: vi.fn(),
        onServerMemberJoined,
        onVoiceChannelUpdate,
        onUserPresence,
      })
    );

    act(() => {
      mockWsInstance.onmessage({
        data: JSON.stringify({
          event: 'server:member_joined',
          server_id: 9,
          members_count: 3,
          member: { id: 44, user_id: 12, name: 'NovoContato', role: 'MEMBER', is_online: true },
        }),
      });
      mockWsInstance.onmessage({
        data: JSON.stringify({
          event: 'voice:channel_update',
          channel_id: 22,
          active_participants: [{ user_id: 1, user_name: 'Super Admin' }],
        }),
      });
      mockWsInstance.onmessage({
        data: JSON.stringify({
          event: 'user:presence',
          user_id: 2,
          is_online: false,
        }),
      });
    });

    expect(onServerMemberJoined).toHaveBeenCalledWith(
      expect.objectContaining({ server_id: 9, members_count: 3 })
    );
    expect(onVoiceChannelUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ channel_id: 22 })
    );
    expect(onUserPresence).toHaveBeenCalledWith({
      event: 'user:presence',
      user_id: 2,
      is_online: false,
    });
  });

  it('MemberListSidebar diferencia visualmente membros online e offline', () => {
    render(
      <MemberListSidebar
        currentUserId={1}
        members={[
          { id: 1, user_id: 1, name: 'Super Admin', role: 'OWNER', is_online: true },
          { id: 2, user_id: 2, name: 'Aryaraj', role: 'MEMBER', is_online: false },
        ]}
      />
    );

    const onlineBadge = screen.getByTestId('member-presence-1');
    const offlineBadge = screen.getByTestId('member-presence-2');

    expect(onlineBadge.getAttribute('title')).toBe('Online');
    expect(offlineBadge.getAttribute('title')).toBe('Offline');
  });

  it('useDiscordVoicePresence atualiza imediatamente via handleVoiceChannelUpdate e limpa no unmount', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ active_participants: [] }),
    });

    const channels = [{ id: 50, name: 'call', type: 'VOICE' }];
    const currentUser = { id: 1, name: 'Super Admin' };

    const { result, unmount } = renderHook(() =>
      useDiscordVoicePresence({
        token: 'jwt-abc',
        channels,
        activeChannelId: 10, // Usuário visualizando canal de TEXTO #10 enquanto está na call #50
        connectedVoiceChannelId: 50,
        onlineUsers: [{ user_id: 99, user_name: 'ApenasLendoTexto' }],
        currentUser,
      })
    );

    // Usuário apenas lendo canal de texto #10 NÃO deve vazar para a call #50
    expect(
      (result.current.voiceChannelUsers[50] || []).some((u) => u.user_id === 99)
    ).toBe(false);

    // Recebe evento realtime voice:channel_update quando Aryaraj desloga
    act(() => {
      result.current.handleVoiceChannelUpdate({
        channel_id: 50,
        active_participants: [{ user_id: 1, user_name: 'Super Admin' }],
      });
    });

    expect(result.current.voiceChannelUsers[50]).toEqual([
      { user_id: 1, user_name: 'Super Admin' },
    ]);

    // Ao desmontar (ex: logout), dispara /voice-leave-all
    unmount();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/discord/channels/voice-leave-all',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
