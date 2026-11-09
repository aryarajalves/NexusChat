import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VoiceUserItem from './VoiceUserItem';
import VoiceUserVolumePopover from './VoiceUserVolumePopover';
import { RemoteAudioPool } from './RemoteMediaPlayers';

describe('Voice Channel Individual User Volume Control (Discord-Style)', () => {
  const currentUser = { id: 1, name: 'Super Admin', email: 'admin@nexus.com' };
  const remoteUser = { id: 2, name: 'Hokage', email: 'hokage@nexus.com' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders volume trigger button on remote contact in voice channel, but not for current user', () => {
    const { rerender } = render(
      <VoiceUserItem
        user={remoteUser}
        currentUser={currentUser}
        userVolumes={{ 2: 100 }}
        userLocalMutes={{ 2: false }}
        onSetUserVolume={vi.fn()}
        onToggleUserLocalMute={vi.fn()}
      />
    );

    // Para o usuário remoto Hokage, o botão de volume deve existir
    const triggerBtn = screen.getByTestId('voice-user-volume-trigger-2');
    expect(triggerBtn).toBeInTheDocument();
    expect(triggerBtn).toHaveAttribute('title', 'Ajustar volume de Hokage (100%)');

    // Para o próprio usuário (currentUser), o botão de volume não deve ser exibido
    rerender(
      <VoiceUserItem
        user={currentUser}
        currentUser={currentUser}
        userVolumes={{}}
        userLocalMutes={{}}
        onSetUserVolume={vi.fn()}
        onToggleUserLocalMute={vi.fn()}
      />
    );

    expect(screen.queryByTestId('voice-user-volume-trigger-1')).not.toBeInTheDocument();
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
  });

  it('opens volume popover on clicking trigger button and allows adjusting volume with slider', () => {
    const onSetUserVolume = vi.fn();
    const onToggleUserLocalMute = vi.fn();

    render(
      <VoiceUserItem
        user={remoteUser}
        currentUser={currentUser}
        userVolumes={{ 2: 80 }}
        userLocalMutes={{ 2: false }}
        onSetUserVolume={onSetUserVolume}
        onToggleUserLocalMute={onToggleUserLocalMute}
      />
    );

    const triggerBtn = screen.getByTestId('voice-user-volume-trigger-2');
    fireEvent.click(triggerBtn);

    // O popover de volume deve estar aberto
    const popover = screen.getByTestId('voice-user-volume-popover-2');
    expect(popover).toBeInTheDocument();
    expect(screen.getByTestId('voice-user-volume-badge')).toHaveTextContent('80%');

    // Altera o slider para 150%
    const slider = screen.getByTestId('voice-user-volume-slider');
    fireEvent.change(slider, { target: { value: '150' } });

    expect(onSetUserVolume).toHaveBeenCalledWith(2, 150);
  });

  it('opens volume popover on right-click (contextmenu) on the user row', () => {
    render(
      <VoiceUserItem
        user={remoteUser}
        currentUser={currentUser}
        userVolumes={{ 2: 100 }}
        userLocalMutes={{ 2: false }}
        onSetUserVolume={vi.fn()}
        onToggleUserLocalMute={vi.fn()}
      />
    );

    const userRow = screen.getByTestId('voice-user-item-2');
    fireEvent.contextMenu(userRow);

    expect(screen.getByTestId('voice-user-volume-popover-2')).toBeInTheDocument();
  });

  it('handles local mute toggle and resetting volume to 100%', () => {
    const onSetUserVolume = vi.fn();
    const onToggleUserLocalMute = vi.fn();

    const { rerender } = render(
      <VoiceUserVolumePopover
        user={remoteUser}
        volume={140}
        isLocallyMuted={false}
        onSetVolume={onSetUserVolume}
        onToggleMute={onToggleUserLocalMute}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('voice-user-volume-badge')).toHaveTextContent('140%');

    // Clica em Silenciar
    const muteBtn = screen.getByTestId('voice-user-mute-toggle-btn');
    expect(muteBtn).toHaveTextContent('Silenciar');
    fireEvent.click(muteBtn);
    expect(onToggleUserLocalMute).toHaveBeenCalled();

    // Rerenderiza com usuário silenciado
    rerender(
      <VoiceUserVolumePopover
        user={remoteUser}
        volume={140}
        isLocallyMuted={true}
        onSetVolume={onSetUserVolume}
        onToggleMute={onToggleUserLocalMute}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('voice-user-volume-badge')).toHaveTextContent('Silenciado');
    expect(screen.getByTestId('voice-user-mute-toggle-btn')).toHaveTextContent('Desmutar');

    // Clica em Redefinir para 100%
    const resetBtn = screen.getByTestId('voice-user-volume-reset-btn');
    fireEvent.click(resetBtn);
    expect(onSetUserVolume).toHaveBeenCalledWith(100);
    expect(onToggleUserLocalMute).toHaveBeenCalled(); // desmuta ao redefinir
  });

  it('closes volume popover on Escape key and click outside', () => {
    const onClose = vi.fn();

    render(
      <div>
        <div data-testid="outside-area">Fora</div>
        <VoiceUserVolumePopover
          user={remoteUser}
          volume={100}
          isLocallyMuted={false}
          onSetVolume={vi.fn()}
          onToggleMute={vi.fn()}
          onClose={onClose}
        />
      </div>
    );

    // Pressiona Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    // Clica fora
    fireEvent.mouseDown(screen.getByTestId('outside-area'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('applies custom volume and local mute in RemoteAudioPool', () => {
    const fakeAudioStream = {
      id: 'stream-1',
      getTracks: () => [],
    };

    const remotePeersMedia = {
      2: {
        userId: 2,
        audioStreams: [fakeAudioStream],
      },
    };

    render(
      <RemoteAudioPool
        remotePeersMedia={remotePeersMedia}
        isDeafened={false}
        userVolumes={{ 2: 50 }}
        userLocalMutes={{ 2: false }}
      />
    );

    const audioEl = screen.getByTestId('remote-audio-2-0');
    expect(audioEl).toBeInTheDocument();
    expect(audioEl.volume).toBe(0.5);
    expect(audioEl.muted).toBe(false);
  });
});
