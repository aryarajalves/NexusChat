import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useDiscordUserWS from './useDiscordUserWS';

describe('useDiscordUserWS hook', () => {
  let mockWebSocketInstance = null;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] });

    class MockWebSocket {
      static OPEN = 1;
      static CONNECTING = 0;
      static CLOSING = 2;
      static CLOSED = 3;

      constructor(url) {
        this.url = url;
        this.readyState = 1; // OPEN
        this.send = vi.fn();
        this.close = vi.fn();
        mockWebSocketInstance = this;
      }
    }
    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('conecta ao endpoint /api/v1/discord/ws/me com o token fornecido', () => {
    renderHook(() =>
      useDiscordUserWS({
        token: 'me-jwt-token',
        onUnreadUpdate: vi.fn(),
        onDMMessageNew: vi.fn(),
      })
    );

    expect(mockWebSocketInstance).not.toBeNull();
    expect(mockWebSocketInstance.url).toContain('/api/v1/discord/ws/me?token=me-jwt-token');
  });

  it('encaminha evento unread:update para o callback onUnreadUpdate', () => {
    const handleUnread = vi.fn();
    const handleDMNew = vi.fn();

    renderHook(() =>
      useDiscordUserWS({
        token: 'me-jwt-token',
        onUnreadUpdate: handleUnread,
        onDMMessageNew: handleDMNew,
      })
    );

    act(() => {
      mockWebSocketInstance.onmessage({
        data: JSON.stringify({
          event: 'unread:update',
          type: 'dm',
          conversation_id: 10,
          message_id: 55,
          message: { id: 55, content: 'Oi amigo!' },
        }),
      });
    });

    expect(handleUnread).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'unread:update',
        type: 'dm',
        conversation_id: 10,
      })
    );
    expect(handleDMNew).toHaveBeenCalledWith({ id: 55, content: 'Oi amigo!' });
  });

  it('envia ping de heartbeat periodicamente após conexão aberta', () => {
    renderHook(() =>
      useDiscordUserWS({
        token: 'me-jwt-token',
        onUnreadUpdate: vi.fn(),
        onDMMessageNew: vi.fn(),
      })
    );

    act(() => {
      if (mockWebSocketInstance.onopen) mockWebSocketInstance.onopen();
      vi.advanceTimersByTime(25000);
    });

    expect(mockWebSocketInstance.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'ping', event: 'ping' })
    );
  });
});
