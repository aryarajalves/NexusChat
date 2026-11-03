import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import ChatArea from './ChatArea';
import ThreadSidePanel from './ThreadSidePanel';
import CreateThreadModal from './CreateThreadModal';
import { ToastProvider } from '../../context/ToastContext';

describe('Sistema de Tópicos (Threads) nas Mensagens do Canal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  const mockChannel = { id: 1, name: 'geral', type: 'TEXT', is_dm: false };
  const mockMessages = [
    {
      id: 101,
      channel_id: 1,
      author_id: 1,
      author_name: 'aryaraj',
      content: 'oieee',
      created_at: '2026-11-02T10:00:00Z',
      reactions: [],
      thread: null,
    },
    {
      id: 102,
      channel_id: 1,
      author_id: 2,
      author_name: 'coringa',
      content: 'Mensagem com tópico já existente',
      created_at: '2026-11-02T10:05:00Z',
      reactions: [],
      thread: {
        id: 55,
        channel_id: 1,
        root_message_id: 102,
        name: 'oieee',
        message_count: 1,
        last_message_content: 'teste',
        last_message_author: 'aryaraj',
        last_message_at: '2026-11-02T10:06:00Z',
      },
    },
  ];

  it('renderiza o badge de tópico com contador e prévia na mensagem que possui thread', () => {
    render(
      <ToastProvider>
        <ChatArea
          channel={mockChannel}
          messages={mockMessages}
          currentUserId={1}
          currentUserRole="ADMIN"
          currentUser={{ id: 1, name: 'aryaraj' }}
        />
      </ToastProvider>
    );

    expect(screen.getByTestId('thread-badge-wrap-102')).toBeInTheDocument();
    expect(screen.getByText('1 mensagem ›')).toBeInTheDocument();
    expect(screen.getByText('teste')).toBeInTheDocument();
  });

  it('cria o tópico diretamente sem modal e abre o painel lateral ao clicar em Criar Tópico', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 77,
        channel_id: 1,
        root_message_id: 101,
        creator_id: 1,
        creator_name: 'aryaraj',
        name: 'oieee',
        created_at: '2026-11-02T10:10:00Z',
        root_message: mockMessages[0],
        messages: [],
      }),
    });

    render(
      <ToastProvider>
        <ChatArea
          channel={mockChannel}
          messages={mockMessages}
          currentUserId={1}
          currentUserRole="ADMIN"
          currentUser={{ id: 1, name: 'aryaraj' }}
        />
      </ToastProvider>
    );

    // Abre o menu de 3 pontinhos da primeira mensagem
    const moreBtn = screen.getByTestId('hover-more-btn-101');
    fireEvent.click(moreBtn);

    const threadAction = screen.getByTestId('more-thread-action-101');
    expect(threadAction).toHaveTextContent('Criar Tópico');
    fireEvent.click(threadAction);

    // Abre direto o painel lateral sem exigir modal nem digitação de nome
    await waitFor(() => {
      expect(screen.getByTestId('thread-side-panel')).toBeInTheDocument();
      expect(screen.getAllByText('oieee').length).toBeGreaterThan(0);
      expect(screen.getByPlaceholderText('Conversar em "oieee"')).toBeInTheDocument();
    });
  });

  it('abre o painel lateral ao clicar no card de tópico da mensagem', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 55,
        channel_id: 1,
        root_message_id: 102,
        creator_id: 1,
        creator_name: 'aryaraj',
        name: 'oieee',
        created_at: '2026-11-02T10:05:00Z',
        root_message: mockMessages[1],
        messages: [
          {
            id: 201,
            thread_id: 55,
            author_id: 1,
            author_name: 'aryaraj',
            content: 'teste',
            created_at: '2026-11-02T10:06:00Z',
          },
        ],
      }),
    });

    render(
      <ToastProvider>
        <ChatArea
          channel={mockChannel}
          messages={mockMessages}
          currentUserId={1}
          currentUserRole="ADMIN"
          currentUser={{ id: 1, name: 'aryaraj' }}
        />
      </ToastProvider>
    );

    const openCard = screen.getByTestId('open-thread-card-102');
    fireEvent.click(openCard);

    await waitFor(() => {
      expect(screen.getByTestId('thread-side-panel')).toBeInTheDocument();
      expect(screen.getByTestId('thread-msg-201')).toBeInTheDocument();
    });
  });

  it('permite enviar resposta dentro do painel lateral de tópico', async () => {
    const mockSend = vi.fn();
    const threadData = {
      id: 55,
      channel_id: 1,
      root_message_id: 102,
      creator_name: 'aryaraj',
      name: 'oieee',
      created_at: '2026-11-02T10:05:00Z',
      root_message: mockMessages[1],
      messages: [],
    };

    render(
      <ThreadSidePanel
        isOpen={true}
        onClose={vi.fn()}
        threadDetail={threadData}
        onSendThreadMessage={mockSend}
        currentUserId={1}
      />
    );

    const input = screen.getByTestId('thread-message-input');
    fireEvent.change(input, { target: { value: 'Nova resposta da thread' } });

    const sendBtn = screen.getByTestId('thread-send-btn');
    fireEvent.click(sendBtn);

    expect(mockSend).toHaveBeenCalledWith(55, 'Nova resposta da thread');
  });
});
