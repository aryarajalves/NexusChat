import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ChatSearchBar from './ChatSearchBar';

describe('ChatSearchBar Component', () => {
  const mockChannel = { id: 10, name: 'geral', type: 'TEXT', is_dm: false };
  const mockDMChannel = { id: 5, name: 'lucas', type: 'TEXT', is_dm: true };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('renders search bar with channel placeholder', () => {
    render(<ChatSearchBar channel={mockChannel} onScrollToMessage={vi.fn()} />);
    const input = screen.getByTestId('chat-search-input');
    expect(input).toBeDefined();
    expect(input.placeholder).toBe('Buscar em #geral');
  });

  it('renders search bar with DM placeholder', () => {
    render(<ChatSearchBar channel={mockDMChannel} onScrollToMessage={vi.fn()} />);
    const input = screen.getByTestId('chat-search-input');
    expect(input.placeholder).toBe('Buscar em @lucas');
  });

  it('does not render for voice channels', () => {
    const { container } = render(
      <ChatSearchBar channel={{ id: 99, name: 'Voz 1', type: 'VOICE' }} onScrollToMessage={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('opens search panel on focus and shows empty state', () => {
    render(<ChatSearchBar channel={mockChannel} onScrollToMessage={vi.fn()} />);
    const input = screen.getByTestId('chat-search-input');
    fireEvent.focus(input);

    expect(screen.getByTestId('chat-search-panel')).toBeDefined();
    expect(screen.getByText('Nenhuma mensagem encontrada.')).toBeDefined();
  });

  it('searches messages and renders results with highlight and count badge', async () => {
    const mockMessages = [
      {
        id: 101,
        author_id: 1,
        author_name: 'Arya',
        content: 'Olá pessoal, esta é uma mensagem de teste',
        created_at: '2026-10-28T14:50:00Z',
        attachment_url: null,
      },
      {
        id: 102,
        author_id: 2,
        author_name: 'Dev',
        content: 'Outro teste com anexo importante',
        created_at: '2026-10-28T14:55:00Z',
        attachment_url: '/uploads/discord/doc.pdf',
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 2,
        channel_id: 10,
        query: 'teste',
        messages: mockMessages,
      }),
    });

    render(<ChatSearchBar channel={mockChannel} onScrollToMessage={vi.fn()} />);
    const input = screen.getByTestId('chat-search-input');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'teste' } });

    await waitFor(() => {
      expect(screen.getByTestId('chat-search-count-badge')).toHaveTextContent('2 resultados');
      expect(screen.getByText('Arya')).toBeDefined();
      expect(screen.getByText('Dev')).toBeDefined();
    });

    expect(screen.getByText('Anexo anexado')).toBeDefined();
  });

  it('calls onScrollToMessage when jump button or result item is clicked', async () => {
    const onScrollMock = vi.fn();
    const mockMessages = [
      {
        id: 205,
        author_id: 1,
        author_name: 'Arya',
        content: 'Alvo da busca encontrado',
        created_at: '2026-10-28T14:50:00Z',
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        total: 1,
        channel_id: 10,
        query: 'alvo',
        messages: mockMessages,
      }),
    });

    render(<ChatSearchBar channel={mockChannel} onScrollToMessage={onScrollMock} />);
    const input = screen.getByTestId('chat-search-input');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'alvo' } });

    await waitFor(() => {
      expect(screen.getByTestId('chat-search-jump-btn-205')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('chat-search-jump-btn-205'));
    expect(onScrollMock).toHaveBeenCalledWith(205);
  });

  it('clears search when clear button is clicked', async () => {
    render(<ChatSearchBar channel={mockChannel} onScrollToMessage={vi.fn()} />);
    const input = screen.getByTestId('chat-search-input');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'palavra' } });

    const clearBtn = screen.getByTestId('chat-search-clear-btn');
    fireEvent.click(clearBtn);

    expect(input.value).toBe('');
  });

  it('closes search panel when Escape key is pressed', () => {
    render(<ChatSearchBar channel={mockChannel} onScrollToMessage={vi.fn()} />);
    const input = screen.getByTestId('chat-search-input');
    fireEvent.focus(input);
    expect(screen.getByTestId('chat-search-panel')).toBeDefined();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('chat-search-panel')).toBeNull();
  });
});
