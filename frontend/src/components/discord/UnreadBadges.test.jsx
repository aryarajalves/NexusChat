import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ServerListBar from './ServerListBar';
import ChannelSidebar from './ChannelSidebar';
import DMSidebar from './DMSidebar';

describe('Unread Badges & Indicators Feature (Item 4)', () => {
  describe('ServerListBar Unreads', () => {
    const mockServers = [
      { id: 1, name: 'Servidor Alpha' },
      { id: 2, name: 'Servidor Beta' },
    ];

    it('renders red badge on DM button when totalDMUnreads > 0 and user is on a server', () => {
      render(
        <ServerListBar
          servers={mockServers}
          activeServerId={1}
          totalDMUnreads={5}
          serverUnreads={{}}
        />
      );

      const dmBadge = screen.getByTestId('dm-unread-badge');
      expect(dmBadge).toBeInTheDocument();
      expect(dmBadge).toHaveTextContent('5');
    });

    it('does not render DM badge when totalDMUnreads is 0', () => {
      render(
        <ServerListBar
          servers={mockServers}
          activeServerId={1}
          totalDMUnreads={0}
          serverUnreads={{}}
        />
      );

      expect(screen.queryByTestId('dm-unread-badge')).toBeNull();
    });

    it('renders server unread badge and left pill indicator when server has unread messages', () => {
      render(
        <ServerListBar
          servers={mockServers}
          activeServerId={1}
          totalDMUnreads={0}
          serverUnreads={{ 2: 3 }}
        />
      );

      // Server 2 has 3 unreads and is not active
      const server2Badge = screen.getByTestId('server-unread-badge-2');
      expect(server2Badge).toBeInTheDocument();
      expect(server2Badge).toHaveTextContent('3');

      const indicator = screen.getByTestId('server-unread-indicator-2');
      expect(indicator).toBeInTheDocument();

      // Server 1 is active, should not show unread badge
      expect(screen.queryByTestId('server-unread-badge-1')).toBeNull();
    });

    it('caps large counters at 99+', () => {
      render(
        <ServerListBar
          servers={mockServers}
          activeServerId={1}
          totalDMUnreads={150}
          serverUnreads={{ 2: 250 }}
        />
      );

      expect(screen.getByTestId('dm-unread-badge')).toHaveTextContent('99+');
      expect(screen.getByTestId('server-unread-badge-2')).toHaveTextContent('99+');
    });
  });

  describe('ChannelSidebar Unreads', () => {
    const mockServer = { id: 1, name: 'Comunidade DEV' };
    const mockChannels = [
      { id: 10, name: 'geral', type: 'TEXT' },
      { id: 11, name: 'avisos', type: 'TEXT' },
      { id: 20, name: 'Voz Geral', type: 'VOICE' },
    ];

    it('renders red counter badge and unread dot on inactive text channels with unreads', () => {
      render(
        <ChannelSidebar
          server={mockServer}
          channels={mockChannels}
          activeChannelId={10}
          channelUnreads={{ 11: 4 }}
        />
      );

      // Channel 11 has unreads
      const badge = screen.getByTestId('channel-unread-badge-11');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('4');

      const dot = screen.getByTestId('channel-unread-dot-11');
      expect(dot).toBeInTheDocument();

      const item = screen.getByTestId('channel-item-11');
      expect(item).toHaveClass('channel-item-unread');

      // Channel 10 is active, should not show badge
      expect(screen.queryByTestId('channel-unread-badge-10')).toBeNull();
    });

    it('caps channel unread counter at 99+', () => {
      render(
        <ChannelSidebar
          server={mockServer}
          channels={mockChannels}
          activeChannelId={10}
          channelUnreads={{ 11: 120 }}
        />
      );

      expect(screen.getByTestId('channel-unread-badge-11')).toHaveTextContent('99+');
    });
  });

  describe('DMSidebar Unreads', () => {
    const mockConversations = [
      {
        id: 101,
        other_user: { id: 2, name: 'Beatriz Lima', email: 'beatriz@teste.com' },
        last_message: { content: 'Oi, tudo bem?' },
      },
      {
        id: 102,
        other_user: { id: 3, name: 'Carlos Souza', email: 'carlos@teste.com' },
        last_message: { content: 'Arquivo enviado' },
      },
    ];

    it('renders unread badge and dot for inactive DM conversations with unread messages', () => {
      render(
        <DMSidebar
          conversations={mockConversations}
          activeConversationId={101}
          dmUnreads={{ 102: 2 }}
          currentUser={{ id: 1, name: 'Admin' }}
        />
      );

      // Conversation 102 has 2 unreads
      const badge = screen.getByTestId('dm-unread-badge-102');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('2');

      const dot = screen.getByTestId('dm-unread-dot-102');
      expect(dot).toBeInTheDocument();

      const item = screen.getByTestId('dm-item-102');
      expect(item).toHaveClass('channel-item-unread');

      // Conversation 101 is active, should not show badge
      expect(screen.queryByTestId('dm-unread-badge-101')).toBeNull();
    });

    it('clears unread badge when conversation is selected', () => {
      const handleSelect = vi.fn();
      const { rerender } = render(
        <DMSidebar
          conversations={mockConversations}
          activeConversationId={101}
          dmUnreads={{ 102: 3 }}
          onSelectConversation={handleSelect}
          currentUser={{ id: 1, name: 'Admin' }}
        />
      );

      expect(screen.getByTestId('dm-unread-badge-102')).toHaveTextContent('3');

      // Click to select
      fireEvent.click(screen.getByTestId('dm-item-102'));
      expect(handleSelect).toHaveBeenCalledWith(102);

      // Rerender with 102 active
      rerender(
        <DMSidebar
          conversations={mockConversations}
          activeConversationId={102}
          dmUnreads={{ 102: 0 }}
          onSelectConversation={handleSelect}
          currentUser={{ id: 1, name: 'Admin' }}
        />
      );

      expect(screen.queryByTestId('dm-unread-badge-102')).toBeNull();
    });
  });
});
