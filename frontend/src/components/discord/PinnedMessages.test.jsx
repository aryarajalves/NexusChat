import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PinnedMessagesPanel from './PinnedMessagesPanel';
import ChatMessageItem from './ChatMessageItem';
import ChatArea from './ChatArea';
import { ToastProvider } from '../../context/ToastContext';

describe('Pinned Messages Feature (Item 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithToast = (ui) => render(<ToastProvider>{ui}</ToastProvider>);

  describe('PinnedMessagesPanel Component', () => {
    const mockChannel = { id: 1, name: 'geral', type: 'TEXT' };
    const mockPinnedMessages = [
      {
        id: 101,
        author_name: 'Alice',
        content: 'Regras importantes da comunidade!',
        created_at: '2026-10-28T14:00:00Z',
        is_pinned: true,
      },
      {
        id: 102,
        author_name: 'Bob',
        content: 'Link para o repositório oficial.',
        created_at: '2026-10-28T15:30:00Z',
        is_pinned: true,
      },
    ];

    it('does not render when isOpen is false', () => {
      render(
        <PinnedMessagesPanel
          isOpen={false}
          onClose={vi.fn()}
          channel={mockChannel}
          pinnedMessages={mockPinnedMessages}
        />
      );
      expect(screen.queryByTestId('pinned-messages-panel')).toBeNull();
    });

    it('renders empty state when pinnedMessages is empty', () => {
      render(
        <PinnedMessagesPanel
          isOpen={true}
          onClose={vi.fn()}
          channel={mockChannel}
          pinnedMessages={[]}
        />
      );
      expect(screen.getByTestId('pinned-messages-panel')).toBeInTheDocument();
      expect(screen.getByTestId('pinned-empty-state')).toBeInTheDocument();
      expect(screen.getByText('Nenhuma mensagem fixada ainda')).toBeInTheDocument();
    });

    it('renders list of pinned cards with author and content', () => {
      render(
        <PinnedMessagesPanel
          isOpen={true}
          onClose={vi.fn()}
          channel={mockChannel}
          pinnedMessages={mockPinnedMessages}
        />
      );

      expect(screen.getByTestId('pinned-card-101')).toBeInTheDocument();
      expect(screen.getByText('Regras importantes da comunidade!')).toBeInTheDocument();
      expect(screen.getByTestId('pinned-card-102')).toBeInTheDocument();
      expect(screen.getByText('Link para o repositório oficial.')).toBeInTheDocument();
      expect(screen.getByTestId('pinned-count-badge')).toHaveTextContent('2');
    });

    it('calls onScrollToMessage when "Ir para mensagem" button is clicked', () => {
      const handleScroll = vi.fn();
      render(
        <PinnedMessagesPanel
          isOpen={true}
          onClose={vi.fn()}
          channel={mockChannel}
          pinnedMessages={mockPinnedMessages}
          onScrollToMessage={handleScroll}
        />
      );

      const jumpBtn = screen.getByTestId('pinned-jump-btn-101');
      fireEvent.click(jumpBtn);
      expect(handleScroll).toHaveBeenCalledWith(101);
    });

    it('calls onTogglePin when "Desafixar" button is clicked', () => {
      const handleTogglePin = vi.fn();
      render(
        <PinnedMessagesPanel
          isOpen={true}
          onClose={vi.fn()}
          channel={mockChannel}
          pinnedMessages={mockPinnedMessages}
          onTogglePin={handleTogglePin}
        />
      );

      const unpinBtn = screen.getByTestId('unpin-btn-101');
      fireEvent.click(unpinBtn);
      expect(handleTogglePin).toHaveBeenCalledWith(mockPinnedMessages[0]);
    });

    it('calls onClose when close button is clicked', () => {
      const handleClose = vi.fn();
      render(
        <PinnedMessagesPanel
          isOpen={true}
          onClose={handleClose}
          channel={mockChannel}
          pinnedMessages={mockPinnedMessages}
        />
      );

      fireEvent.click(screen.getByTestId('close-pinned-panel-btn'));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('renders rich media previews (image, video, audio) in pinned cards', () => {
      const mediaMessages = [
        {
          id: 301,
          author_name: 'Super Admin',
          content: 'Foto importante',
          attachment_url: 'https://exemplo.com/foto.jpg',
          attachment_type: 'image/jpeg',
          created_at: '2026-10-28T14:00:00Z',
        },
        {
          id: 302,
          author_name: 'Super Admin',
          content: 'Vídeo da call',
          attachment_url: 'https://exemplo.com/video.mp4',
          attachment_type: 'video/mp4',
          created_at: '2026-10-28T14:10:00Z',
        },
        {
          id: 303,
          author_name: 'Super Admin',
          content: 'Áudio gravado',
          attachment_url: 'https://exemplo.com/audio.mp3',
          attachment_type: 'audio/mpeg',
          created_at: '2026-10-28T14:20:00Z',
        },
      ];

      render(
        <PinnedMessagesPanel
          isOpen={true}
          onClose={vi.fn()}
          channel={mockChannel}
          pinnedMessages={mediaMessages}
        />
      );

      // Imagem
      const imgMedia = screen.getByTestId('pinned-media-301');
      expect(imgMedia).toBeInTheDocument();
      expect(imgMedia.querySelector('img')).toHaveAttribute('src', 'https://exemplo.com/foto.jpg');

      // Vídeo
      const videoMedia = screen.getByTestId('pinned-media-302');
      expect(videoMedia).toBeInTheDocument();
      expect(videoMedia.querySelector('video')).toHaveAttribute('src', 'https://exemplo.com/video.mp4');

      // Áudio
      const audioMedia = screen.getByTestId('pinned-media-303');
      expect(audioMedia).toBeInTheDocument();
      expect(audioMedia.querySelector('audio')).toHaveAttribute('src', 'https://exemplo.com/audio.mp3');
    });

    it('paginates pinned messages showing only 20 per page with navigation controls', () => {
      const twentyFiveMessages = Array.from({ length: 25 }, (_, i) => ({
        id: 1000 + i + 1,
        author_name: `User ${i + 1}`,
        content: `Fixada número ${i + 1}`,
        created_at: '2026-10-28T14:00:00Z',
      }));

      render(
        <PinnedMessagesPanel
          isOpen={true}
          onClose={vi.fn()}
          channel={mockChannel}
          pinnedMessages={twentyFiveMessages}
        />
      );

      // Deve renderizar a barra de paginação e indicar Página 1 de 2
      expect(screen.getByTestId('pinned-pagination-bar')).toBeInTheDocument();
      expect(screen.getByTestId('pinned-page-indicator')).toHaveTextContent('Página 1 de 2');

      // Na página 1, mostra apenas os primeiros 20 (1001 a 1020)
      expect(screen.getByTestId('pinned-card-1001')).toBeInTheDocument();
      expect(screen.getByTestId('pinned-card-1020')).toBeInTheDocument();
      expect(screen.queryByTestId('pinned-card-1021')).toBeNull();

      // Botão anterior desativado na primeira página
      const prevBtn = screen.getByTestId('pinned-prev-page-btn');
      const nextBtn = screen.getByTestId('pinned-next-page-btn');
      expect(prevBtn).toBeDisabled();
      expect(nextBtn).not.toBeDisabled();

      // Avança para a página 2
      fireEvent.click(nextBtn);

      expect(screen.getByTestId('pinned-page-indicator')).toHaveTextContent('Página 2 de 2');
      expect(screen.queryByTestId('pinned-card-1001')).toBeNull();
      expect(screen.getByTestId('pinned-card-1021')).toBeInTheDocument();
      expect(screen.getByTestId('pinned-card-1025')).toBeInTheDocument();

      // Botão próxima desativado na última página
      expect(nextBtn).toBeDisabled();
      expect(prevBtn).not.toBeDisabled();
    });
  });

  describe('ChatMessageItem Pin Badge & Popover Action', () => {
    const unpinnedMsg = {
      id: 201,
      author_id: 1,
      author_name: 'Carlos',
      content: 'Mensagem normal',
      created_at: '2026-10-28T12:00:00Z',
      is_pinned: false,
    };

    const pinnedMsg = {
      id: 202,
      author_id: 1,
      author_name: 'Carlos',
      content: 'Mensagem fixada',
      created_at: '2026-10-28T12:05:00Z',
      is_pinned: true,
    };

    it('renders pinned badge when is_pinned is true', () => {
      renderWithToast(
        <ChatMessageItem
          msg={pinnedMsg}
          channelId={1}
          currentUserId={1}
        />
      );

      expect(screen.getByTestId('pinned-badge-202')).toBeInTheDocument();
      expect(screen.getByText('Fixada')).toBeInTheDocument();
    });

    it('does not render pinned badge when is_pinned is false', () => {
      renderWithToast(
        <ChatMessageItem
          msg={unpinnedMsg}
          channelId={1}
          currentUserId={1}
        />
      );

      expect(screen.queryByTestId('pinned-badge-201')).toBeNull();
    });

    it('allows toggling pin from 3-dots more menu', () => {
      const handleTogglePin = vi.fn();
      renderWithToast(
        <ChatMessageItem
          msg={unpinnedMsg}
          channelId={1}
          currentUserId={1}
          onTogglePin={handleTogglePin}
        />
      );

      // Open more menu
      fireEvent.click(screen.getByTestId('hover-more-btn-201'));

      const pinAction = screen.getByTestId('more-pin-action-201');
      expect(pinAction).toHaveTextContent('Fixar Mensagem');

      fireEvent.click(pinAction);
      expect(handleTogglePin).toHaveBeenCalledWith(unpinnedMsg);
    });

    it('shows "Desafixar Mensagem" in more menu when message is already pinned', () => {
      const handleTogglePin = vi.fn();
      renderWithToast(
        <ChatMessageItem
          msg={pinnedMsg}
          channelId={1}
          currentUserId={1}
          onTogglePin={handleTogglePin}
        />
      );

      fireEvent.click(screen.getByTestId('hover-more-btn-202'));
      const pinAction = screen.getByTestId('more-pin-action-202');
      expect(pinAction).toHaveTextContent('Desafixar Mensagem');

      fireEvent.click(pinAction);
      expect(handleTogglePin).toHaveBeenCalledWith(pinnedMsg);
    });
  });

  describe('ChatArea Pin Button & Panel Integration', () => {
    const mockChannel = { id: 1, name: 'geral', type: 'TEXT' };
    const mockPinnedMessages = [
      { id: 301, author_name: 'Ana', content: 'Aviso Importante', is_pinned: true },
    ];

    it('renders pin button in topbar and displays count badge', () => {
      renderWithToast(
        <ChatArea
          channel={mockChannel}
          messages={[]}
          pinnedMessages={mockPinnedMessages}
        />
      );

      const pinBtn = screen.getByTestId('toggle-pins-btn');
      expect(pinBtn).toBeInTheDocument();

      const counter = screen.getByTestId('pin-counter-badge');
      expect(counter).toHaveTextContent('1');
    });

    it('toggles pinned messages panel when topbar pin button is clicked', () => {
      renderWithToast(
        <ChatArea
          channel={mockChannel}
          messages={[]}
          pinnedMessages={mockPinnedMessages}
        />
      );

      // Panel is initially closed
      expect(screen.queryByTestId('pinned-messages-panel')).toBeNull();

      // Click to open
      fireEvent.click(screen.getByTestId('toggle-pins-btn'));
      expect(screen.getByTestId('pinned-messages-panel')).toBeInTheDocument();

      // Click close button inside panel
      fireEvent.click(screen.getByTestId('close-pinned-panel-btn'));
      expect(screen.queryByTestId('pinned-messages-panel')).toBeNull();
    });
  });
});
