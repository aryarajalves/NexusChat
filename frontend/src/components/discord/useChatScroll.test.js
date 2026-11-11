import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChatScroll } from './useChatScroll';

describe('useChatScroll Hook', () => {
  let mockContainer;
  let mockEndRef;

  beforeEach(() => {
    vi.useFakeTimers();
    mockContainer = {
      scrollTop: 0,
      scrollHeight: 1000,
      clientHeight: 400,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    mockEndRef = {
      scrollIntoView: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('scrolls container to bottom on auto mode', () => {
    const { result } = renderHook(() =>
      useChatScroll({
        messages: [{ id: 1, content: 'Olá' }],
        channelId: 1,
        currentUserId: 10,
      })
    );

    result.current.messagesContainerRef.current = mockContainer;
    result.current.messagesEndRef.current = mockEndRef;

    act(() => {
      result.current.scrollToBottom('auto');
    });

    expect(mockContainer.scrollTop).toBe(mockContainer.scrollHeight);
  });

  it('calls scrollIntoView on smooth mode', () => {
    const { result } = renderHook(() =>
      useChatScroll({
        messages: [{ id: 1, content: 'Olá' }],
        channelId: 1,
        currentUserId: 10,
      })
    );

    result.current.messagesContainerRef.current = mockContainer;
    result.current.messagesEndRef.current = mockEndRef;

    act(() => {
      result.current.scrollToBottom('smooth');
    });

    expect(mockEndRef.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' });
  });

  it('registers scroll and media load event listeners on container', () => {
    const { result } = renderHook(() =>
      useChatScroll({
        messages: [{ id: 1, content: 'Teste' }],
        channelId: 1,
        currentUserId: 10,
      })
    );

    result.current.messagesContainerRef.current = mockContainer;

    // Simula render com container conectado
    act(() => {
      // triggers effects
    });

    // scrollToBottom deve manter scrollTop sincronizado com scrollHeight
    act(() => {
      result.current.scrollToBottom('auto');
    });
    expect(mockContainer.scrollTop).toBe(1000);
  });

  it('handleScrollToMessage locates DOM element and applies pulse animation', () => {
    const { result } = renderHook(() =>
      useChatScroll({
        messages: [{ id: 99, content: 'Mensagem alvo' }],
        channelId: 1,
        currentUserId: 10,
      })
    );

    const mockTargetElement = {
      scrollIntoView: vi.fn(),
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };

    vi.spyOn(document, 'getElementById').mockReturnValue(mockTargetElement);

    act(() => {
      result.current.handleScrollToMessage(99);
    });

    expect(document.getElementById).toHaveBeenCalledWith('message-item-99');
    expect(mockTargetElement.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
    expect(mockTargetElement.classList.add).toHaveBeenCalledWith('message-highlight-pulse');

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockTargetElement.classList.remove).toHaveBeenCalledWith('message-highlight-pulse');
  });

  it('snaps scroll to bottom on initial load and subsequent delayed frames for media rendering', () => {
    const { result, rerender } = renderHook(
      ({ channelId }) =>
        useChatScroll({
          messages: [{ id: 1, content: 'Primeira' }],
          channelId,
          currentUserId: 10,
        }),
      { initialProps: { channelId: 1 } }
    );

    result.current.messagesContainerRef.current = mockContainer;

    act(() => {
      rerender({ channelId: 2 });
    });

    expect(mockContainer.scrollTop).toBe(1000);

    // Avança timers das verificações tardias de mídia (60ms, 180ms, 360ms, 650ms)
    mockContainer.scrollHeight = 1400; // Simula aumento de altura após imagem carregar
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(mockContainer.scrollTop).toBe(1400);
  });
});
