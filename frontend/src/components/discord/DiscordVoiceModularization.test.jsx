import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import ChannelSidebarFooter from './ChannelSidebarFooter';
import ChannelSidebar from './ChannelSidebar';
import DMSidebar from './DMSidebar';
import useDiscordVoiceAndUserSync from './useDiscordVoiceAndUserSync';
import { useDiscordFeedEffects } from './useDiscordMessagesAndUnreads';

vi.mock('./discordSounds', () => ({
  playDiscordSound: vi.fn(),
}));

describe('Modularização: ChannelSidebarFooter & useDiscordVoiceAndUserSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ChannelSidebarFooter', () => {
    it('renderiza barra de voz conectada e controles do usuário logado', () => {
      const onSelectChannel = vi.fn();
      const onDisconnectVoice = vi.fn();
      const onToggleNoiseSuppression = vi.fn();
      const onToggleVoiceMute = vi.fn();
      const onToggleVoiceDeafen = vi.fn();
      const onOpenUserSettings = vi.fn();

      render(
        <ChannelSidebarFooter
          connectedVoiceChannel={{ id: 10, name: 'Sala de Voz' }}
          server={{ id: 1, name: 'Servidor Teste' }}
          onSelectChannel={onSelectChannel}
          onDisconnectVoice={onDisconnectVoice}
          isNoiseSuppressionEnabled={true}
          onToggleNoiseSuppression={onToggleNoiseSuppression}
          currentUser={{ id: 1, name: 'Super Admin', avatar_url: 'https://cdn.example.com/avatar.png' }}
          onOpenUserSettings={onOpenUserSettings}
          isVoiceMuted={false}
          onToggleVoiceMute={onToggleVoiceMute}
          isVoiceDeafened={false}
          onToggleVoiceDeafen={onToggleVoiceDeafen}
        />
      );

      expect(screen.getByTestId('discord-voice-status-bar')).toBeInTheDocument();
      expect(screen.getByText('Sala de Voz / Servidor Teste')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('sidebar-noise-suppression-btn'));
      expect(onToggleNoiseSuppression).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('sidebar-voice-disconnect-btn'));
      expect(onDisconnectVoice).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('mic-btn'));
      expect(onToggleVoiceMute).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('audio-btn'));
      expect(onToggleVoiceDeafen).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('user-settings-btn'));
      expect(onOpenUserSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('ChannelSidebar - Isolamento de usuários de voz vs texto (onlineUsers)', () => {
    it('não exibe usuários que estão apenas online no chat de texto dentro do canal de voz', () => {
      const mockChannels = [
        { id: 1, name: 'geral', type: 'TEXT' },
        { id: 10, name: 'Sala de Voz', type: 'VOICE' },
      ];

      render(
        <ChannelSidebar
          server={{ id: 1, name: 'Teste' }}
          channels={mockChannels}
          activeChannelId={10}
          connectedVoiceChannelId={10}
          currentUser={{ id: 1, name: 'Super Admin' }}
          onlineUsers={[
            { user_id: 1, user_name: 'Super Admin' },
            { user_id: 2, user_name: 'Hokage' }, // Apenas online no canal de texto #geral
          ]}
          voiceChannelUsers={{
            10: [{ user_id: 1, user_name: 'Super Admin' }],
          }}
          onSelectChannel={vi.fn()}
        />
      );

      expect(screen.getByTestId('voice-user-item-1')).toBeInTheDocument();
      expect(screen.queryByTestId('voice-user-item-2')).not.toBeInTheDocument();
      expect(screen.queryByText('Hokage')).not.toBeInTheDocument();
    });
  });

  describe('useDiscordVoiceAndUserSync', () => {
    it('mescla corretamente o estado local de voz (is_speaking, is_muted, is_deafened) em activeVoiceStates e desconecta limpando estados', () => {
      const setConnectedVoiceChannelId = vi.fn();
      const setIsVoiceSpeaking = vi.fn();
      const handleSelectChannel = vi.fn();
      const addToast = vi.fn();
      const channels = [
        { id: 1, name: 'geral', type: 'TEXT' },
        { id: 10, name: 'Sala de Voz', type: 'VOICE' },
      ];
      const currentUser = { id: 7, name: 'Aryaraj' };
      const onlineUsers = [];
      const voiceStates = {};
      const globalVoiceStates = {};
      const sendVoiceState = vi.fn();
      const handleUnreadUpdate = vi.fn();
      const handleDMMessageNew = vi.fn();
      const setMembers = vi.fn();
      const setServers = vi.fn();
      const setMessages = vi.fn();
      const setConversations = vi.fn();

      const { result } = renderHook(() =>
        useDiscordVoiceAndUserSync({
          token: null,
          channels,
          activeChannelId: 10,
          activeServerId: 1,
          connectedVoiceChannelId: 10,
          setConnectedVoiceChannelId,
          onlineUsers,
          currentUser,
          voiceStates,
          globalVoiceStates,
          isVoiceMuted: false,
          isVoiceDeafened: false,
          isVoiceSpeaking: true,
          setIsVoiceSpeaking,
          sendVoiceState,
          handleUnreadUpdate,
          handleDMMessageNew,
          handleSelectChannel,
          setMembers,
          setServers,
          setMessages,
          setConversations,
          addToast,
        })
      );

      expect(result.current.activeVoiceStates[7]).toEqual({
        is_muted: false,
        is_deafened: false,
        is_speaking: true,
      });

      act(() => {
        result.current.handleDisconnectVoice();
      });

      expect(setConnectedVoiceChannelId).toHaveBeenCalledWith(null);
      expect(setIsVoiceSpeaking).toHaveBeenCalledWith(false);
      expect(handleSelectChannel).toHaveBeenCalledWith(1);
      expect(addToast).toHaveBeenCalledWith('Você saiu do canal de voz.', 'info');
    });
  });

  describe('DMSidebar & useDiscordFeedEffects - Isolamento de mensagens DM vs Canal e Voz Conectada', () => {
    it('renderiza barra de Voz Conectada e botão de Supressão de Ruído dentro da DMSidebar', () => {
      const onToggleNoiseSuppression = vi.fn();
      const onDisconnectVoice = vi.fn();

      render(
        <DMSidebar
          conversations={[]}
          activeConversationId={null}
          onSelectConversation={vi.fn()}
          onOpenNewDM={vi.fn()}
          currentUser={{ id: 1, name: 'Super Admin' }}
          connectedVoiceChannel={{ id: 5, name: 'gados-de-lula' }}
          connectedVoiceServerName="Teste"
          isNoiseSuppressionEnabled={true}
          onToggleNoiseSuppression={onToggleNoiseSuppression}
          onDisconnectVoice={onDisconnectVoice}
        />
      );

      expect(screen.getByTestId('dm-voice-status-bar')).toBeInTheDocument();
      expect(screen.getByText('gados-de-lula / Teste')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('dm-noise-suppression-btn'));
      expect(onToggleNoiseSuppression).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByTestId('dm-voice-disconnect-btn'));
      expect(onDisconnectVoice).toHaveBeenCalledTimes(1);
    });

    it('limpa imediatamente o estado de mensagens ao alternar entre Servidor e DM para não vazar mensagens do canal', async () => {
      const setMessages = vi.fn();
      const setPinnedMessages = vi.fn();
      const setLoadingPins = vi.fn();
      const setUnreads = vi.fn();
      const channels = [{ id: 1, name: 'geral', type: 'TEXT' }];
      const unreads = { channels: {}, servers: {}, dms: {}, total_dms: 0 };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: 99, content: 'Mensagem exclusiva da DM' }],
      });

      const { rerender } = renderHook(
        ({ activeServerId, activeChannelId, activeDMId }) =>
          useDiscordFeedEffects({
            token: 'fake-token',
            activeServerId,
            activeChannelId,
            activeDMId,
            channels,
            unreads,
            setUnreads,
            setMessages,
            setPinnedMessages,
            setLoadingPins,
          }),
        {
          initialProps: { activeServerId: 1, activeChannelId: 1, activeDMId: 10 },
        }
      );

      setMessages.mockClear();

      // Alterna do servidor (1) para DMs (null)
      rerender({ activeServerId: null, activeChannelId: null, activeDMId: 10 });

      // Primeira chamada síncrona deve limpar as mensagens anteriores do servidor
      expect(setMessages).toHaveBeenCalledWith([]);
    });
  });
});
