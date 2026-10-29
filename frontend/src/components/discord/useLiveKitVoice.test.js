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

  it('fetches credentials and transitions to connected when SFU is available', async () => {
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
  });

  it('falls back gracefully to mesh mode if backend fetch fails or SFU is disabled', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useLiveKitVoice(10));

    await waitFor(() => {
      expect(result.current.sfuStatus).toBe('fallback');
    });

    expect(result.current.isSfuActive).toBe(false);
  });
});
