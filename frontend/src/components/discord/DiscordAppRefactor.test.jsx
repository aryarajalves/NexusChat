import React, { useRef } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react';
import { ToastProvider } from '../../context/ToastContext';
import DiscordApp from './DiscordApp';
import DiscordModalsLayer from './DiscordModalsLayer';
import useDiscordUnifiedChatActions from './useDiscordUnifiedChatActions';
import {
  useDiscordUnreadCallbacks,
  useDiscordFeedEffects,
} from './useDiscordMessagesAndUnreads';

describe('Refatoração Modular do DiscordApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('auth_token', 'test-refactor-jwt');

    class MockWebSocket {
      static OPEN = 1;
      constructor(url) {
        this.url = url;
        this.readyState = 1;
        this.send = vi.fn();
        this.close = vi.fn();
      }
    }
    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('useDiscordUnreadCallbacks gerencia pins e incremento de não lidas em canais e DMs', () => {
    const activeDMIdRef = { current: null };

    const { result } = renderHook(() =>
      useDiscordUnreadCallbacks({
        activeServerId: 1,
        activeChannelId: 10,
        activeDMIdRef,
      })
    );

    act(() => {
      result.current.setMessages([{ id: 50, content: 'Msg original', is_pinned: false }]);
    });

    act(() => {
      result.current.handlePinUpdate({ id: 50, content: 'Msg original', is_pinned: true });
    });

    expect(result.current.messages[0].is_pinned).toBe(true);
    expect(result.current.pinnedMessages).toHaveLength(1);

    // Canal ativo (1/10) não incrementa badge
    act(() => {
      result.current.handleUnreadUpdate({
        type: 'channel',
        server_id: 1,
        channel_id: 10,
      });
    });
    expect(result.current.unreads.channels['10'] || 0).toBe(0);

    // Outro canal (1/20) incrementa badge do canal e servidor
    act(() => {
      result.current.handleUnreadUpdate({
        type: 'channel',
        server_id: 1,
        channel_id: 20,
      });
    });
    expect(result.current.unreads.channels['20']).toBe(1);
    expect(result.current.unreads.servers['1']).toBe(1);

    // DM não aberta incrementa contador de DMs
    act(() => {
      result.current.handleUnreadUpdate({
        type: 'dm',
        conversation_id: 99,
      });
    });
    expect(result.current.unreads.dms['99']).toBe(1);
    expect(result.current.unreads.total_dms).toBe(1);
  });

  it('useDiscordFeedEffects busca mensagens, fixados, unreads e confirma ACK automaticamente', async () => {
    const setMessages = vi.fn();
    const setPinnedMessages = vi.fn();
    const setLoadingPins = vi.fn();
    const setUnreads = vi.fn();

    global.fetch = vi.fn().mockImplementation((url) => {
      const strUrl = String(url);
      if (strUrl.includes('/messages')) {
        return Promise.resolve({ ok: true, json: async () => [{ id: 1, content: 'Oi' }] });
      }
      if (strUrl.includes('/pins')) {
        return Promise.resolve({ ok: true, json: async () => [{ id: 2, content: 'Fixada' }] });
      }
      if (strUrl.includes('/unreads')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ channels: { '10': 2 }, servers: { '1': 2 }, dms: {}, total_dms: 0 }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    renderHook(() =>
      useDiscordFeedEffects({
        token: 'jwt-token',
        activeServerId: 1,
        activeChannelId: 10,
        activeDMId: null,
        channels: [{ id: 10, name: 'geral', type: 'TEXT' }],
        unreads: { channels: { '10': 2 }, servers: { '1': 2 }, dms: {}, total_dms: 0 },
        setUnreads,
        setMessages,
        setPinnedMessages,
        setLoadingPins,
      })
    );

    await waitFor(() => {
      expect(setMessages).toHaveBeenCalledWith([{ id: 1, content: 'Oi' }]);
      expect(setPinnedMessages).toHaveBeenCalledWith([{ id: 2, content: 'Fixada' }]);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/channels/10/ack',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('useDiscordUnifiedChatActions roteia corretamente entre Servidor e DM', async () => {
    const handleSendMessage = vi.fn().mockResolvedValue();
    const handleConfirmDeleteMessage = vi.fn().mockResolvedValue();
    const setMessages = vi.fn();
    const loadConversations = vi.fn();
    const addToast = vi.fn();

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (opts?.method === 'POST' && String(url).includes('/dms/conversations/77/messages')) {
        return Promise.resolve({ ok: true, json: async () => ({ id: 300, content: 'Olá DM' }) });
      }
      if (opts?.method === 'DELETE' && String(url).includes('/dms/messages/300')) {
        return Promise.resolve({ ok: true, json: async () => ({}) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    // 1. Modo Servidor (activeServerId = 5)
    const { result: serverResult } = renderHook(() =>
      useDiscordUnifiedChatActions({
        token: 'jwt-1',
        activeServerId: 5,
        activeChannelId: 12,
        activeDMId: null,
        setMessages,
        loadConversations,
        addToast,
        handleUploadAttachment: vi.fn(),
        handleSendMessage,
        handleEditMessage: vi.fn(),
        handleToggleReaction: vi.fn(),
        handleConfirmDeleteMessage,
        handleTogglePin: vi.fn(),
        handlePinUpdate: vi.fn(),
      })
    );

    await serverResult.current.handleGeneralSendMessage({ content: 'Msg Canal' });
    expect(handleSendMessage).toHaveBeenCalledWith({ content: 'Msg Canal' });

    // 2. Modo DM (activeServerId = null, activeDMId = 77)
    const { result: dmResult } = renderHook(() =>
      useDiscordUnifiedChatActions({
        token: 'jwt-1',
        activeServerId: null,
        activeChannelId: null,
        activeDMId: 77,
        setMessages,
        loadConversations,
        addToast,
        handleUploadAttachment: vi.fn(),
        handleSendMessage,
        handleEditMessage: vi.fn(),
        handleToggleReaction: vi.fn(),
        handleConfirmDeleteMessage,
        handleTogglePin: vi.fn(),
        handlePinUpdate: vi.fn(),
      })
    );

    await dmResult.current.handleGeneralSendMessage({ content: 'Olá DM' });
    expect(loadConversations).toHaveBeenCalled();

    await dmResult.current.handleGeneralConfirmDelete(300);
    expect(addToast).toHaveBeenCalledWith('Mensagem excluída com sucesso.', 'info');
  });

  it('DiscordModalsLayer renderiza CreateServerModal quando aberto', () => {
    const setIsCreateServerOpen = vi.fn();

    render(
      <ToastProvider>
        <DiscordModalsLayer
          token="jwt-1"
          currentUser={{ id: 1, name: 'Admin', role: 'superadmin' }}
          activeServer={{ id: 1, name: 'Servidor', owner_id: 1 }}
          activeServerId={1}
          isCreateServerOpen={true}
          setIsCreateServerOpen={setIsCreateServerOpen}
          handleCreateServer={vi.fn()}
          isCreateChannelOpen={false}
          setIsCreateChannelOpen={vi.fn()}
          isInviteOpen={false}
          setIsInviteOpen={vi.fn()}
          isServerSettingsOpen={false}
          setIsServerSettingsOpen={vi.fn()}
          isUserSettingsOpen={false}
          setIsUserSettingsOpen={vi.fn()}
          isDeleteModalOpen={false}
          onCloseDeleteMessageModal={vi.fn()}
          isNewDMOpen={false}
          setIsNewDMOpen={vi.fn()}
          isDeleteServerOpen={false}
          onCloseDeleteServerModal={vi.fn()}
        />
      </ToastProvider>
    );

    expect(screen.getByText('Criar seu Servidor')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('server-cancel-btn'));
    expect(setIsCreateServerOpen).toHaveBeenCalledWith(false);
  });

  it('DiscordApp renderiza o layout completo e abre modal de criação de servidor sem regressões', async () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      const strUrl = String(url);
      if (strUrl.endsWith('/discord/servers')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 1, name: 'Servidor Principal', owner_id: 1 }],
        });
      }
      if (strUrl.includes('/channels') && !strUrl.includes('/messages') && !strUrl.includes('/pins')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 10, server_id: 1, name: 'geral', type: 'TEXT' }],
        });
      }
      if (strUrl.includes('/members')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: 1, user_id: 1, name: 'Admin', role: 'OWNER', is_online: true }],
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    render(
      <ToastProvider>
        <DiscordApp
          currentUser={{ id: 1, name: 'Admin', email: 'admin@nexus.com', role: 'superadmin' }}
          onUserUpdated={vi.fn()}
          onToggleAppSidebar={vi.fn()}
          isAppSidebarHidden={true}
          onLogout={vi.fn()}
        />
      </ToastProvider>
    );

    expect(screen.getByTestId('discord-app-root')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-server-btn'));
    expect(await screen.findByText('Criar seu Servidor')).toBeInTheDocument();
  });
});
