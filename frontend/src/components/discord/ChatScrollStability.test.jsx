import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, renderHook, act } from '@testing-library/react';
import { ToastProvider } from '../../context/ToastContext';
import ChatArea from './ChatArea';
import { useChatScroll } from './useChatScroll';
import { useVirtualMessageList } from './useVirtualMessageList';

describe('ChatScrollStability & Feed Performance', () => {
  let mockContainer;

  beforeEach(() => {
    vi.useFakeTimers();
    mockContainer = {
      scrollTop: 0,
      scrollHeight: 2500,
      clientHeight: 600,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('keeps native rendering for 50 messages without virtual spacer distortion (threshold 100)', () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      channel_id: 1,
      author_id: 1,
      author: { id: 1, name: 'User' },
      content: `Mensagem ${i + 1}`,
      created_at: new Date().toISOString(),
      reactions: [],
      is_pinned: false,
    }));

    render(
      <ToastProvider>
        <ChatArea
          channel={{ id: 1, name: 'geral', type: 'TEXT' }}
          messages={messages}
          currentUserId={1}
        />
      </ToastProvider>
    );

    // Com 50 mensagens, não deve ativar spacers virtuais pois threshold é 100
    expect(screen.queryByTestId('virtual-top-spacer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('virtual-bottom-spacer')).not.toBeInTheDocument();

    // Primeira e última mensagem estão ambas no DOM simultaneamente
    expect(screen.getByText('Mensagem 1')).toBeInTheDocument();
    expect(screen.getByText('Mensagem 50')).toBeInTheDocument();
  });

  it('anchors to bottom upon first messages population across multiple frame ticks', () => {
    const { result, rerender } = renderHook(
      ({ messages }) =>
        useChatScroll({
          messages,
          channelId: 1,
          currentUserId: 1,
        }),
      { initialProps: { messages: [] } }
    );

    result.current.messagesContainerRef.current = mockContainer;

    // População inicial com mensagens chegando da API
    rerender({
      messages: [
        { id: 1, content: 'Primeira' },
        { id: 2, content: 'Segunda' },
      ],
    });

    // Avança timers dos ticks de ancoragem (50ms, 150ms, 350ms, 600ms)
    act(() => {
      vi.advanceTimersByTime(650);
    });

    expect(mockContainer.scrollTop).toBe(mockContainer.scrollHeight);
  });

  it('useVirtualMessageList initializes with container scrollTop and remains non-virtual below 100', () => {
    const messages = Array.from({ length: 75 }, (_, i) => ({ id: i + 1, content: `M ${i}` }));
    const ref = {
      current: {
        scrollTop: 450,
        clientHeight: 600,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    };

    const { result } = renderHook(() =>
      useVirtualMessageList({
        messages,
        containerRef: ref,
      })
    );

    expect(result.current.isVirtual).toBe(false);
    expect(result.current.visibleMessages.length).toBe(75);
    expect(result.current.topSpacerHeight).toBe(0);
    expect(result.current.bottomSpacerHeight).toBe(0);
  });
});
