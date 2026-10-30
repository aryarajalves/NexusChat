import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChannelSidebar from './ChannelSidebar';
import ServerSettingsModal from './ServerSettingsModal';
import ServerGeneralTab from './ServerGeneralTab';
import ServerRolesTab from './ServerRolesTab';
import ServerMembersTab from './ServerMembersTab';
import { ToastProvider } from '../../context/ToastContext';

describe('Server Settings & Roles Management (Item 3)', () => {
  const mockServer = {
    id: 1,
    name: 'Servidor dos Devs',
    owner_id: 1,
    icon_url: '/icon.png',
    banner_url: '/banner.png',
    description: 'Comunidade oficial',
  };

  const mockCurrentUser = { id: 1, name: 'Arya', email: 'arya@teste.com' };

  const mockRoles = [
    { id: 10, server_id: 1, name: 'Moderador', color: '#5865f2', position: 1, is_admin: true, hoist: true },
    { id: 20, server_id: 1, name: 'VIP', color: '#fee75c', position: 2, is_admin: false, hoist: false },
  ];

  const mockMembers = [
    { id: 101, server_id: 1, user_id: 1, name: 'Arya', email: 'arya@teste.com', role: 'OWNER', role_id: null },
    { id: 102, server_id: 1, user_id: 2, name: 'Lucas', email: 'lucas@teste.com', role: 'MEMBER', role_id: 10, role_name: 'Moderador', role_color: '#5865f2' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem('auth_token', 'test-token');
  });

  describe('ChannelSidebar Server Dropdown Menu', () => {
    it('opens dropdown menu on header click and shows Server Settings for owner/admin', () => {
      const onOpenSettings = vi.fn();
      render(
        <ChannelSidebar
          server={mockServer}
          channels={[{ id: 1, name: 'geral', type: 'TEXT' }]}
          currentUser={mockCurrentUser}
          currentUserRole="OWNER"
          onOpenServerSettings={onOpenSettings}
        />
      );

      const header = screen.getByTestId('server-header');
      fireEvent.click(header);

      const menu = screen.getByTestId('server-dropdown-menu');
      expect(menu).toBeInTheDocument();

      const settingsBtn = screen.getByTestId('server-settings-menu-item');
      expect(settingsBtn).toBeInTheDocument();

      fireEvent.click(settingsBtn);
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('shows Excluir Servidor in dropdown menu for owner and calls onOpenDeleteServer', () => {
      const onOpenDeleteServer = vi.fn();
      render(
        <ChannelSidebar
          server={mockServer}
          channels={[{ id: 1, name: 'geral', type: 'TEXT' }]}
          currentUser={mockCurrentUser}
          currentUserRole="OWNER"
          onOpenDeleteServer={onOpenDeleteServer}
        />
      );

      fireEvent.click(screen.getByTestId('server-header'));
      const deleteBtn = screen.getByTestId('server-delete-menu-item');
      expect(deleteBtn).toBeInTheDocument();
      expect(deleteBtn).toHaveTextContent('Excluir Servidor');

      fireEvent.click(deleteBtn);
      expect(onOpenDeleteServer).toHaveBeenCalledWith(mockServer);
    });

    it('does not display Server Settings menu item or Excluir Servidor for normal members', () => {
      render(
        <ChannelSidebar
          server={{ ...mockServer, owner_id: 999 }}
          channels={[{ id: 1, name: 'geral', type: 'TEXT' }]}
          currentUser={{ id: 50, name: 'Visitante' }}
          currentUserRole="MEMBER"
        />
      );

      fireEvent.click(screen.getByTestId('server-header'));
      expect(screen.queryByTestId('server-settings-menu-item')).toBeNull();
      expect(screen.queryByTestId('server-delete-menu-item')).toBeNull();
      expect(screen.getByTestId('server-create-channel-menu-item')).toBeInTheDocument();
    });
  });

  describe('ServerGeneralTab Component', () => {
    it('renders server fields and allows updating name/description', async () => {
      const onServerUpdated = vi.fn();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...mockServer, name: 'Novo Nome Servidor' }),
      });

      render(
        <ToastProvider>
          <ServerGeneralTab
            server={mockServer}
            onServerUpdated={onServerUpdated}
            token="test-token"
          />
        </ToastProvider>
      );

      const nameInput = screen.getByTestId('server-name-input');
      expect(nameInput).toHaveValue('Servidor dos Devs');

      fireEvent.change(nameInput, { target: { value: 'Novo Nome Servidor' } });
      fireEvent.click(screen.getByTestId('save-general-btn'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/discord/servers/1',
          expect.objectContaining({ method: 'PATCH' })
        );
        expect(onServerUpdated).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Novo Nome Servidor' })
        );
      });
    });

    it('renders Danger Zone for owner and triggers onOpenDeleteServer', () => {
      const onOpenDeleteServer = vi.fn();
      render(
        <ToastProvider>
          <ServerGeneralTab
            server={mockServer}
            onServerUpdated={vi.fn()}
            token="test-token"
            isOwner={true}
            onOpenDeleteServer={onOpenDeleteServer}
          />
        </ToastProvider>
      );

      const dangerZone = screen.getByTestId('danger-zone-section');
      expect(dangerZone).toBeInTheDocument();

      const deleteBtn = screen.getByTestId('danger-zone-delete-btn');
      expect(deleteBtn).toHaveTextContent('Excluir Servidor');

      fireEvent.click(deleteBtn);
      expect(onOpenDeleteServer).toHaveBeenCalledTimes(1);
    });
  });

  describe('ServerRolesTab Component', () => {
    it('lists roles and allows creating a new role', async () => {
      const onRolesUpdated = vi.fn();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 30,
          server_id: 1,
          name: 'Designer',
          color: '#eb459e',
          position: 0,
          is_admin: false,
          hoist: true,
        }),
      });

      render(
        <ToastProvider>
          <ServerRolesTab
            server={mockServer}
            roles={mockRoles}
            onRolesUpdated={onRolesUpdated}
            token="test-token"
          />
        </ToastProvider>
      );

      expect(screen.getByText('Moderador')).toBeInTheDocument();
      expect(screen.getByText('VIP')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('create-role-btn'));

      const nameInput = screen.getByTestId('role-name-input');
      fireEvent.change(nameInput, { target: { value: 'Designer' } });

      fireEvent.click(screen.getByTestId('role-color-fúcsia'));
      fireEvent.click(screen.getByTestId('save-role-btn'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/discord/servers/1/roles',
          expect.objectContaining({ method: 'POST' })
        );
        expect(onRolesUpdated).toHaveBeenCalled();
      });
    });

    it('opens delete confirmation modal and confirms deleting role', async () => {
      const onRolesUpdated = vi.fn();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Cargo excluído' }),
      });

      render(
        <ToastProvider>
          <ServerRolesTab
            server={mockServer}
            roles={mockRoles}
            onRolesUpdated={onRolesUpdated}
            token="test-token"
          />
        </ToastProvider>
      );

      fireEvent.click(screen.getByTestId('delete-role-btn'));

      const modal = screen.getByTestId('delete-role-modal');
      expect(modal).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('confirm-delete-role-btn'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/discord/servers/1/roles/10',
          expect.objectContaining({ method: 'DELETE' })
        );
        expect(onRolesUpdated).toHaveBeenCalled();
      });
    });
  });

  describe('ServerMembersTab Component', () => {
    it('renders members and updates assigned role', async () => {
      const onMembersUpdated = vi.fn();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ...mockMembers[1],
          role_id: 20,
          role_name: 'VIP',
          role_color: '#fee75c',
        }),
      });

      render(
        <ToastProvider>
          <ServerMembersTab
            server={mockServer}
            members={mockMembers}
            roles={mockRoles}
            onMembersUpdated={onMembersUpdated}
            token="test-token"
            currentUserId={1}
          />
        </ToastProvider>
      );

      expect(screen.getByTestId('member-name-101')).toHaveTextContent('Arya');
      expect(screen.getByTestId('member-name-102')).toHaveTextContent('Lucas');

      const select = screen.getByTestId('member-role-select-102');
      fireEvent.change(select, { target: { value: '20' } });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/discord/servers/1/members/102/role',
          expect.objectContaining({ method: 'PATCH' })
        );
        expect(onMembersUpdated).toHaveBeenCalled();
      });
    });

    it('filters members by search query', () => {
      render(
        <ToastProvider>
          <ServerMembersTab
            server={mockServer}
            members={mockMembers}
            roles={mockRoles}
            onMembersUpdated={vi.fn()}
            token="test-token"
          />
        </ToastProvider>
      );

      const searchInput = screen.getByTestId('search-members-input');
      fireEvent.change(searchInput, { target: { value: 'Lucas' } });

      expect(screen.getByText('Lucas')).toBeInTheDocument();
      expect(screen.queryByText('Arya')).toBeNull();
    });
  });

  describe('ServerSettingsModal Container', () => {
    it('switches between tabs and closes when close button is clicked', () => {
      const onClose = vi.fn();
      render(
        <ToastProvider>
          <ServerSettingsModal
            isOpen={true}
            onClose={onClose}
            server={mockServer}
            currentUser={mockCurrentUser}
            members={mockMembers}
          />
        </ToastProvider>
      );

      expect(screen.getByTestId('server-general-tab')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('tab-roles-btn'));
      expect(screen.getByTestId('server-roles-tab')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('tab-members-btn'));
      expect(screen.getByTestId('server-members-tab')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('close-server-settings-btn'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders delete server button in sidebar for owner and triggers onOpenDeleteServer', () => {
      const onOpenDeleteServer = vi.fn();
      const onClose = vi.fn();

      render(
        <ToastProvider>
          <ServerSettingsModal
            isOpen={true}
            onClose={onClose}
            server={mockServer}
            currentUser={mockCurrentUser}
            members={mockMembers}
            onOpenDeleteServer={onOpenDeleteServer}
          />
        </ToastProvider>
      );

      const deleteBtn = screen.getByTestId('sidebar-delete-server-btn');
      expect(deleteBtn).toBeInTheDocument();
      expect(deleteBtn).toHaveTextContent('Excluir Servidor');

      fireEvent.click(deleteBtn);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onOpenDeleteServer).toHaveBeenCalledWith(mockServer);
    });
  });
});
