import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatMessageItem from './ChatMessageItem';
import ChannelSidebar from './ChannelSidebar';
import ForwardMessageModal from './ForwardMessageModal';
import { formatBrasiliaDateTime } from './ChatArea';
import { ToastProvider } from '../../context/ToastContext';

describe('Discord Chat & Voice Enhancements', () => {
  describe('formatBrasiliaDateTime', () => {
    it('formats ISO date to Brasilia timezone DD/MM/YYYY, HH:mm', () => {
      // 2026-10-26T16:31:00Z -> Brasilia is UTC-3 -> 13:31
      const dateStr = '2026-10-26T16:31:00Z';
      const formatted = formatBrasiliaDateTime(dateStr);
      expect(formatted).toBe('26/10/2026, 13:31');
    });

    it('returns empty string on null or invalid date', () => {
      expect(formatBrasiliaDateTime(null)).toBe('');
      expect(formatBrasiliaDateTime('')).toBe('');
      expect(formatBrasiliaDateTime('invalid')).toBe('');
    });
  });

  describe('ChatMessageItem Component', () => {
    const mockMsg = {
      id: 101,
      author_id: 1,
      author_name: 'aryaraj',
      content: 'eu fui ver aqui e a nossa divida publica ta em 11 trilhoes',
      created_at: '2026-10-26T16:31:00Z',
      is_edited: true,
      reactions: [{ emoji: '🀄', count: 1, reacted_by_me: true }],
    };

    it('renders author, Brasilia timestamp, content, and (editado) badge', () => {
      render(
        <ChatMessageItem
          msg={mockMsg}
          channelId={10}
          currentUserId={1}
          currentUserRole="MEMBER"
          formatFileSize={() => '0 B'}
        />
      );

      expect(screen.getByText('aryaraj')).toBeInTheDocument();
      expect(screen.getByText('26/10/2026, 13:31')).toBeInTheDocument();
      expect(screen.getByText(/nossa divida publica/i)).toBeInTheDocument();
      expect(screen.getByText('(editado)')).toBeInTheDocument();
      expect(screen.getByText('🀄')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('toggles reaction when clicking reaction chip or adding emoji from picker', () => {
      const handleToggle = vi.fn();
      render(
        <ChatMessageItem
          msg={mockMsg}
          channelId={10}
          currentUserId={1}
          onToggleReaction={handleToggle}
          formatFileSize={() => '0 B'}
        />
      );

      // Clica no chip existente
      fireEvent.click(screen.getByTestId('reaction-chip-101-🀄'));
      expect(handleToggle).toHaveBeenCalledWith(10, 101, '🀄');

      // Abre picker de emoji
      fireEvent.click(screen.getByTestId('add-reaction-btn-101'));
      expect(screen.getByTestId('quick-emoji-popover-101')).toBeInTheDocument();

      // Clica no emoji fogo 🔥
      fireEvent.click(screen.getByTestId('quick-emoji-item-🔥'));
      expect(handleToggle).toHaveBeenCalledWith(10, 101, '🔥');
    });

    it('opens quick emoji popover from hover action button and handles outside click', () => {
      const handleToggle = vi.fn();
      render(
        <ChatMessageItem
          msg={mockMsg}
          channelId={10}
          currentUserId={1}
          onToggleReaction={handleToggle}
          formatFileSize={() => '0 B'}
        />
      );

      const hoverReactBtn = screen.getByTestId('hover-react-btn-101');
      fireEvent.click(hoverReactBtn);

      const popover = screen.getByTestId('quick-emoji-popover-101');
      expect(popover).toBeInTheDocument();
      expect(screen.getByTestId('message-actions-bar-101')).toHaveClass('has-open-picker');

      // Clica em um emoji
      fireEvent.click(screen.getByTestId('quick-emoji-item-🎉'));
      expect(handleToggle).toHaveBeenCalledWith(10, 101, '🎉');
      expect(screen.queryByTestId('quick-emoji-popover-101')).not.toBeInTheDocument();
    });

    it('allows author to edit message inline and save', async () => {
      const handleEdit = vi.fn();
      render(
        <ChatMessageItem
          msg={mockMsg}
          channelId={10}
          currentUserId={1}
          onEditMessage={handleEdit}
          formatFileSize={() => '0 B'}
        />
      );

      // Clica no botão de editar no hover
      fireEvent.click(screen.getByTestId('hover-edit-btn-101'));
      const editInput = screen.getByTestId('edit-msg-input-101');
      expect(editInput).toBeInTheDocument();

      fireEvent.change(editInput, { target: { value: 'Texto atualizado com sucesso' } });
      fireEvent.click(screen.getByTestId('save-edit-btn-101'));

      expect(handleEdit).toHaveBeenCalledWith(10, 101, 'Texto atualizado com sucesso');
    });

    it('triggers forward modal request when forward button is clicked', () => {
      const handleForward = vi.fn();
      render(
        <ChatMessageItem
          msg={mockMsg}
          channelId={10}
          currentUserId={1}
          onRequestForward={handleForward}
          formatFileSize={() => '0 B'}
        />
      );

      fireEvent.click(screen.getByTestId('hover-forward-btn-101'));
      expect(handleForward).toHaveBeenCalledWith(mockMsg);
    });
  });

  describe('ChannelSidebar Persistent Voice & Profile Avatar', () => {
    const mockChannels = [
      { id: 1, name: 'geral', type: 'TEXT' },
      { id: 2, name: 'senhas', type: 'TEXT' },
      { id: 10, name: 'geral', type: 'VOICE' },
    ];
    const mockUser = { id: 99, name: 'Super Admin' };

    it('renders user profile avatar under voice channel when connected and displays persistent voice status bar', () => {
      const handleDisconnect = vi.fn();
      const handleSelect = vi.fn();

      render(
        <ChannelSidebar
          server={{ id: 1, name: 'Servidor Teste' }}
          channels={mockChannels}
          activeChannelId={2} // Visualizando canal de texto #senhas
          connectedVoiceChannelId={10} // Conectado no canal de voz geral
          currentUser={mockUser}
          onSelectChannel={handleSelect}
          onDisconnectVoice={handleDisconnect}
          voiceStates={{ 99: { is_speaking: true, is_muted: false } }}
        />
      );

      // Bolinha do perfil do usuário aparece abaixo do canal de voz
      expect(screen.getByTestId('voice-channel-users-10')).toBeInTheDocument();
      expect(screen.getByTestId('voice-user-item-99')).toBeInTheDocument();
      expect(screen.getAllByText('Super Admin').length).toBeGreaterThanOrEqual(2);

      // Barra de status de voz persistente aparece no rodapé
      expect(screen.getByTestId('discord-voice-status-bar')).toBeInTheDocument();
      expect(screen.getByText(/Voz Conectada/i)).toBeInTheDocument();
      expect(screen.getByText(/geral \/ Servidor Teste/i)).toBeInTheDocument();

      // Clicar em desconectar dispara o evento
      fireEvent.click(screen.getByTestId('sidebar-voice-disconnect-btn'));
      expect(handleDisconnect).toHaveBeenCalled();
    });
  });

  describe('ForwardMessageModal Component', () => {
    const mockMsg = { id: 5, author_name: 'Carlos', content: 'Mensagem para encaminhar' };
    const mockChannels = [
      { id: 1, name: 'geral', type: 'TEXT' },
      { id: 2, name: 'anuncios', type: 'TEXT' },
      { id: 3, name: 'sala-voz', type: 'VOICE' },
    ];

    it('submits forward request with selected text channel', async () => {
      const handleForward = vi.fn().mockResolvedValue({});
      const handleClose = vi.fn();

      render(
        <ForwardMessageModal
          isOpen={true}
          onClose={handleClose}
          message={mockMsg}
          channels={mockChannels}
          currentChannelId={1}
          onForwardMessage={handleForward}
        />
      );

      expect(screen.getByText('Encaminhar Mensagem')).toBeInTheDocument();
      expect(screen.getByText('Mensagem para encaminhar')).toBeInTheDocument();

      const select = screen.getByTestId('target-channel-select');
      fireEvent.change(select, { target: { value: '2' } });

      fireEvent.click(screen.getByTestId('confirm-forward-btn'));

      await waitFor(() => {
        expect(handleForward).toHaveBeenCalledWith(5, 2);
        expect(handleClose).toHaveBeenCalled();
      });
    });
  });
});
