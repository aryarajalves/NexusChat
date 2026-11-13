import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, act } from '@testing-library/react';
import VoicePipPlayer from './VoicePipPlayer';
import ChannelSidebarFooter from './ChannelSidebarFooter';
import DMSidebar from './DMSidebar';
import { useDiscordNavigation } from './useDiscordNavigation';

describe('VoicePip Cross-Server Navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('triggers onReturnToVoice when clicking maximize button on VoicePipPlayer', () => {
    const handleReturn = vi.fn();
    render(
      <VoicePipPlayer
        channel={{ id: 42, name: 'sala-geral', server_id: 10 }}
        currentUser={{ id: 1, name: 'Alice' }}
        participantsCount={2}
        isMuted={false}
        isSpeaking={false}
        isCameraOn={false}
        isScreenSharing={false}
        onReturnToVoice={handleReturn}
      />
    );

    const expandBtn = screen.getByTestId('voice-pip-expand-btn');
    fireEvent.click(expandBtn);
    expect(handleReturn).toHaveBeenCalledTimes(1);
  });

  it('triggers onReturnToVoice when clicking header title on VoicePipPlayer', () => {
    const handleReturn = vi.fn();
    render(
      <VoicePipPlayer
        channel={{ id: 42, name: 'sala-geral', server_id: 10 }}
        currentUser={{ id: 1, name: 'Alice' }}
        onReturnToVoice={handleReturn}
      />
    );

    const titleBtn = screen.getByTestId('voice-pip-title-btn');
    fireEvent.click(titleBtn);
    expect(handleReturn).toHaveBeenCalledTimes(1);
  });

  it('triggers onReturnToVoice in ChannelSidebarFooter when connected to another server voice channel', () => {
    const handleReturn = vi.fn();
    render(
      <ChannelSidebarFooter
        connectedVoiceChannel={{ id: 42, name: 'sala-geral', server_id: 10 }}
        server={{ id: 10, name: 'Servidor Call' }}
        onSelectChannel={vi.fn()}
        onReturnToVoice={handleReturn}
        currentUser={{ id: 1, name: 'Alice' }}
      />
    );

    const statusTitle = screen.getByText('Voz Conectada');
    fireEvent.click(statusTitle.closest('.voice-connection-info'));
    expect(handleReturn).toHaveBeenCalledTimes(1);
  });

  it('triggers onReturnToVoice in DMSidebar when connected to a voice channel', () => {
    const handleReturn = vi.fn();
    render(
      <DMSidebar
        conversations={[]}
        activeDMId={null}
        onSelectDM={vi.fn()}
        currentUser={{ id: 1, name: 'Alice' }}
        connectedVoiceChannel={{ id: 42, name: 'sala-geral', server_id: 10 }}
        connectedVoiceServerName="Servidor Call"
        onReturnToVoice={handleReturn}
      />
    );

    const statusTitle = screen.getByText('Voz Conectada');
    fireEvent.click(statusTitle.closest('.voice-connection-info'));
    expect(handleReturn).toHaveBeenCalledTimes(1);
  });

  describe('useDiscordNavigation handleReturnToVoice hook behavior', () => {
    it('switches activeServerId and targets voice channel when returning from another server', async () => {
      global.fetch = vi.fn((url) => {
        if (url.endsWith('/servers')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { id: 5, name: 'Servidor B' },
                { id: 10, name: 'Servidor Call' },
              ]),
          });
        }
        if (url.includes('/servers/10/channels')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { id: 101, name: 'chat-geral', type: 'TEXT' },
                { id: 42, name: 'sala-geral', type: 'VOICE' },
              ]),
          });
        }
        if (url.includes('/servers/5/channels')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve([
                { id: 501, name: 'outro-chat', type: 'TEXT' },
              ]),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      });

      const setServers = vi.fn();
      let channelsState = [{ id: 999, name: 'outro-servidor-chat', type: 'TEXT' }];
      const setChannels = vi.fn((chs) => { channelsState = chs; });
      const setMembers = vi.fn();

      const { result } = renderHook(() =>
        useDiscordNavigation({
          token: 'mock-token',
          servers: [{ id: 5, name: 'Servidor B' }, { id: 10, name: 'Servidor Call' }],
          setServers,
          channels: channelsState,
          setChannels,
          setMembers,
        })
      );

      // Usuário está no servidor 5
      act(() => {
        result.current.handleSelectServer(5);
      });
      expect(result.current.activeServerId).toBe(5);

      // Usuário clica em maximizar no PiP apontando para o canal do servidor 10
      await act(async () => {
        result.current.handleReturnToVoice({ id: 42, name: 'sala-geral', server_id: 10 });
      });

      // Deve ter mudado activeServerId para 10 e apontado activeChannelId para 42
      expect(result.current.activeServerId).toBe(10);
      expect(result.current.activeChannelId).toBe(42);
      expect(localStorage.getItem('discord_active_server_id')).toBe('10');
    });

    it('keeps activeServerId if already in the same server and activates the voice channel', () => {
      const { result } = renderHook(() =>
        useDiscordNavigation({
          token: 'mock-token',
          servers: [{ id: 10, name: 'Servidor Call' }],
          setServers: vi.fn(),
          channels: [
            { id: 101, name: 'chat-geral', type: 'TEXT' },
            { id: 42, name: 'sala-geral', type: 'VOICE' },
          ],
          setChannels: vi.fn(),
          setMembers: vi.fn(),
        })
      );

      act(() => {
        result.current.handleSelectServer(10);
      });
      expect(result.current.activeServerId).toBe(10);

      // Se já está no servidor 10 e clica no PiP
      act(() => {
        result.current.handleReturnToVoice({ id: 42, name: 'sala-geral', server_id: 10 });
      });

      expect(result.current.activeServerId).toBe(10);
      expect(result.current.activeChannelId).toBe(42);
    });
  });
});
