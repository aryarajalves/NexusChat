import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MentionAutocompletePopover from './MentionAutocompletePopover';
import ChatInputForm from './ChatInputForm';
import ChatMessageItem from './ChatMessageItem';
import { renderContentWithMentions } from './chatUtils';
import { ToastProvider } from '../../context/ToastContext';

describe('MentionAutocompletePopover Component', () => {
  const mockMembers = [
    { user_id: 1, name: 'Admin', nickname: 'SuperAdmin', role: 'OWNER' },
    { user_id: 2, name: 'Aryaraj', nickname: '', role: 'MEMBER' },
    { user_id: 3, name: 'Carlos', nickname: 'DevCarlos', role: 'MEMBER' },
  ];

  it('renders special mentions (@everyone, @here) and member list', () => {
    render(
      <MentionAutocompletePopover
        query=""
        members={mockMembers}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByTestId('mention-autocomplete-popover')).toBeInTheDocument();
    expect(screen.getByTestId('mention-item-everyone')).toBeInTheDocument();
    expect(screen.getByTestId('mention-item-here')).toBeInTheDocument();
    expect(screen.getByTestId('mention-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('mention-item-2')).toBeInTheDocument();
  });

  it('filters mentions by search query', () => {
    render(
      <MentionAutocompletePopover
        query="arya"
        members={mockMembers}
        selectedIndex={0}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByTestId('mention-item-2')).toBeInTheDocument();
    expect(screen.queryByTestId('mention-item-everyone')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mention-item-3')).not.toBeInTheDocument();
  });

  it('calls onSelect with the selected item when clicked', () => {
    const handleSelect = vi.fn();
    render(
      <MentionAutocompletePopover
        query=""
        members={mockMembers}
        selectedIndex={0}
        onSelect={handleSelect}
      />
    );

    fireEvent.click(screen.getByTestId('mention-item-everyone'));
    expect(handleSelect).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'everyone', isSpecial: true })
    );
  });
});

describe('ChatInputForm Mention Trigger and Keyboard Autocomplete', () => {
  const mockMembers = [
    { user_id: 10, name: 'Aryaraj', nickname: '', role: 'MEMBER' },
    { user_id: 20, name: 'Beatriz', nickname: '', role: 'MEMBER' },
  ];

  it('opens mention popover when typing @ and selects mention with Enter', () => {
    const handleSendMessage = vi.fn();
    render(
      <ToastProvider>
        <ChatInputForm
          channel={{ id: 1, name: 'geral' }}
          members={mockMembers}
          onSendMessage={handleSendMessage}
        />
      </ToastProvider>
    );

    const input = screen.getByTestId('chat-message-input');

    // Digita "Olá @"
    fireEvent.change(input, { target: { value: 'Olá @', selectionStart: 5 } });

    // O popover de menção é aberto
    expect(screen.getByTestId('mention-autocomplete-popover')).toBeInTheDocument();

    // Pressiona Enter para selecionar o primeiro item (@everyone)
    fireEvent.keyDown(input, { key: 'Enter' });

    // O input recebe "@everyone " e fecha o popover
    expect(input.value).toBe('Olá @everyone ');
    expect(screen.queryByTestId('mention-autocomplete-popover')).not.toBeInTheDocument();
  });

  it('navigates with ArrowDown and ArrowUp in mention list', () => {
    render(
      <ToastProvider>
        <ChatInputForm
          channel={{ id: 1, name: 'geral' }}
          members={mockMembers}
          onSendMessage={vi.fn()}
        />
      </ToastProvider>
    );

    const input = screen.getByTestId('chat-message-input');
    fireEvent.change(input, { target: { value: '@', selectionStart: 1 } });

    expect(screen.getByTestId('mention-autocomplete-popover')).toBeInTheDocument();

    // Navega para baixo
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    // Navega para cima
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    // Pressiona Escape para fechar
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('mention-autocomplete-popover')).not.toBeInTheDocument();
  });

  it('clicks a mention item from popover to insert it into text', () => {
    render(
      <ToastProvider>
        <ChatInputForm
          channel={{ id: 1, name: 'geral' }}
          members={mockMembers}
          onSendMessage={vi.fn()}
        />
      </ToastProvider>
    );

    const input = screen.getByTestId('chat-message-input');
    fireEvent.change(input, { target: { value: 'Oi @Ar', selectionStart: 6 } });

    const memberItem = screen.getByTestId('mention-item-10');
    fireEvent.click(memberItem);

    expect(input.value).toBe('Oi @Aryaraj ');
    expect(screen.queryByTestId('mention-autocomplete-popover')).not.toBeInTheDocument();
  });
});

describe('ChatMessageItem Mention Rendering & Highlighting', () => {
  const currentUser = { id: 1, name: 'Aryaraj', email: 'aryaraj@test.com' };

  it('renders mention chips and applies .is-mentioned when message mentions currentUser', () => {
    const msg = {
      id: 50,
      content: 'E aí @Aryaraj você viu isso?',
      author_id: 2,
      author_name: 'Carlos',
      created_at: '2026-10-28T18:00:00Z',
    };

    render(
      <ChatMessageItem
        msg={msg}
        channelId={1}
        currentUserId={currentUser.id}
        currentUser={currentUser}
      />
    );

    // Container tem destaque .is-mentioned
    const row = screen.getByTestId('message-item-50');
    expect(row).toHaveClass('is-mentioned');

    // Contém pílula de menção com estilo .is-me
    const pill = screen.getByTestId('mention-pill');
    expect(pill).toBeInTheDocument();
    expect(pill).toHaveTextContent('@Aryaraj');
    expect(pill).toHaveClass('is-me');
  });

  it('applies .is-mentioned when message contains @everyone or @here', () => {
    const msg = {
      id: 51,
      content: 'Atenção @everyone reunião iniciada!',
      author_id: 2,
      author_name: 'Carlos',
      created_at: '2026-10-28T18:00:00Z',
    };

    render(
      <ChatMessageItem
        msg={msg}
        channelId={1}
        currentUserId={currentUser.id}
        currentUser={currentUser}
      />
    );

    const row = screen.getByTestId('message-item-51');
    expect(row).toHaveClass('is-mentioned');

    const pill = screen.getByTestId('mention-pill');
    expect(pill).toHaveTextContent('@everyone');
    expect(pill).toHaveClass('is-me');
  });

  it('does NOT apply .is-mentioned when message mentions another user', () => {
    const msg = {
      id: 52,
      content: 'Oi @Beatriz tudo bem?',
      author_id: 2,
      author_name: 'Carlos',
      created_at: '2026-10-28T18:00:00Z',
    };

    render(
      <ChatMessageItem
        msg={msg}
        channelId={1}
        currentUserId={currentUser.id}
        currentUser={currentUser}
      />
    );

    const row = screen.getByTestId('message-item-52');
    expect(row).not.toHaveClass('is-mentioned');

    const pill = screen.getByTestId('mention-pill');
    expect(pill).toHaveTextContent('@Beatriz');
    expect(pill).not.toHaveClass('is-me');
  });

  it('renderContentWithMentions returns array of nodes with formatted mentions', () => {
    const result = renderContentWithMentions('Fala @Aryaraj e @outro', 'Aryaraj');
    expect(result.length).toBeGreaterThan(1);
  });
});
