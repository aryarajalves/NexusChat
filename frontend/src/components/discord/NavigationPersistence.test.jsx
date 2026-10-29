import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act, waitFor } from '@testing-library/react';
import { useDiscordNavigation } from './useDiscordNavigation';
import { useDiscordDMs } from './useDiscordDMs';
import InfrastructureManagement from '../infrastructure/InfrastructureManagement';
import { ToastProvider } from '../../context/ToastContext';

describe('Navigation and Screen Persistence Feature', () => {
  const toastWrapper = ({ children }) => <ToastProvider>{children}</ToastProvider>;

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem('auth_token', 'test-jwt-token');

    // Mock fetch default para evitar URL relativa inválida no Node
    global.fetch = vi.fn().mockImplementation((url) => {
      const u = String(url);
      if (u.includes('/channels')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 10, name: 'geral', type: 'TEXT' },
            { id: 20, name: 'voz', type: 'VOICE' },
          ],
        });
      }
      if (u.includes('/servers')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 1, name: 'Servidor Teste' },
            { id: 2, name: 'Segundo Servidor' },
          ],
        });
      }
      if (u.includes('/members')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ user_id: 1, role: 'OWNER' }],
        });
      }
      if (u.includes('/dms/conversations')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: 100, other_user: { id: 2, name: 'Amigo 1' } },
            { id: 200, other_user: { id: 3, name: 'Amigo 2' } },
          ],
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  describe('useDiscordNavigation hook', () => {
    it('initializes activeServerId and activeChannelId from localStorage', () => {
      localStorage.setItem('discord_active_server_id', '42');
      localStorage.setItem('discord_active_channel_42', '105');

      const setServers = vi.fn();
      const setChannels = vi.fn();
      const setMembers = vi.fn();

      const { result } = renderHook(() =>
        useDiscordNavigation({
          token: 'test-jwt-token',
          servers: [],
          setServers,
          channels: [],
          setChannels,
          setMembers,
        })
      );

      expect(result.current.activeServerId).toBe(42);
      expect(result.current.activeChannelId).toBe(105);
    });

    it('initializes activeServerId as null when discord_active_server_id is "dms"', () => {
      localStorage.setItem('discord_active_server_id', 'dms');

      const setServers = vi.fn();
      const setChannels = vi.fn();
      const setMembers = vi.fn();

      const { result } = renderHook(() =>
        useDiscordNavigation({
          token: 'test-jwt-token',
          servers: [],
          setServers,
          channels: [],
          setChannels,
          setMembers,
        })
      );

      expect(result.current.activeServerId).toBeNull();
    });

    it('saves server and channel selections to localStorage', () => {
      const setServers = vi.fn();
      const setChannels = vi.fn();
      const setMembers = vi.fn();

      const mockChannels = [
        { id: 10, name: 'geral', type: 'TEXT' },
        { id: 20, name: 'Voz', type: 'VOICE' },
      ];

      const { result } = renderHook(() =>
        useDiscordNavigation({
          token: 'test-jwt-token',
          servers: [],
          setServers,
          channels: mockChannels,
          setChannels,
          setMembers,
        })
      );

      act(() => {
        result.current.handleSelectServer(77);
      });
      expect(localStorage.getItem('discord_active_server_id')).toBe('77');
      expect(result.current.activeServerId).toBe(77);

      act(() => {
        result.current.handleSelectChannel(10);
      });
      expect(localStorage.getItem('discord_active_channel_id')).toBe('10');
      expect(localStorage.getItem('discord_active_channel_77')).toBe('10');
      expect(result.current.activeChannelId).toBe(10);

      act(() => {
        result.current.handleSelectServer(null);
      });
      expect(localStorage.getItem('discord_active_server_id')).toBe('dms');
      expect(result.current.activeServerId).toBeNull();
    });

    it('recovers saved channel when switching back to a previously visited server', () => {
      localStorage.setItem('discord_active_server_id', '1');
      localStorage.setItem('discord_active_channel_1', '101');
      localStorage.setItem('discord_active_channel_2', '202');

      const setServers = vi.fn();
      const setChannels = vi.fn();
      const setMembers = vi.fn();

      const { result } = renderHook(() =>
        useDiscordNavigation({
          token: 'test-jwt-token',
          servers: [],
          setServers,
          channels: [],
          setChannels,
          setMembers,
        })
      );

      act(() => {
        result.current.handleSelectServer(2);
      });

      expect(result.current.activeServerId).toBe(2);
      expect(result.current.activeChannelId).toBe(202);
      expect(localStorage.getItem('discord_active_server_id')).toBe('2');
    });

    it('falls back to first available text channel if stored channel is not found', async () => {
      localStorage.setItem('discord_active_server_id', '1');
      localStorage.setItem('discord_active_channel_1', '9999'); // canal inexistente

      const mockChannels = [
        { id: 50, name: 'voz-1', type: 'VOICE' },
        { id: 51, name: 'chat-geral', type: 'TEXT' },
      ];

      global.fetch = vi.fn().mockImplementation((url) => {
        const u = String(url);
        if (u.includes('/channels')) {
          return Promise.resolve({ ok: true, json: async () => mockChannels });
        }
        if (u.includes('/servers')) {
          return Promise.resolve({ ok: true, json: async () => [{ id: 1, name: 'Servidor 1' }] });
        }
        return Promise.resolve({ ok: true, json: async () => [] });
      });

      const setServers = vi.fn();
      const setChannels = vi.fn();
      const setMembers = vi.fn();

      const { result } = renderHook(() =>
        useDiscordNavigation({
          token: 'test-jwt-token',
          servers: [{ id: 1, name: 'Servidor 1' }],
          setServers,
          channels: [],
          setChannels,
          setMembers,
        })
      );

      await waitFor(() => {
        expect(result.current.activeChannelId).toBe(51);
      });
      expect(localStorage.getItem('discord_active_channel_1')).toBe('51');
    });
  });

  describe('useDiscordDMs persistence', () => {
    it('restores activeDMId from localStorage when conversations load', async () => {
      localStorage.setItem('discord_active_dm_id', '300');

      const mockConversations = [
        { id: 200, other_user: { id: 2, name: 'Jon' } },
        { id: 300, other_user: { id: 3, name: 'Sansa' } },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockConversations,
      });

      const { result } = renderHook(
        () =>
          useDiscordDMs({
            token: 'test-jwt-token',
            currentUser: { id: 1, name: 'Arya' },
            activeServerId: null,
            onMessagePin: vi.fn(),
            onUnreadUpdate: vi.fn(),
          }),
        { wrapper: toastWrapper }
      );

      await waitFor(() => {
        expect(result.current.activeDMId).toBe(300);
      });
    });

    it('falls back to first conversation if saved DM id is not in conversations', async () => {
      localStorage.setItem('discord_active_dm_id', '999');

      const mockConversations = [
        { id: 101, other_user: { id: 2, name: 'Robb' } },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockConversations,
      });

      const { result } = renderHook(
        () =>
          useDiscordDMs({
            token: 'test-jwt-token',
            currentUser: { id: 1, name: 'Arya' },
            activeServerId: null,
            onMessagePin: vi.fn(),
            onUnreadUpdate: vi.fn(),
          }),
        { wrapper: toastWrapper }
      );

      await waitFor(() => {
        expect(result.current.activeDMId).toBe(101);
      });
      expect(localStorage.getItem('discord_active_dm_id')).toBe('101');
    });
  });

  describe('InfrastructureManagement subtab persistence', () => {
    it('restores activeSubTab from localStorage and updates on click', async () => {
      localStorage.setItem('active_subtab_infrastructure', 'database');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          system: { cpu: 10, memory: { used_percent: 25, used_formatted: '2GB', total_formatted: '8GB' } },
          database: { pool_size: 5, checked_out: 1, checked_in: 4 },
        }),
      });

      render(
        <ToastProvider>
          <InfrastructureManagement currentUser={{ id: 1, role: 'superadmin' }} />
        </ToastProvider>
      );

      const dbTab = screen.getByTestId('subtab-database');
      expect(dbTab).toBeInTheDocument();
      expect(dbTab.style.background).toBe('rgb(88, 101, 242)'); // active color

      const alertsTab = screen.getByTestId('subtab-alerts');
      fireEvent.click(alertsTab);
      expect(localStorage.getItem('active_subtab_infrastructure')).toBe('alerts');
    });
  });
});
