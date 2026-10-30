import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDiscordSocket } from './useDiscordSocket';

class MockWebSocket {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.sentData = [];
    MockWebSocket.instances.push(this);
  }

  send(data) {
    this.sentData.push(data);
  }

  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose();
    }
  }

  simulateOpen() {
    this.readyState = 1; // OPEN
    if (this.onopen) {
      this.onopen();
    }
  }

  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    }
  }

  simulateError(err) {
    if (this.onerror) {
      this.onerror(err);
    }
  }
}

describe('useDiscordSocket Hook', () => {
  let originalWebSocket;

  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    originalWebSocket = global.WebSocket;
    global.WebSocket = MockWebSocket;
    MockWebSocket.OPEN = 1;
    MockWebSocket.CLOSED = 3;
  });

  afterEach(() => {
    global.WebSocket = originalWebSocket;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('initializes with connecting status and connects when channelId and token are provided', () => {
    const { result } = renderHook(() =>
      useDiscordSocket({
        channelId: 10,
        token: 'auth-test-token',
      })
    );

    expect(result.current.connectionStatus).toBe('connecting');
    expect(MockWebSocket.instances.length).toBe(1);
    expect(MockWebSocket.instances[0].url).toContain('/api/v1/discord/ws/channels/10?token=auth-test-token');

    // Simula abertura da conexão
    act(() => {
      MockWebSocket.instances[0].simulateOpen();
    });

    expect(result.current.connectionStatus).toBe('connected');
  });

  it('sends heartbeat ping every 25 seconds when connected', () => {
    renderHook(() =>
      useDiscordSocket({
        channelId: 10,
        token: 'auth-test-token',
      })
    );

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateOpen();
    });

    expect(ws.sentData).toEqual([]);

    // Avança 25 segundos
    act(() => {
      vi.advanceTimersByTime(25000);
    });

    expect(ws.sentData).toContain(JSON.stringify({ event: 'ping' }));
  });

  it('attempts resilient auto-reconnect on unexpected connection loss', () => {
    const { result } = renderHook(() =>
      useDiscordSocket({
        channelId: 10,
        token: 'auth-test-token',
      })
    );

    const ws1 = MockWebSocket.instances[0];
    act(() => {
      ws1.simulateOpen();
    });
    expect(result.current.connectionStatus).toBe('connected');

    // Simula queda de conexão inesperada
    act(() => {
      ws1.simulateError(new Error('Network offline'));
    });

    // Deve transicionar para connecting
    expect(result.current.connectionStatus).toBe('connecting');

    // Avança 3.5 segundos para a reconexão automática
    act(() => {
      vi.advanceTimersByTime(3500);
    });

    // Um novo WebSocket deve ter sido instanciado
    expect(MockWebSocket.instances.length).toBe(2);
    const ws2 = MockWebSocket.instances[1];

    act(() => {
      ws2.simulateOpen();
    });

    expect(result.current.connectionStatus).toBe('connected');
  });

  it('cleans up and closes socket on unmount without scheduling reconnect', () => {
    const { unmount } = renderHook(() =>
      useDiscordSocket({
        channelId: 10,
        token: 'auth-test-token',
      })
    );

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.simulateOpen();
    });

    unmount();
    expect(ws.readyState).toBe(3); // CLOSED

    // Avança o timer e valida que nenhuma nova conexão foi aberta
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(MockWebSocket.instances.length).toBe(1);
  });
});
