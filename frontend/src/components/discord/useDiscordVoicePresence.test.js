import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useDiscordVoicePresence from './useDiscordVoicePresence';
import * as discordSounds from './discordSounds';

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
        avatar_url: null,
        is_muted: true,
        is_deafened: false,
        is_speaking: false,
        is_screen_sharing: false,
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

  it('deve remover currentUser do canal anterior ao trocar de canal de voz (switch channel sem duplicar)', async () => {
    const mockChannels = [
      { id: 10, name: 'sala-a', type: 'VOICE' },
      { id: 20, name: 'sala-b', type: 'VOICE' },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ active_participants: [] }),
    });

    const currentUser = { id: 1, name: 'Super Admin' };

    const { result, rerender, unmount } = renderHook(
      (props) => useDiscordVoicePresence(props),
      {
        initialProps: {
          token: 'test-token',
          channels: mockChannels,
          connectedVoiceChannelId: 10,
          currentUser,
        },
      }
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Inicialmente está conectado na Sala 10
    expect(result.current.voiceChannelUsers[10]?.some((u) => u.user_id === 1)).toBe(true);
    expect(result.current.voiceChannelUsers[20]?.some((u) => u.user_id === 1)).toBeFalsy();

    // Troca diretamente para a Sala 20
    act(() => {
      rerender({
        token: 'test-token',
        channels: mockChannels,
        connectedVoiceChannelId: 20,
        currentUser,
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    // O usuário foi removido da Sala 10 e está exclusivamente na Sala 20
    expect(result.current.voiceChannelUsers[10]?.some((u) => u.user_id === 1)).toBe(false);
    expect(result.current.voiceChannelUsers[20]?.some((u) => u.user_id === 1)).toBe(true);
    unmount();
  });

  it('deve remover usuário remoto (ex: Hokage) da sala anterior e limpar o timer ao receber voice:channel_update na nova sala', async () => {
    const mockChannels = [
      { id: 10, name: 'Sala de Voz', type: 'VOICE' },
      { id: 20, name: 'gados-de-lula', type: 'VOICE' },
    ];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ active_participants: [] }),
    });

    const currentUser = { id: 1, name: 'Super Admin' };

    const { result, unmount } = renderHook(() =>
      useDiscordVoicePresence({
        token: 'test-token',
        channels: mockChannels,
        connectedVoiceChannelId: null,
        currentUser,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    // 1. Hokage (user_id: 2) entra na Sala 10 (Sala de Voz)
    act(() => {
      result.current.handleVoiceChannelUpdate({
        channel_id: 10,
        active_participants: [{ user_id: 2, user_name: 'Hokage', avatar_url: '/avatars/hokage.png' }],
        total_participants: 1,
        call_started_at: 1700000000,
      });
    });

    expect(result.current.voiceChannelUsers[10]).toHaveLength(1);
    expect(result.current.voiceChannelUsers[10][0].user_name).toBe('Hokage');
    expect(result.current.voiceChannelCallTimes[10]).toBe(1700000000);

    // 2. Hokage troca rapidamente para a Sala 20 (gados-de-lula)
    act(() => {
      result.current.handleVoiceChannelUpdate({
        channel_id: 20,
        active_participants: [{ user_id: 2, user_name: 'Hokage', avatar_url: '/avatars/hokage.png' }],
        total_participants: 1,
        call_started_at: 1700000010,
      });
    });

    // Hokage deve ter saído automaticamente da Sala 10 (sem duplicação visual) e estar apenas na Sala 20
    expect(result.current.voiceChannelUsers[10]).toHaveLength(0);
    expect(result.current.voiceChannelUsers[20]).toHaveLength(1);
    expect(result.current.voiceChannelUsers[20][0].user_name).toBe('Hokage');

    // O timer da Sala 10 vazia deve ter sido limpo e apenas a Sala 20 mantém timer ativo
    expect(result.current.voiceChannelCallTimes[10]).toBeUndefined();
    expect(result.current.voiceChannelCallTimes[20]).toBe(1700000010);
    unmount();
  });

  it('não deve disparar voice-leave-all no unmount padrão do componente React', async () => {
    const mockChannels = [{ id: 10, name: 'Sala de Voz', type: 'VOICE' }];
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ active_participants: [] }),
    });
    global.fetch = fetchSpy;

    const currentUser = { id: 1, name: 'Super Admin' };

    const { unmount } = renderHook(() =>
      useDiscordVoicePresence({
        token: 'test-token',
        channels: mockChannels,
        connectedVoiceChannelId: 10,
        currentUser,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    // Valida que o unmount comum NÃO enviou voice-leave-all
    const leaveAllCalls = fetchSpy.mock.calls.filter(([url]) =>
      String(url).includes('voice-leave-all')
    );
    expect(leaveAllCalls).toHaveLength(0);
  });

  it('dispara efeito sonoro voice_join e voice_leave quando outro participante entra ou sai da sala conectada', async () => {
    const playSoundSpy = vi.spyOn(discordSounds, 'playDiscordSound').mockImplementation(() => true);
    const mockChannels = [{ id: 10, name: 'Sala Conectada', type: 'VOICE' }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ active_participants: [] }),
    });

    const currentUser = { id: 1, name: 'Super Admin' };

    const { result, unmount } = renderHook(() =>
      useDiscordVoicePresence({
        token: 'test-token',
        channels: mockChannels,
        connectedVoiceChannelId: 10,
        currentUser,
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    playSoundSpy.mockClear();

    // 1. Outro usuário (ID 2 - Hokage) entra na mesma sala (canal 10)
    act(() => {
      result.current.handleVoiceChannelUpdate({
        channel_id: 10,
        active_participants: [
          { user_id: 1, user_name: 'Super Admin' },
          { user_id: 2, user_name: 'Hokage' },
        ],
        total_participants: 2,
      });
    });

    expect(playSoundSpy).toHaveBeenCalledWith('voice_join');

    playSoundSpy.mockClear();

    // 2. Hokage sai da sala (canal 10)
    act(() => {
      result.current.handleVoiceChannelUpdate({
        channel_id: 10,
        active_participants: [
          { user_id: 1, user_name: 'Super Admin' },
        ],
        total_participants: 1,
      });
    });

    expect(playSoundSpy).toHaveBeenCalledWith('voice_leave');

    playSoundSpy.mockClear();

    // 3. Alteração em outra sala (canal 99) onde o usuário NÃO está conectado não deve disparar som
    act(() => {
      result.current.handleVoiceChannelUpdate({
        channel_id: 99,
        active_participants: [
          { user_id: 3, user_name: 'Outro Usuário' },
        ],
        total_participants: 1,
      });
    });

    expect(playSoundSpy).not.toHaveBeenCalled();

    playSoundSpy.mockRestore();
    unmount();
  });
});
