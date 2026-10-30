import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CreateChannelModal from './CreateChannelModal';
import ChannelSidebar from './ChannelSidebar';

describe('Private Channels & Role Restrictions (Texto e Voz)', () => {
  const mockRoles = [
    { id: 1, name: 'VIP', color: '#f1c40f', is_admin: false },
    { id: 2, name: 'Moderador', color: '#3498db', is_admin: false },
    { id: 3, name: 'Admin', color: '#e74c3c', is_admin: true },
  ];

  describe('CreateChannelModal Component', () => {
    it('renders private channel toggle switch and initially does not show roles checklist', () => {
      render(
        <CreateChannelModal
          isOpen={true}
          onClose={vi.fn()}
          onCreateChannel={vi.fn()}
          roles={mockRoles}
        />
      );

      expect(screen.getByTestId('channel-private-toggle')).toBeInTheDocument();
      expect(screen.queryByTestId('channel-roles-permission-box')).not.toBeInTheDocument();
    });

    it('toggles private channel switch to show roles checklist and allows selecting roles', async () => {
      render(
        <CreateChannelModal
          isOpen={true}
          onClose={vi.fn()}
          onCreateChannel={vi.fn()}
          roles={mockRoles}
        />
      );

      const toggle = screen.getByTestId('channel-private-toggle');
      fireEvent.click(toggle);

      expect(screen.getByTestId('channel-roles-permission-box')).toBeInTheDocument();
      expect(screen.getByText('VIP')).toBeInTheDocument();
      expect(screen.getByText('Moderador')).toBeInTheDocument();
      expect(screen.getAllByText('Admin').length).toBeGreaterThanOrEqual(1);

      // Clica nos cargos VIP e Moderador para selecionar
      const vipItem = screen.getByTestId('channel-role-item-1');
      const modItem = screen.getByTestId('channel-role-item-2');
      fireEvent.click(vipItem);
      fireEvent.click(modItem);

      expect(vipItem).toHaveClass('selected');
      expect(modItem).toHaveClass('selected');
    });

    it('submits private text channel with allowed role ids', async () => {
      const handleCreate = vi.fn().mockResolvedValue({});
      render(
        <CreateChannelModal
          isOpen={true}
          onClose={vi.fn()}
          onCreateChannel={handleCreate}
          roles={mockRoles}
        />
      );

      fireEvent.change(screen.getByTestId('channel-name-input'), { target: { value: 'sala-vip' } });
      fireEvent.click(screen.getByTestId('channel-private-toggle'));
      fireEvent.click(screen.getByTestId('channel-role-item-1')); // VIP

      fireEvent.click(screen.getByTestId('channel-submit-btn'));

      await waitFor(() => {
        expect(handleCreate).toHaveBeenCalledWith({
          name: 'sala-vip',
          type: 'TEXT',
          category: 'Canais de Texto',
          is_private: true,
          allowed_role_ids: [1],
        });
      });
    });

    it('submits private voice channel with allowed role ids', async () => {
      const handleCreate = vi.fn().mockResolvedValue({});
      render(
        <CreateChannelModal
          isOpen={true}
          onClose={vi.fn()}
          onCreateChannel={handleCreate}
          roles={mockRoles}
        />
      );

      fireEvent.click(screen.getByTestId('channel-type-voice'));
      fireEvent.change(screen.getByTestId('channel-name-input'), { target: { value: 'call-vip' } });
      fireEvent.click(screen.getByTestId('channel-private-toggle'));
      fireEvent.click(screen.getByTestId('channel-role-item-2')); // Moderador

      fireEvent.click(screen.getByTestId('channel-submit-btn'));

      await waitFor(() => {
        expect(handleCreate).toHaveBeenCalledWith({
          name: 'call-vip',
          type: 'VOICE',
          category: 'Canais de Voz',
          is_private: true,
          allowed_role_ids: [2],
        });
      });
    });
  });

  describe('ChannelSidebar Component', () => {
    const mockChannels = [
      { id: 10, name: 'geral', type: 'TEXT', is_private: false },
      { id: 11, name: 'vip-chat', type: 'TEXT', is_private: true },
      { id: 20, name: 'Voz Geral', type: 'VOICE', is_private: false },
      { id: 21, name: 'Voz Privada', type: 'VOICE', is_private: true },
    ];

    it('renders lock icon for private text channels and normal hash for public text channels', () => {
      render(
        <ChannelSidebar
          server={{ id: 1, name: 'Servidor Teste' }}
          channels={mockChannels}
          activeChannelId={10}
          onSelectChannel={vi.fn()}
        />
      );

      expect(screen.getByTestId('channel-lock-11')).toBeInTheDocument();
      expect(screen.queryByTestId('channel-lock-10')).not.toBeInTheDocument();
    });

    it('renders lock icon for private voice channels and volume for public voice channels', () => {
      render(
        <ChannelSidebar
          server={{ id: 1, name: 'Servidor Teste' }}
          channels={mockChannels}
          activeChannelId={20}
          onSelectChannel={vi.fn()}
        />
      );

      expect(screen.getByTestId('channel-lock-21')).toBeInTheDocument();
      expect(screen.queryByTestId('channel-lock-20')).not.toBeInTheDocument();
    });
  });
});
