import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import ChatArea from './ChatArea';
import { useVirtualMessageList } from './useVirtualMessageList';
import { ToastProvider } from '../../context/ToastContext';

describe('ChatArea Virtualization & Scalability', () => {
  const mockChannel = { id: 1, name: 'geral', type: 'TEXT' };

  const generateMessages = (count) => {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      channel_id: 1,
      author_id: 99,
      content: `Mensagem de teste #${i + 1}`,
      author: { id: 99, name: 'Usuário Teste' },
      created_at: new Date(2026, 9, 29, 10, i).toISOString(),
      reactions: [],
      is_pinned: false,
    }));
  };

  it('renders all messages directly when count is below virtualization threshold (<= 40)', () => {
    const messages = generateMessages(25);

    render(
      <ToastProvider>
        <ChatArea
          channel={mockChannel}
          messages={messages}
          currentUserId={99}
        />
      </ToastProvider>
    );

    expect(screen.queryByTestId('virtual-top-spacer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('virtual-bottom-spacer')).not.toBeInTheDocument();
    expect(screen.getByText('Mensagem de teste #1')).toBeInTheDocument();
    expect(screen.getByText('Mensagem de teste #25')).toBeInTheDocument();
  });

  it('activates virtual spacers and slices DOM nodes when message count exceeds 40', () => {
    const messages = generateMessages(150);

    render(
      <ToastProvider>
        <ChatArea
          channel={mockChannel}
          messages={messages}
          currentUserId={99}
        />
      </ToastProvider>
    );

    // Spacer inferior deve estar presente para preservar a rolagem
    expect(screen.getByTestId('virtual-bottom-spacer')).toBeInTheDocument();

    // Mensagens do início do lote estão renderizadas
    expect(screen.getByText('Mensagem de teste #1')).toBeInTheDocument();

    // Mensagens distantes do final não devem estar no DOM simultaneamente
    expect(screen.queryByText('Mensagem de teste #140')).not.toBeInTheDocument();
  });

  it('useVirtualMessageList hook dynamically updates visible range on simulated scroll', () => {
    const messages = generateMessages(100);
    const mockContainer = {
      current: {
        scrollTop: 0,
        clientHeight: 600,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    };

    const { result } = renderHook(() =>
      useVirtualMessageList({
        messages,
        containerRef: mockContainer,
        enabledThreshold: 40,
        itemHeight: 50,
        overscan: 5,
      })
    );

    expect(result.current.isVirtual).toBe(true);
    expect(result.current.visibleMessages.length).toBeLessThan(100);

    // Simula rolagem para o meio da lista
    act(() => {
      mockContainer.current.scrollTop = 2500;
      result.current.handleScroll();
    });

    expect(result.current.topSpacerHeight).toBeGreaterThan(0);
    expect(result.current.startIndex).toBeGreaterThan(10);
  });
});
