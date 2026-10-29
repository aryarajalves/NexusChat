import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatArea from './ChatArea';
import { ToastProvider } from '../../context/ToastContext';

describe('ChatArea Realtime & Attachments', () => {
  const mockChannel = { id: 10, name: 'geral', type: 'TEXT' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithToast = (ui) => {
    return render(<ToastProvider>{ui}</ToastProvider>);
  };

  it('renders connection status pill with correct state (connected, connecting, disconnected)', () => {
    const { rerender } = renderWithToast(
      <ChatArea channel={mockChannel} connectionStatus="connected" />
    );

    const pill = screen.getByTestId('connection-status-pill');
    expect(pill).toHaveTextContent('Conectado');
    expect(pill).toHaveClass('pill-connected');

    rerender(
      <ToastProvider>
        <ChatArea channel={mockChannel} connectionStatus="connecting" />
      </ToastProvider>
    );
    expect(screen.getByTestId('connection-status-pill')).toHaveTextContent('Reconectando...');

    rerender(
      <ToastProvider>
        <ChatArea channel={mockChannel} connectionStatus="disconnected" />
      </ToastProvider>
    );
    expect(screen.getByTestId('connection-status-pill')).toHaveTextContent('Desconectado');
  });

  it('renders typing indicator when typingUsers are passed', () => {
    renderWithToast(
      <ChatArea
        channel={mockChannel}
        typingUsers={['Bob', 'Carlos']}
      />
    );

    const typingStatus = screen.getByTestId('chat-typing-status');
    expect(typingStatus).toHaveTextContent('Bob, Carlos estão digitando...');
  });

  it('rejects file larger than 50 MB with error feedback', async () => {
    renderWithToast(
      <ChatArea channel={mockChannel} />
    );

    const fileInput = screen.getByTestId('file-upload-input');

    // Cria arquivo simulado de 55 MB
    const largeFile = new File(['x'.repeat(100)], 'video.mp4', { type: 'video/mp4' });
    Object.defineProperty(largeFile, 'size', { value: 55 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    // Toast de erro deve ser exibido
    await waitFor(() => {
      expect(screen.getByText('O arquivo excede o limite máximo permitido de 50 MB.')).toBeInTheDocument();
    });

    // Preview do arquivo não deve existir
    expect(screen.queryByTestId('attachment-pending-box')).not.toBeInTheDocument();
  });

  it('accepts file <= 50 MB, shows preview box and can remove it', async () => {
    renderWithToast(
      <ChatArea channel={mockChannel} />
    );

    const fileInput = screen.getByTestId('file-upload-input');
    const validFile = new File(['fake content'], 'foto.png', { type: 'image/png' });
    Object.defineProperty(validFile, 'size', { value: 2 * 1024 * 1024 }); // 2 MB

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    // Preview é exibido com renderização da mídia (thumbnail)
    expect(screen.getByTestId('attachment-pending-box')).toBeInTheDocument();
    expect(screen.getByTestId('pending-image-preview')).toBeInTheDocument();
    expect(screen.getByText('foto.png')).toBeInTheDocument();
    expect(screen.getByText('(2 MB)')).toBeInTheDocument();

    // Remove preview clicando no botão flutuante de lixeira/remover
    fireEvent.click(screen.getByTestId('remove-pending-attachment-btn'));
    expect(screen.queryByTestId('attachment-pending-box')).not.toBeInTheDocument();
  });

  it('renders video and audio attachments in message rows', () => {
    const messages = [
      {
        id: 3,
        author_id: 1,
        author_name: 'Alice',
        content: 'Vídeo:',
        attachment_url: '/api/v1/discord/attachments/gameplay.mp4',
        attachment_type: 'video/mp4',
        attachment_size: 10485760,
        created_at: new Date().toISOString(),
      },
      {
        id: 4,
        author_id: 2,
        author_name: 'Bob',
        content: 'Áudio:',
        attachment_url: '/api/v1/discord/attachments/audio.mp3',
        attachment_type: 'audio/mp3',
        attachment_size: 524288,
        created_at: new Date().toISOString(),
      },
    ];

    const { container } = renderWithToast(
      <ChatArea channel={mockChannel} messages={messages} currentUserId={1} currentUserRole="MEMBER" />
    );

    const video = container.querySelector('video.chat-attachment-video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', '/api/v1/discord/attachments/gameplay.mp4');

    const audio = container.querySelector('audio.chat-attachment-audio');
    expect(audio).toBeInTheDocument();
    expect(audio).toHaveAttribute('src', '/api/v1/discord/attachments/audio.mp3');
  });

  it('renders image and file card attachments in message rows', () => {
    const messages = [
      {
        id: 1,
        author_id: 1,
        author_name: 'Alice',
        content: 'Olha a foto:',
        attachment_url: '/api/v1/discord/attachments/image1.png',
        attachment_type: 'image/png',
        attachment_size: 1048576,
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        author_id: 2,
        author_name: 'Bob',
        content: 'Baixe o documento:',
        attachment_url: '/api/v1/discord/attachments/planilha.pdf',
        attachment_type: 'application/pdf',
        attachment_size: 2097152,
        created_at: new Date().toISOString(),
      },
    ];

    renderWithToast(
      <ChatArea channel={mockChannel} messages={messages} currentUserId={1} currentUserRole="MEMBER" />
    );

    // Imagem
    const img = screen.getByAltText('Anexo de imagem');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/api/v1/discord/attachments/image1.png');

    // Arquivo
    expect(screen.getByText('planilha.pdf')).toBeInTheDocument();
    expect(screen.getByText('2 MB')).toBeInTheDocument();
  });

  it('shows delete button on message when user is author or server admin/owner', () => {
    const handleRequestDelete = vi.fn();
    const messages = [
      {
        id: 101,
        author_id: 5,
        author_name: 'Eu',
        content: 'Minha mensagem',
        created_at: new Date().toISOString(),
      },
      {
        id: 102,
        author_id: 8,
        author_name: 'Outro',
        content: 'Mensagem de outro',
        created_at: new Date().toISOString(),
      },
    ];

    // Usuário ID 5 logado como MEMBER
    renderWithToast(
      <ChatArea
        channel={mockChannel}
        messages={messages}
        currentUserId={5}
        currentUserRole="MEMBER"
        onRequestDeleteMessage={handleRequestDelete}
      />
    );

    // Botão de deletar deve estar presente para a mensagem 101 (autor próprio)
    const deleteBtn = screen.getByTestId('delete-msg-btn-101');
    expect(deleteBtn).toBeInTheDocument();

    // Mensagem 102 de outro usuário NÃO deve ter botão de apagar para MEMBER comum
    expect(screen.queryByTestId('delete-msg-btn-102')).not.toBeInTheDocument();

    // Clicar no botão aciona o callback de requisição de exclusão
    fireEvent.click(deleteBtn);
    expect(handleRequestDelete).toHaveBeenCalledWith(messages[0]);
  });

  it('opens input emoji picker and inserts selected emoji into text input', () => {
    renderWithToast(
      <ChatArea channel={mockChannel} messages={[]} />
    );

    const emojiBtn = screen.getByTestId('chat-input-emoji-btn');
    expect(emojiBtn).toBeInTheDocument();

    // Clica no botão de emoji do input
    fireEvent.click(emojiBtn);
    expect(screen.getByTestId('chat-input-emoji-picker')).toBeInTheDocument();

    // Seleciona o emoji 🔥
    const fireEmojiBtn = screen.getByTestId('input-emoji-select-🔥');
    fireEvent.click(fireEmojiBtn);

    // O input recebe o emoji e o popover fecha
    const textInput = screen.getByTestId('chat-message-input');
    expect(textInput.value).toBe('🔥');
    expect(screen.queryByTestId('chat-input-emoji-picker')).not.toBeInTheDocument();
  });

  it('opens 3 dots menu and selects reply to display reply banner above chat input', async () => {
    const handleSendMessage = vi.fn();
    const messages = [
      {
        id: 50,
        author_id: 2,
        author_name: 'Carlos',
        content: 'Qual o plano para hoje?',
        created_at: new Date().toISOString(),
      },
    ];

    renderWithToast(
      <ChatArea
        channel={mockChannel}
        messages={messages}
        currentUserId={1}
        currentUserRole="MEMBER"
        onSendMessage={handleSendMessage}
      />
    );

    // Botão de 3 pontinhos (Mais opções) existe no hover
    const moreBtn = screen.getByTestId('hover-more-btn-50');
    expect(moreBtn).toBeInTheDocument();

    // Clica nos 3 pontinhos para abrir o menu
    fireEvent.click(moreBtn);
    expect(screen.getByTestId('message-more-menu-50')).toBeInTheDocument();
    expect(screen.getByTestId('more-reply-action-50')).toBeInTheDocument();
    expect(screen.getByTestId('more-copy-action-50')).toBeInTheDocument();

    // Clica em "Responder" dentro do menu de 3 pontinhos
    fireEvent.click(screen.getByTestId('more-reply-action-50'));

    // Menu fecha e o banner de resposta aparece acima do input
    expect(screen.queryByTestId('message-more-menu-50')).not.toBeInTheDocument();
    const replyBanner = screen.getByTestId('chat-reply-banner');
    expect(replyBanner).toBeInTheDocument();
    expect(replyBanner).toHaveTextContent('Carlos');
    expect(replyBanner).toHaveTextContent('Qual o plano para hoje?');

    // Digita resposta e envia
    const input = screen.getByTestId('chat-message-input');
    fireEvent.change(input, { target: { value: 'Vamos finalizar o módulo!' } });
    fireEvent.click(screen.getByTestId('chat-send-btn'));

    await waitFor(() => {
      expect(handleSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Vamos finalizar o módulo!',
          reply_to_id: 50,
        })
      );
    });

    // Banner de resposta é limpo após envio
    expect(screen.queryByTestId('chat-reply-banner')).not.toBeInTheDocument();
  });

  it('renders reply reference indicator linking to the original message in chat feed', () => {
    const messages = [
      {
        id: 10,
        author_id: 1,
        author_name: 'Ana',
        content: 'Primeira mensagem original',
        created_at: new Date().toISOString(),
      },
      {
        id: 11,
        author_id: 2,
        author_name: 'Beto',
        content: 'Respondendo você aqui!',
        reply_to_id: 10,
        created_at: new Date().toISOString(),
      },
    ];

    renderWithToast(
      <ChatArea
        channel={mockChannel}
        messages={messages}
        currentUserId={1}
        currentUserRole="MEMBER"
      />
    );

    const replyRef = screen.getByTestId('reply-reference-11');
    expect(replyRef).toBeInTheDocument();
    expect(replyRef).toHaveTextContent('@Ana');
    expect(replyRef).toHaveTextContent('Primeira mensagem original');
  });

  it('supports drag and drop of media with visual overlay and sends with custom caption', async () => {
    const handleSendMessage = vi.fn().mockResolvedValue({});
    const handleUploadAttachment = vi.fn().mockResolvedValue({
      attachment_url: '/api/v1/discord/attachments/arte_drop.png',
      attachment_type: 'image/png',
      attachment_size: 102400,
    });

    const { container } = renderWithToast(
      <ChatArea
        channel={mockChannel}
        messages={[]}
        onSendMessage={handleSendMessage}
        onUploadAttachment={handleUploadAttachment}
      />
    );

    const chatSection = container.querySelector('.discord-chat-area');
    expect(chatSection).toBeInTheDocument();

    const testFile = new File(['drag-image-data'], 'arte_drop.png', { type: 'image/png' });
    Object.defineProperty(testFile, 'size', { value: 102400 });

    // Drag enter ativa overlay visual
    fireEvent.dragEnter(chatSection, {
      dataTransfer: { types: ['Files'] },
    });
    expect(screen.getByTestId('chat-drag-overlay')).toBeInTheDocument();
    expect(screen.getByText(/Solte sua mídia aqui/i)).toBeInTheDocument();

    // Drop do arquivo
    fireEvent.drop(chatSection, {
      dataTransfer: { files: [testFile] },
    });

    // Overlay fecha e prévia do arquivo aparece
    expect(screen.queryByTestId('chat-drag-overlay')).not.toBeInTheDocument();
    expect(screen.getByTestId('attachment-pending-box')).toBeInTheDocument();
    expect(screen.getByText('arte_drop.png')).toBeInTheDocument();

    // Placeholder do input atualiza para indicar suporte à legenda
    const messageInput = screen.getByTestId('chat-message-input');
    expect(messageInput).toHaveAttribute('placeholder', 'Adicionar uma legenda para arte_drop.png...');

    // Digita uma legenda para acompanhar a imagem
    fireEvent.change(messageInput, { target: { value: 'Ilustração do novo projeto!' } });

    // Envia a mensagem com anexo e legenda
    fireEvent.click(screen.getByTestId('chat-send-btn'));

    await waitFor(() => {
      expect(handleUploadAttachment).toHaveBeenCalledWith(testFile);
      expect(handleSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Ilustração do novo projeto!',
          attachment_url: '/api/v1/discord/attachments/arte_drop.png',
          attachment_type: 'image/png',
          attachment_size: 102400,
        })
      );
    });

    // Após o envio, limpa preview e input
    expect(screen.queryByTestId('attachment-pending-box')).not.toBeInTheDocument();
    expect(messageInput.value).toBe('');
  });

  it('supports pasting a media file directly into the chat input', async () => {
    renderWithToast(
      <ChatArea channel={mockChannel} />
    );

    const messageInput = screen.getByTestId('chat-message-input');
    const pastedFile = new File(['pasted-img'], 'print_colado.png', { type: 'image/png' });
    Object.defineProperty(pastedFile, 'size', { value: 20480 });

    fireEvent.paste(messageInput, {
      clipboardData: {
        files: [pastedFile],
      },
    });

    expect(screen.getByTestId('attachment-pending-box')).toBeInTheDocument();
    expect(screen.getByText('print_colado.png')).toBeInTheDocument();
    expect(messageInput).toHaveAttribute('placeholder', 'Adicionar uma legenda para print_colado.png...');
  });
});
