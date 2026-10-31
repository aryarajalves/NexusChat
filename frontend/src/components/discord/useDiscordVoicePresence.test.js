import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useDiscordVoicePresence from './useDiscordVoicePresence';

describe('useDiscordVoicePresence hook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deve buscar o status inicial dos canais de voz periodicamente', async () => {
    const mockChannels = [
      { id: 1, name: 'texto', type: 'TEXT' },
      { id: 10, name: 'voz-geral', type: 'VOICE' },
    ];

    global.fetch = vi.fn().mockImplementation((url) => {
      if (String(url).includes('/channels/10/voice-status')) {
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

    const { result } = renderHook(() =>
      useDiscordVoicePresence({
        token: 'test-token',
        channels: mockChannels,
        connectedVoiceChannelId: null,
        onlineUsers: [],
        currentUser: { id: 1, name: 'Super Admin' },
      })
    );

    // Aguarda a resolução da primeira promise do fetch
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.voiceChannelUsers[10]).toBeDefined();
    expect(result.current.voiceChannelUsers[10]).toEqual([
      { user_id: 2, user_name: 'Participante 2' },
    ]);
  });

  it('deve sincronizar participantes e incluir currentUser quando conectado na sala de voz', async () => {
    const mockChannels = [{ id: 10, name: 'voz-geral', type: 'VOICE' }];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ active_participants: [] }) });

    const currentUser = { id: 1, name: 'Super Admin' };
    const onlineUsers = [
      { user_id: 2, user_name: 'Membro Teste' },
    ];

    const { result, rerender } = renderHook(
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

    // Simula conexão no canal 10
    act(() => {
      rerender({
        token: 'test-token',
        channels: mockChannels,
        connectedVoiceChannelId: 10,
        onlineUsers,
        currentUser,
      });
    });

    const channelUsers = result.current.voiceChannelUsers[10];
    expect(channelUsers).toBeDefined();
    expect(channelUsers).toHaveLength(2);
    expect(channelUsers.some((u) => u.user_id === 1)).toBe(true);
    expect(channelUsers.some((u) => u.user_id === 2)).toBe(true);
  });

  it('deve remover currentUser ao desconectar da sala', async () => {
    const mockChannels = [{ id: 10, name: 'voz-geral', type: 'VOICE' }];
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ active_participants: [] }) });

    const currentUser = { id: 1, name: 'Super Admin' };

    const { result, rerender } = renderHook(
      (props) => useDiscordVoicePresence(props),
      {
        initialProps: {
          token: 'test-token',
          channels: mockChannels,
          connectedVoiceChannelId: 10,
          onlineUsers: [
            { user_id: 1, user_name: 'Super Admin' },
            { user_id: 2, user_name: 'Membro Teste' },
          ],
          currentUser,
        },
      }
    );

    expect(result.current.voiceChannelUsers[10]).toHaveLength(2);

    act(() => {
      result.current.handleDisconnectVoicePresence(10);
    });

    const afterDisconnect = result.current.voiceChannelUsers[10];
    expect(afterDisconnect).toHaveLength(1);
    expect(afterDisconnect[0].user_id).toBe(2);
  });
});
