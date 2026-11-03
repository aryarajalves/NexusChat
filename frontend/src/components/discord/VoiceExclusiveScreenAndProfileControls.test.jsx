import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChannelSidebar from './ChannelSidebar';
import DMSidebar from './DMSidebar';
import VoiceStageView from './VoiceStageView';
import { createMixedCallAudioStream } from './webrtcMediaUtils';

describe('Voice Exclusive Screen Share, Maximize & Profile Controls', () => {
  it('alterna o botão de maximizar no card de transmissão de tela', () => {
    const dummyStream = { id: 'screen-123', getTracks: () => [] };
    const remotePeersMedia = {
      2: { screenStream: dummyStream, cameraStream: null }
    };
    const participants = [
      { user_id: 1, user_name: 'Aryaraj' },
      { user_id: 2, user_name: 'Hokage' },
    ];

    const { rerender } = render(
      <VoiceStageView
        participants={participants}
        currentUser={{ id: 1, name: 'Aryaraj' }}
        remotePeersMedia={remotePeersMedia}
        activeRemoteScreenPeer={{ peerId: 2, peer: remotePeersMedia[2] }}
        remoteUsersMap={new Map([[2, { user_id: 2, user_name: 'Hokage' }]])}
        isScreenSharing={false}
        screenStream={null}
        isCameraOn={false}
        cameraStream={null}
        onSetVideoRef={vi.fn()}
        onSetCameraVideoRef={vi.fn()}
        voiceStates={{}}
      />
    );

    const maxBtn = screen.getByTestId('voice-screen-maximize-btn');
    expect(maxBtn).toBeInTheDocument();
    expect(maxBtn.getAttribute('title')).toContain('Maximizar');

    fireEvent.click(maxBtn);
    expect(maxBtn.getAttribute('title')).toContain('Restaurar');
    expect(screen.getByTestId('remote-screen-share-2')).toHaveClass('is-maximized');

    fireEvent.click(maxBtn);
    expect(maxBtn.getAttribute('title')).toContain('Maximizar');
    expect(screen.getByTestId('remote-screen-share-2')).not.toHaveClass('is-maximized');
  });

  it('não exibe botão de maximizar para o próprio usuário que está compartilhando tela e ativa layout filmstrip', () => {
    const participants = [
      { user_id: 1, user_name: 'Aryaraj' },
      { user_id: 2, user_name: 'Hokage' },
    ];

    render(
      <VoiceStageView
        participants={participants}
        currentUser={{ id: 1, name: 'Aryaraj' }}
        remotePeersMedia={{}}
        isScreenSharing={true}
        isCameraOn={true}
        onSetVideoRef={vi.fn()}
        onSetCameraVideoRef={vi.fn()}
        voiceStates={{}}
      />
    );

    // O preview local da tela compartilhada é renderizado
    expect(screen.getByTestId('screen-share-preview')).toBeInTheDocument();

    // Proteção Anti-Espelho: Não há botão de maximizar para o próprio transmissor
    expect(screen.queryByTestId('voice-screen-maximize-btn')).not.toBeInTheDocument();

    // Ativa o container com classe has-screen-share e a grade em filmstrip-mode no topo
    expect(screen.getByTestId('voice-stage-container')).toHaveClass('has-screen-share');
    expect(screen.getByTestId('voice-participants-filmstrip')).toBeInTheDocument();
    expect(screen.getByTestId('voice-participants-filmstrip')).toHaveClass('filmstrip-mode');
  });

  it('exibe e aciona os botões de microfone e ensurdecer no rodapé da ChannelSidebar', () => {
    const handleToggleMute = vi.fn();
    const handleToggleDeafen = vi.fn();

    const { rerender } = render(
      <ChannelSidebar
        server={{ id: 1, name: 'Servidor' }}
        channels={[{ id: 10, name: 'geral', type: 'VOICE' }]}
        currentUser={{ id: 1, name: 'Aryaraj' }}
        isVoiceMuted={false}
        onToggleVoiceMute={handleToggleMute}
        isVoiceDeafened={false}
        onToggleVoiceDeafen={handleToggleDeafen}
        voiceStates={{}}
      />
    );

    const micBtn = screen.getByTestId('mic-btn');
    const audioBtn = screen.getByTestId('audio-btn');

    expect(micBtn).not.toHaveClass('muted');
    expect(audioBtn).not.toHaveClass('muted');

    fireEvent.click(micBtn);
    expect(handleToggleMute).toHaveBeenCalled();

    fireEvent.click(audioBtn);
    expect(handleToggleDeafen).toHaveBeenCalled();

    rerender(
      <ChannelSidebar
        server={{ id: 1, name: 'Servidor' }}
        channels={[{ id: 10, name: 'geral', type: 'VOICE' }]}
        currentUser={{ id: 1, name: 'Aryaraj' }}
        isVoiceMuted={true}
        onToggleVoiceMute={handleToggleMute}
        isVoiceDeafened={true}
        onToggleVoiceDeafen={handleToggleDeafen}
        voiceStates={{}}
      />
    );

    expect(screen.getByTestId('mic-btn')).toHaveClass('muted');
    expect(screen.getByTestId('audio-btn')).toHaveClass('muted');
  });

  it('renderiza o ícone de microfone mutado na lista esquerda para contatos mutados', () => {
    const voiceStates = {
      1: { is_muted: true, is_speaking: false },
      2: { is_muted: true, is_speaking: false },
    };
    const voiceChannelUsers = {
      10: [
        { id: 1, name: 'Aryaraj' },
        { id: 2, name: 'Jordão rodrigues' },
      ],
    };

    render(
      <ChannelSidebar
        server={{ id: 1, name: 'Servidor' }}
        channels={[{ id: 10, name: 'geral', type: 'VOICE' }]}
        currentUser={{ id: 1, name: 'Aryaraj' }}
        connectedVoiceChannelId={10}
        voiceChannelUsers={voiceChannelUsers}
        voiceStates={voiceStates}
        isVoiceMuted={true}
      />
    );

    const aryarajItem = screen.getByTestId('voice-user-item-1');
    const jordaoItem = screen.getByTestId('voice-user-item-2');

    expect(aryarajItem).toBeInTheDocument();
    expect(jordaoItem).toBeInTheDocument();

    expect(aryarajItem.querySelector('.voice-user-muted-icon')).toBeInTheDocument();
    expect(jordaoItem.querySelector('.voice-user-muted-icon')).toBeInTheDocument();
  });

  it('funciona com botões de microfone e fone na DMSidebar', () => {
    const handleToggleMute = vi.fn();
    const handleToggleDeafen = vi.fn();

    const { rerender } = render(
      <DMSidebar
        conversations={[]}
        currentUser={{ id: 1, name: 'Aryaraj' }}
        isVoiceMuted={false}
        onToggleVoiceMute={handleToggleMute}
        isVoiceDeafened={false}
        onToggleVoiceDeafen={handleToggleDeafen}
      />
    );

    const micBtn = screen.getByTestId('dm-mic-btn');
    const headBtn = screen.getByTestId('dm-headphones-btn');

    expect(micBtn).not.toHaveClass('muted');
    expect(headBtn).not.toHaveClass('muted');

    fireEvent.click(micBtn);
    expect(handleToggleMute).toHaveBeenCalled();

    fireEvent.click(headBtn);
    expect(handleToggleDeafen).toHaveBeenCalled();

    rerender(
      <DMSidebar
        conversations={[]}
        currentUser={{ id: 1, name: 'Aryaraj' }}
        isVoiceMuted={true}
        onToggleVoiceMute={handleToggleMute}
        isVoiceDeafened={true}
        onToggleVoiceDeafen={handleToggleDeafen}
      />
    );

    expect(screen.getByTestId('dm-mic-btn')).toHaveClass('muted');
    expect(screen.getByTestId('dm-headphones-btn')).toHaveClass('muted');
  });

  it('combina fluxos de áudio de múltiplos participantes em createMixedCallAudioStream', () => {
    const mockTrack = { kind: 'audio', id: 'a1', enabled: true };
    const micStream = {
      getAudioTracks: () => [mockTrack],
      getTracks: () => [mockTrack],
    };
    const remoteStream = {
      getAudioTracks: () => [{ kind: 'audio', id: 'a2', enabled: true }],
      getTracks: () => [{ kind: 'audio', id: 'a2', enabled: true }],
    };
    const remotePeersMedia = {
      2: {
        audioStreams: [remoteStream],
      },
    };

    const destStream = { getTracks: () => [mockTrack], getAudioTracks: () => [mockTrack] };
    const mockAudioContext = {
      createMediaStreamSource: vi.fn(() => ({ connect: vi.fn() })),
      createMediaStreamDestination: vi.fn(() => ({ stream: destStream })),
      destination: {},
    };

    globalThis.AudioContext = class {
      constructor() {
        return mockAudioContext;
      }
    };

    const mixed = createMixedCallAudioStream(micStream, remotePeersMedia);
    expect(mixed).toBe(destStream);
    expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledTimes(2);
  });
});
