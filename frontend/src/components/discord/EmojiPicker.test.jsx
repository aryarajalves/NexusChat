import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EmojiPickerPopover from './EmojiPickerPopover';
import ChatMessageItem from './ChatMessageItem';
import { EMOJI_CATEGORIES, searchEmojis, getRecentEmojis, saveRecentEmoji } from './emojiData';

describe('EmojiPickerPopover Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders search input, category tabs, emoji grid, and footer preview', () => {
    render(<EmojiPickerPopover onSelectEmoji={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByTestId('chat-input-emoji-picker')).toBeInTheDocument();
    expect(screen.getByTestId('emoji-search-input')).toBeInTheDocument();
    expect(screen.getByTestId('emoji-picker-tabs')).toBeInTheDocument();
    expect(screen.getByTestId('emoji-picker-body')).toBeInTheDocument();
    expect(screen.getByTestId('emoji-picker-footer')).toBeInTheDocument();
  });

  it('allows switching between category tabs', () => {
    render(<EmojiPickerPopover onSelectEmoji={vi.fn()} onClose={vi.fn()} />);

    // Verifica que as abas existem
    EMOJI_CATEGORIES.forEach((cat) => {
      expect(screen.getByTestId(`emoji-tab-${cat.id}`)).toBeInTheDocument();
    });

    // Clica na aba de Comidas & Bebidas
    const foodTab = screen.getByTestId('emoji-tab-food');
    fireEvent.click(foodTab);
    expect(foodTab).toHaveClass('active');
  });

  it('filters emojis in real time using search input and handles empty results', () => {
    render(<EmojiPickerPopover onSelectEmoji={vi.fn()} onClose={vi.fn()} />);

    const searchInput = screen.getByTestId('emoji-search-input');

    // Pesquisa por "fogo"
    fireEvent.change(searchInput, { target: { value: 'fogo' } });

    // Aba de abas oculta durante busca
    expect(screen.queryByTestId('emoji-picker-tabs')).not.toBeInTheDocument();
    expect(screen.getByTestId('input-emoji-select-🔥')).toBeInTheDocument();

    // Botão de limpar busca
    const clearBtn = screen.getByTestId('clear-emoji-search-btn');
    fireEvent.click(clearBtn);
    expect(searchInput.value).toBe('');
    expect(screen.getByTestId('emoji-picker-tabs')).toBeInTheDocument();

    // Pesquisa inexistente
    fireEvent.change(searchInput, { target: { value: 'termoinexistente12345' } });
    expect(screen.getByTestId('emoji-search-empty')).toBeInTheDocument();
  });

  it('calls onSelectEmoji and saves emoji to recent list in localStorage', () => {
    const handleSelect = vi.fn();
    render(<EmojiPickerPopover onSelectEmoji={handleSelect} onClose={vi.fn()} />);

    const heartEmoji = screen.getByTestId('input-emoji-select-❤️');
    fireEvent.click(heartEmoji);

    expect(handleSelect).toHaveBeenCalledWith('❤️');

    // Verifica que salvou em localStorage
    const savedRecents = getRecentEmojis();
    expect(savedRecents).toContain('❤️');
  });

  it('updates preview symbol and name in footer on hover', () => {
    render(<EmojiPickerPopover onSelectEmoji={vi.fn()} onClose={vi.fn()} />);

    const flameEmoji = screen.getByTestId('input-emoji-select-🔥');
    fireEvent.mouseEnter(flameEmoji);

    expect(screen.getByTestId('emoji-preview-symbol')).toHaveTextContent('🔥');
    expect(screen.getByTestId('emoji-preview-name')).toHaveTextContent('Fogo / Chama');
  });

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(<EmojiPickerPopover onSelectEmoji={vi.fn()} onClose={handleClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});

describe('ChatMessageItem Full Emoji Reaction Integration', () => {
  const mockMsg = {
    id: 99,
    content: 'Olá pessoal!',
    author_id: 1,
    author_name: 'Admin',
    created_at: '2026-10-28T18:00:00Z',
    reactions: [],
  };

  it('opens quick emoji bar, clicks more button to open full emoji picker, and reacts', () => {
    const handleToggleReaction = vi.fn();
    render(
      <ChatMessageItem
        msg={mockMsg}
        channelId={1}
        currentUserId={1}
        currentUserRole="ADMIN"
        onToggleReaction={handleToggleReaction}
      />
    );

    // Clica no botão de hover de reação
    const reactBtn = screen.getByTestId('hover-react-btn-99');
    fireEvent.click(reactBtn);

    // Abre popover rápido
    expect(screen.getByTestId('quick-emoji-popover-99')).toBeInTheDocument();

    // Clica no botão de mais emojis
    const moreBtn = screen.getByTestId('open-full-emoji-picker-99');
    fireEvent.click(moreBtn);

    // Popover rápido fecha e o completo abre
    expect(screen.queryByTestId('quick-emoji-popover-99')).not.toBeInTheDocument();
    expect(screen.getByTestId('full-emoji-picker-99')).toBeInTheDocument();

    // Seleciona um emoji no picker completo
    const selectedEmojiBtn = screen.getByTestId('reaction-emoji-select-🚀');
    fireEvent.click(selectedEmojiBtn);

    expect(handleToggleReaction).toHaveBeenCalledWith(1, 99, '🚀');
    expect(screen.queryByTestId('full-emoji-picker-99')).not.toBeInTheDocument();
  });
});
