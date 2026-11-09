import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VoiceChannelChatSidebar from './VoiceChannelChatSidebar';
import VoiceChannelArea from './VoiceChannelArea';
import ChannelSidebar from './ChannelSidebar';
import { ToastProvider } from '../../context/ToastContext';

describe('Voice Channel Text Chat (Bate-Papo de Texto da Call)', () => {
  const dummyChannel = {
    id: 88,
    name: 'gados-de-lula',
    type: 'VOICE',
    server_id: 1,
  };

  const dummyUser = {
    id: 1,
    name: 'Super Admin',
    role: 'superadmin',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza o painel lateral de bate-papo de voz com mensagens existentes e permite envio de mensagem', async () => {
    const mockMessages = [
      {
        id: 101,
        channel_id: 88,
        author_id: 1,
        author_name: 'Super Admin',
        content: 'Links importantes da call: https://google.com',
        created_at: new Date().toISOString(),
      },
    ];

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 102,
            channel_id: 88,
            author_id: 1,
            author_name: 'Super Admin',
            content: 'Nova anotação da call',
            created_at: new Date().toISOString(),
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockMessages,
      });
    });

    const mockOnClose = vi.fn();

    render(
      <ToastProvider>
        <VoiceChannelChatSidebar
          channel={dummyChannel}
          currentUser={dummyUser}
          token="test-token"
          onClose={mockOnClose}
        />
      </ToastProvider>
    );

    expect(screen.getByTestId('voice-chat-sidebar')).toBeInTheDocument();

    // Mensagem existente deve ser exibida com link clicável
    await waitFor(() => {
      expect(screen.getByText(/Links importantes da call:/)).toBeInTheDocument();
      const link = screen.getByRole('link', { name: 'https://google.com' });
      expect(link).toHaveAttribute('href', 'https://google.com');
    });

    // Digita nova mensagem
    const input = screen.getByTestId('voice-chat-input');
    fireEvent.change(input, { target: { value: 'Nova anotação da call' } });

    // Envia formulário
    const sendBtn = screen.getByTestId('voice-chat-send-btn');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/channels/88/messages',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            content: 'Nova anotação da call',
            attachment_url: null,
            attachment_type: null,
            attachment_size: null,
          }),
        })
      );
      expect(screen.getByText('Nova anotação da call')).toBeInTheDocument();
    });

    // Clica no botão de fechar o bate-papo
    const closeBtn = screen.getByTestId('voice-chat-close-btn');
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('exibe o botão de alternar bate-papo no cabeçalho do VoiceChannelArea e abre o painel lateral ao clicar', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    render(
      <ToastProvider>
        <VoiceChannelArea
          channel={dummyChannel}
          currentUser={dummyUser}
          token="test-token"
          members={[]}
          voiceUsers={[]}
        />
      </ToastProvider>
    );

    const toggleChatBtn = screen.getByTestId('toggle-voice-chat-btn');
    expect(toggleChatBtn).toBeInTheDocument();

    // Antes do clique, o painel do bate-papo não está montado
    expect(screen.queryByTestId('voice-chat-sidebar')).not.toBeInTheDocument();

    // Clica para abrir o bate-papo
    fireEvent.click(toggleChatBtn);

    // O painel lateral de bate-papo da call passa a existir
    expect(screen.getByTestId('voice-chat-sidebar')).toBeInTheDocument();
  });

  it('exibe o botão de abrir bate-papo em cada canal de voz no ChannelSidebar e dispara onOpenVoiceChat', () => {
    const mockOnSelectChannel = vi.fn();
    const mockOnOpenVoiceChat = vi.fn();

    render(
      <ChannelSidebar
        server={{ id: 1, name: 'Servidor Teste' }}
        channels={[dummyChannel]}
        activeChannelId={dummyChannel.id}
        onSelectChannel={mockOnSelectChannel}
        onOpenVoiceChat={mockOnOpenVoiceChat}
        currentUser={dummyUser}
      />
    );

    const openChatBtn = screen.getByTestId(`open-voice-chat-btn-${dummyChannel.id}`);
    expect(openChatBtn).toBeInTheDocument();

    fireEvent.click(openChatBtn);
    expect(mockOnOpenVoiceChat).toHaveBeenCalledWith(dummyChannel.id);
    expect(mockOnSelectChannel).not.toHaveBeenCalled();
  });
});
