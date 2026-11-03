import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useDiscordVoicePresence from './useDiscordVoicePresence';

describe('useDiscordVoicePresence hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve buscar o status inicial dos canais de voz', async () => {
    const mockChannels = [
      { id: 1, name: 'texto', type: 'TEXT' },
      { id: 10, name: 'voz-geral', type: 'VOICE' },
    ];

    global.fetch = vi.fn().mockImplementation((url) => {
      if (String(url).includes('voice-status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            channel_id: 10,
            active_participants: [
              { user_id: 2, user_name: 'Participante 2' },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    const { result, unmount } = renderHook(() =>
      useDiscordVoicePresence({
        token: 'test-token',
        channels: mockChannels,
        connectedVoiceChannelId: null,
        onlineUsers: [],
        currentUser: { id: 1, name: 'Super Admin' },
      })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.voiceChannelUsers[10]).toBeDefined();
    expect(result.current.voiceChannelUsers[10]).toEqual([
      {
        user_id: 2,
        user_name: 'Participante 2',
        is_muted: true,
        is_deafened: false,
        is_speaking: false,
      },
    ]);
    unmount();
  });

  it('deve sincronizar participantes e incluir currentUser quando conectado na sala de voz', async () => {
    const mockChannels = [{ id: 10, name: 'voz-geral', type: 'VOICE' }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        channel_id: 10,
        active_participants: [
          { user_id: 2, user_name: 'Membro Teste' },
        ],
      }),
    });

    const currentUser = { id: 1, name: 'Super Admin' };

    const { result, rerender, unmount } = renderHook(
      (props) => useDiscordVoicePresence(props),
      {
        initialProps: {
          token: 'test-token',
          channels: mockChannels,
          connectedVoiceChannelId: null,
          currentUser,
        },
      }
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    act(() => {
      rerender({
        token: 'test-token',
        channels: mockChannels,
        connectedVoiceChannelId: 10,
        currentUser,
      });
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const channelUsers = result.current.voiceChannelUsers[10];
    expect(channelUsers).toBeDefined();
    expect(channelUsers).toHaveLength(2);
    expect(channelUsers.some((u) => u.user_id === 1)).toBe(true);
    expect(channelUsers.some((u) => u.user_id === 2)).toBe(true);
    unmount();
  });

  it('não deve descartar participantes existentes quando onlineUsers trouxer apenas 1 usuário', async () => {
    const mockChannels = [{ id: 10, name: 'voz-geral', type: 'VOICE' }];
    global.fetch = vi.fn().mockImplementation((url) => {
      if (String(url).includes('voice-status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            channel_id: 10,
            active_participants: [
              { user_id: 1, user_name: 'Super Admin' },
              { user_id: 2, user_name: 'Aryaraj' },
            ],
          }),
        });
      }
      return Promise.resolve({ ok: false });
    });

    const currentUser = { id: 1, name: 'Super Admin' };

    const { result, rerender, unmount } = renderHook(
      (props) => useDiscordVoicePresence(props),
      {
        initialProps: {
          token: 'test-token',
          channels: mockChannels,
          connectedVoiceChannelId: null,
          onlineUsers: [],
          currentUser,
        },
      }
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.voiceChannelUsers[10]).toHaveLength(2);

    act(() => {
      rerender({
        token: 'test-token',
        channels: mockChannels,
        connectedVoiceChannelId: 10,
        onlineUsers: [{ user_id: 1, user_name: 'Super Admin' }],
        currentUser,
      });
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const channelUsers = result.current.voiceChannelUsers[10];
    expect(channelUsers).toHaveLength(2);
    expect(channelUsers.some((u) => u.user_id === 1)).toBe(true);
    expect(channelUsers.some((u) => u.user_id === 2)).toBe(true);
    unmount();
  });

  it('deve remover currentUser ao desconectar da sala', async () => {
    const mockChannels = [{ id: 10, name: 'voz-geral', type: 'VOICE' }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        channel_id: 10,
        active_participants: [{ user_id: 2, user_name: 'Membro Teste' }],
      }),
    });

    const currentUser = { id: 1, name: 'Super Admin' };
    const onlineUsers = [
      { user_id: 1, user_name: 'Super Admin' },
      { user_id: 2, user_name: 'Membro Teste' },
    ];

    const { result, unmount } = renderHook(
      (props) => useDiscordVoicePresence(props),
      {
        initialProps: {
          token: 'test-token',
          channels: mockChannels,
          connectedVoiceChannelId: 10,
          onlineUsers,
          currentUser,
        },
      }
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.voiceChannelUsers[10]).toHaveLength(2);

    act(() => {
      result.current.handleDisconnectVoicePresence(10);
    });

    const afterDisconnect = result.current.voiceChannelUsers[10];
    expect(afterDisconnect).toHaveLength(1);
    expect(afterDisconnect[0].user_id).toBe(2);
    unmount();
  });
});
