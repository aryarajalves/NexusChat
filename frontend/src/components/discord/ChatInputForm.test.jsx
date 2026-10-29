import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ToastProvider } from '../../context/ToastContext';
import ChatInputForm from './ChatInputForm';

describe('ChatInputForm Component', () => {
  const mockChannel = { id: 1, name: 'geral', is_dm: false };
  const mockDMChannel = { id: 2, name: 'rodrigo', is_dm: true };

  const renderWithToast = (ui) => render(<ToastProvider>{ui}</ToastProvider>);

  it('renders input with channel and DM placeholders', () => {
    const { rerender } = renderWithToast(
      <ChatInputForm channel={mockChannel} onSendMessage={vi.fn()} />
    );
    expect(screen.getByTestId('chat-message-input').placeholder).toBe('Conversar em #geral');

    rerender(
      <ToastProvider>
        <ChatInputForm channel={mockDMChannel} onSendMessage={vi.fn()} />
      </ToastProvider>
    );
    expect(screen.getByTestId('chat-message-input').placeholder).toBe('Conversar com @rodrigo');
  });

  it('handles text input and sends message on submit', async () => {
    const onSendMessageMock = vi.fn().mockResolvedValue({});
    renderWithToast(<ChatInputForm channel={mockChannel} onSendMessage={onSendMessageMock} />);

    const input = screen.getByTestId('chat-message-input');
    fireEvent.change(input, { target: { value: 'Olá Discord Clone!' } });
    expect(input.value).toBe('Olá Discord Clone!');

    const sendBtn = screen.getByTestId('chat-send-btn');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(onSendMessageMock).toHaveBeenCalledWith({
        content: 'Olá Discord Clone!',
        attachment_url: undefined,
        attachment_type: undefined,
        attachment_size: undefined,
        reply_to_id: null,
      });
      expect(input.value).toBe('');
    });
  });

  it('renders reply banner and allows canceling reply', () => {
    const onCancelReplyMock = vi.fn();
    const replyingTo = { id: 42, author_name: 'Super Admin', content: 'Mensagem de origem' };

    renderWithToast(
      <ChatInputForm
        channel={mockChannel}
        replyingTo={replyingTo}
        onCancelReply={onCancelReplyMock}
        onSendMessage={vi.fn()}
      />
    );

    expect(screen.getByTestId('chat-reply-banner')).toBeInTheDocument();
    expect(screen.getByText('Super Admin')).toBeInTheDocument();

    const cancelBtn = screen.getByTestId('cancel-reply-btn');
    fireEvent.click(cancelBtn);
    expect(onCancelReplyMock).toHaveBeenCalledTimes(1);
  });

  it('opens emoji picker and selects emoji into input', () => {
    renderWithToast(<ChatInputForm channel={mockChannel} onSendMessage={vi.fn()} />);

    const emojiToggle = screen.getByTestId('chat-input-emoji-btn');
    fireEvent.click(emojiToggle);

    expect(screen.getByTestId('chat-input-emoji-picker')).toBeInTheDocument();

    const fireEmoji = screen.getByTestId('input-emoji-select-🔥');
    fireEvent.click(fireEmoji);

    const input = screen.getByTestId('chat-message-input');
    expect(input.value).toContain('🔥');
    expect(screen.queryByTestId('chat-input-emoji-picker')).not.toBeInTheDocument();
  });

  it('displays typing users indicator', () => {
    renderWithToast(
      <ChatInputForm
        channel={mockChannel}
        typingUsers={['Lucas', 'Arya']}
        onSendMessage={vi.fn()}
      />
    );

    const typingStatus = screen.getByTestId('chat-typing-status');
    expect(typingStatus).toHaveTextContent('Lucas, Arya estão digitando...');
  });

  it('opens voice recorder when mic button is clicked', () => {
    navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
    };
    renderWithToast(<ChatInputForm channel={mockChannel} onSendMessage={vi.fn()} />);

    const micBtn = screen.getByTestId('chat-voice-record-btn');
    expect(micBtn).toBeInTheDocument();

    fireEvent.click(micBtn);
    expect(screen.getByTestId('chat-voice-recorder-bar')).toBeInTheDocument();
  });
});
