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

    // Mensagem existente deve ser exibida com link clicável e data/horário formatados
    await waitFor(() => {
      expect(screen.getByText(/Links importantes da call:/)).toBeInTheDocument();
      const link = screen.getByRole('link', { name: 'https://google.com' });
      expect(link).toHaveAttribute('href', 'https://google.com');
      // Valida que o timestamp possui data e hora (ex: DD/MM/YYYY, HH:mm)
      const timeEl = screen.getByTestId('voice-chat-msg-101').querySelector('.voice-chat-msg-time');
      expect(timeEl).toBeInTheDocument();
      expect(timeEl.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/);
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

  it('permite arrastar e soltar mídia com drag overlay, prévia e envio de mídia com legenda para /channels/{id}/attachments', async () => {
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/attachments') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            attachment_url: '/api/v1/discord/attachments/screenshot_call.png',
            attachment_type: 'image/png',
            attachment_size: 1024,
          }),
        });
      }
      if (url.includes('/messages') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 201,
            channel_id: 88,
            author_id: 1,
            author_name: 'Super Admin',
            content: 'Dê uma olhada nesta imagem da call',
            attachment_url: '/api/v1/discord/attachments/screenshot_call.png',
            attachment_type: 'image/png',
            attachment_size: 1024,
            created_at: new Date().toISOString(),
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => [],
      });
    });

    render(
      <ToastProvider>
        <VoiceChannelChatSidebar
          channel={dummyChannel}
          currentUser={dummyUser}
          token="test-token"
          onClose={vi.fn()}
        />
      </ToastProvider>
    );

    const sidebar = screen.getByTestId('voice-chat-sidebar');

    // Simula evento de arrastar sobre o chat da call (DragEnter / DragOver)
    fireEvent.dragEnter(sidebar, {
      dataTransfer: { items: [{ kind: 'file', type: 'image/png' }] },
    });
    expect(screen.getByTestId('voice-chat-drag-overlay')).toBeInTheDocument();

    // Simula soltar o arquivo (Drop)
    const mockFile = new File(['dummy-image-bytes'], 'screenshot_call.png', { type: 'image/png' });
    fireEvent.drop(sidebar, {
      dataTransfer: { files: [mockFile] },
    });

    // O overlay deve sumir e o card de prévia do anexo deve aparecer
    expect(screen.queryByTestId('voice-chat-drag-overlay')).not.toBeInTheDocument();
    expect(screen.getByTestId('voice-chat-attachments-row')).toBeInTheDocument();
    expect(screen.getByText('screenshot_call.png')).toBeInTheDocument();

    // Digita legenda no campo de input
    const input = screen.getByTestId('voice-chat-input');
    expect(input).toHaveAttribute('placeholder', 'Adicione uma legenda... (opcional)');
    fireEvent.change(input, { target: { value: 'Dê uma olhada nesta imagem da call' } });

    // Clica em enviar
    const sendBtn = screen.getByTestId('voice-chat-send-btn');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      // 1. Verifica que chamou a rota correta de upload do canal
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/channels/88/attachments',
        expect.objectContaining({
          method: 'POST',
        })
      );

      // 2. Verifica que enviou a mensagem com a legenda e a URL do anexo
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/channels/88/messages',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            content: 'Dê uma olhada nesta imagem da call',
            attachment_url: '/api/v1/discord/attachments/screenshot_call.png',
            attachment_type: 'image/png',
            attachment_size: 1024,
          }),
        })
      );

      // 3. A mensagem com imagem e legenda aparece no feed
      expect(screen.getByText('Dê uma olhada nesta imagem da call')).toBeInTheDocument();
      expect(screen.queryByTestId('voice-chat-attachments-row')).not.toBeInTheDocument();
    });
  });

  it('permite selecionar e enviar múltiplas mídias simultâneas consecutivamente com legenda', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (url.includes('/attachments') && opts?.method === 'POST') {
        callCount += 1;
        return Promise.resolve({
          ok: true,
          json: async () => ({
            attachment_url: `/api/v1/discord/attachments/midia_${callCount}.png`,
            attachment_type: 'image/png',
            attachment_size: 2048,
          }),
        });
      }
      if (url.includes('/messages') && opts?.method === 'POST') {
        const body = JSON.parse(opts.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 400 + Math.floor(Math.random() * 100),
            channel_id: 88,
            author_id: 1,
            author_name: 'Super Admin',
            content: body.content,
            attachment_url: body.attachment_url,
            attachment_type: body.attachment_type,
            attachment_size: body.attachment_size,
            created_at: new Date().toISOString(),
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => [],
      });
    });

    render(
      <ToastProvider>
        <VoiceChannelChatSidebar
          channel={dummyChannel}
          currentUser={dummyUser}
          token="test-token"
          onClose={vi.fn()}
        />
      </ToastProvider>
    );

    const fileInput = screen.getByTestId('voice-chat-file-input');
    expect(fileInput).toHaveAttribute('multiple');

    const file1 = new File(['img1'], 'foto1.png', { type: 'image/png' });
    const file2 = new File(['img2'], 'foto2.png', { type: 'image/png' });

    // Seleciona 2 arquivos simultaneamente
    fireEvent.change(fileInput, { target: { files: [file1, file2] } });

    // Ambos devem aparecer na lista de pendentes
    expect(screen.getByTestId('voice-chat-attachments-row')).toBeInTheDocument();
    expect(screen.getByText('foto1.png')).toBeInTheDocument();
    expect(screen.getByText('foto2.png')).toBeInTheDocument();

    // Placeholder reflete 2 mídias
    const input = screen.getByTestId('voice-chat-input');
    expect(input).toHaveAttribute('placeholder', 'Adicione uma legenda para as 2 mídias... (opcional)');

    // Digita legenda para o lote
    fireEvent.change(input, { target: { value: 'Fotos do evento da call' } });

    // Envia formulário
    const sendBtn = screen.getByTestId('voice-chat-send-btn');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      // Deve ter feito upload das 2 mídias
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/channels/88/attachments',
        expect.objectContaining({ method: 'POST' })
      );

      // Deve ter enviado a 1ª mensagem com legenda
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/channels/88/messages',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"content":"Fotos do evento da call"'),
        })
      );

      // Deve ter enviado a 2ª mensagem consecutiva
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/channels/88/messages',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"content":""'),
        })
      );

      expect(screen.queryByTestId('voice-chat-attachments-row')).not.toBeInTheDocument();
    });
  });

  it('renderiza o player nativo de vídeo com controles quando a mensagem contém anexo de vídeo mp4/webm', async () => {
    const mockMessagesWithVideo = [
      {
        id: 301,
        channel_id: 88,
        author_id: 1,
        author_name: 'Super Admin',
        content: 'Vídeo da gravação da call',
        attachment_url: '/api/v1/discord/attachments/7cb06ba12a4c4f7d975d0e7c85bcca2f.mp4',
        attachment_type: 'video/mp4',
        created_at: new Date().toISOString(),
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMessagesWithVideo,
    });

    render(
      <ToastProvider>
        <VoiceChannelChatSidebar
          channel={dummyChannel}
          currentUser={dummyUser}
          token="test-token"
          onClose={vi.fn()}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Vídeo da gravação da call')).toBeInTheDocument();
      const videoEl = screen.getByTestId('voice-chat-video-301');
      expect(videoEl).toBeInTheDocument();
      expect(videoEl.tagName.toLowerCase()).toBe('video');
      expect(videoEl).toHaveAttribute('src', '/api/v1/discord/attachments/7cb06ba12a4c4f7d975d0e7c85bcca2f.mp4');
      expect(videoEl).toHaveAttribute('controls');
    });
  });
});
