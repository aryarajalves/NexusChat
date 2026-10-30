import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLiveKitVoice } from './useLiveKitVoice';

describe('useLiveKitVoice Hook (Fase 3 SFU)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    localStorage.clear();
  });

  it('initializes in idle state when channelId is not provided', () => {
    const { result } = renderHook(() => useLiveKitVoice(null));
    expect(result.current.sfuStatus).toBe('idle');
    expect(result.current.voiceCredentials).toBeNull();
    expect(result.current.isSfuActive).toBe(false);
  });

  it('fetches credentials and transitions to connected when SFU is available using authToken param', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        livekit_url: 'ws://localhost:7880',
        token: 'mock-jwt-token-sfu',
        room_name: 'channel_10',
        participant_identity: 'user_1',
        participant_name: 'Super Admin',
        is_sfu_available: true,
      }),
    });

    const { result } = renderHook(() => useLiveKitVoice(10, 'test-jwt'));

    await waitFor(() => {
      expect(result.current.sfuStatus).toBe('connected');
    });

    expect(result.current.isSfuActive).toBe(true);
    expect(result.current.voiceCredentials.token).toBe('mock-jwt-token-sfu');
    expect(result.current.voiceCredentials.room_name).toBe('channel_10');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/discord/channels/10/voice-token',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt',
        }),
      })
    );
  });

  it('retrieves auth_token from localStorage when authToken parameter is omitted', async () => {
    localStorage.setItem('auth_token', 'stored-auth-token-123');

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        livekit_url: 'ws://localhost:7880',
        token: 'mock-livekit-token',
        room_name: 'channel_20',
        participant_identity: 'user_2',
        is_sfu_available: true,
      }),
    });

    const { result } = renderHook(() => useLiveKitVoice(20));

    await waitFor(() => {
      expect(result.current.sfuStatus).toBe('connected');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/discord/channels/20/voice-token',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer stored-auth-token-123',
        }),
      })
    );
  });

  it('falls back to fallback state without throwing 401 when no token is available', async () => {
    const { result } = renderHook(() => useLiveKitVoice(10));

    await waitFor(() => {
      expect(result.current.sfuStatus).toBe('fallback');
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.isSfuActive).toBe(false);
  });

  it('falls back gracefully to mesh mode if backend fetch fails or SFU is disabled', async () => {
    localStorage.setItem('auth_token', 'valid-token');
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useLiveKitVoice(10));

    await waitFor(() => {
      expect(result.current.sfuStatus).toBe('fallback');
    });

    expect(result.current.isSfuActive).toBe(false);
  });
});
