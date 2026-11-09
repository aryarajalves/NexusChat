import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChannelSidebar from './ChannelSidebar';
import DMSidebar from './DMSidebar';
import VoiceStageView from './VoiceStageView';
import { createMixedCallAudioStream } from './webrtcMediaUtils';
import { ToastProvider } from '../../context/ToastContext';

describe('Voice Exclusive Screen Share, Maximize & Profile Controls', () => {
  it('exibe botão para assistir transmissão e alterna o botão de maximizar no card de transmissão de tela após entrar', () => {
    const dummyStream = { id: 'screen-123', getTracks: () => [] };
    const remotePeersMedia = {
      2: { screenStream: dummyStream, cameraStream: null }
    };
    const participants = [
      { user_id: 1, user_name: 'Aryaraj' },
      { user_id: 2, user_name: 'Hokage' },
    ];

    render(
      <ToastProvider>
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
      </ToastProvider>
    );

    // Por padrão (estilo Discord), não abre a transmissão automaticamente: exibe o badge AO VIVO e botão "Assistir Transmissão"
    expect(screen.queryByTestId('remote-screen-share-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('voice-live-badge-2')).toBeInTheDocument();
    const watchBtn = screen.getByTestId('watch-stream-btn-2');
    expect(watchBtn).toBeInTheDocument();

    // Clica para entrar e assistir à transmissão de Hokage
    fireEvent.click(watchBtn);
    expect(screen.getByTestId('remote-screen-share-2')).toBeInTheDocument();

    const maxBtn = screen.getByTestId('voice-screen-maximize-btn');
    expect(maxBtn).toBeInTheDocument();
    expect(maxBtn.getAttribute('title')).toContain('Maximizar');

    fireEvent.click(maxBtn);
    expect(maxBtn.getAttribute('title')).toContain('Restaurar');
    expect(screen.getByTestId('remote-screen-share-2')).toHaveClass('is-maximized');

    fireEvent.click(maxBtn);
    expect(maxBtn.getAttribute('title')).toContain('Maximizar');
    expect(screen.getByTestId('remote-screen-share-2')).not.toHaveClass('is-maximized');

    // Sai da transmissão clicando em "Sair da Transmissão" (ou "Parar de Assistir")
    fireEvent.click(screen.getByTestId('close-watched-stream-btn'));
    expect(screen.queryByTestId('remote-screen-share-2')).not.toBeInTheDocument();
  });

  it('permite que múltiplas pessoas compartilhem a tela simultaneamente e alternar entre as transmissões', () => {
    const stream2 = { id: 'screen-2', getTracks: () => [] };
    const stream3 = { id: 'screen-3', getTracks: () => [] };
    const remotePeersMedia = {
      2: { screenStream: stream2, userName: 'Hokage' },
      3: { screenStream: stream3, userName: 'Samuel' },
    };
    const participants = [
      { user_id: 1, user_name: 'Aryaraj' },
      { user_id: 2, user_name: 'Hokage' },
      { user_id: 3, user_name: 'Samuel' },
    ];

    render(
      <ToastProvider>
        <VoiceStageView
          participants={participants}
          currentUser={{ id: 1, name: 'Aryaraj' }}
          remotePeersMedia={remotePeersMedia}
          isScreenSharing={false}
          isCameraOn={false}
          onSetVideoRef={vi.fn()}
          onSetCameraVideoRef={vi.fn()}
          voiceStates={{}}
        />
      </ToastProvider>
    );

    // Ambos os participantes têm badge AO VIVO e botão Assistir Transmissão
    expect(screen.getByTestId('voice-live-badge-2')).toBeInTheDocument();
    expect(screen.getByTestId('voice-live-badge-3')).toBeInTheDocument();

    // Entra na transmissão do Hokage (2)
    fireEvent.click(screen.getByTestId('watch-stream-btn-2'));
    expect(screen.getByTestId('remote-screen-share-2')).toBeInTheDocument();
    expect(screen.queryByTestId('remote-screen-share-3')).not.toBeInTheDocument();

    // Alterna direto para a transmissão do Samuel (3) pela barra filmstrip
    fireEvent.click(screen.getByTestId('watch-stream-btn-3'));
    expect(screen.getByTestId('remote-screen-share-3')).toBeInTheDocument();
    expect(screen.queryByTestId('remote-screen-share-2')).not.toBeInTheDocument();

    // Garante que o botão "Parar de Assistir" fica fora do card de vídeo/avatar (não sobrepõe a câmera)
    const tile3 = screen.getByTestId('voice-user-tile-3');
    const leaveBtn3 = screen.getByTestId('leave-stream-btn-3');
    expect(tile3.contains(leaveBtn3)).toBe(false);

    // Sai da transmissão pelo botão abaixo do card do participante
    fireEvent.click(leaveBtn3);
    expect(screen.queryByTestId('remote-screen-share-3')).not.toBeInTheDocument();
  });

  it('não exibe botão de maximizar para o próprio usuário que está compartilhando tela e permite ocultar/ver a própria prévia', () => {
    const participants = [
      { user_id: 1, user_name: 'Aryaraj' },
      { user_id: 2, user_name: 'Hokage' },
    ];

    render(
      <ToastProvider>
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
      </ToastProvider>
    );

    // Para o próprio transmissor, NÃO exibe botões de "Assistir" ou "Parar de Assistir" abaixo do seu avatar
    expect(screen.queryByTestId('watch-stream-btn-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('leave-stream-btn-1')).not.toBeInTheDocument();

    // A tela compartilhada do apresentador é renderizada com indicação clara de transmissão
    expect(screen.getByTestId('screen-share-preview')).toBeInTheDocument();
    expect(screen.getByText(/Transmissão ao vivo de Aryaraj/i)).toBeInTheDocument();
    expect(screen.getByTestId('stop-own-screen-share-btn')).toBeInTheDocument();

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

  it('aplica a linha verde (speaking e speaking-halo) na barra lateral esquerda quando o próprio usuário ou outro membro está falando', () => {
    const voiceStates = {
      1: { is_muted: false, is_deafened: false, is_speaking: true },
      2: { is_muted: false, is_deafened: false, is_speaking: true },
    };
    const voiceChannelUsers = {
      10: [
        { id: 1, name: 'Aryaraj' },
        { id: 2, name: 'Jordão rodrigues' },
      ],
    };

    const { rerender } = render(
      <ChannelSidebar
        server={{ id: 1, name: 'Servidor' }}
        channels={[{ id: 10, name: 'geral', type: 'VOICE' }]}
        currentUser={{ id: 1, name: 'Aryaraj' }}
        connectedVoiceChannelId={10}
        voiceChannelUsers={voiceChannelUsers}
        voiceStates={voiceStates}
        isVoiceMuted={false}
        isVoiceDeafened={false}
      />
    );

    const aryarajItem = screen.getByTestId('voice-user-item-1');
    const jordaoItem = screen.getByTestId('voice-user-item-2');

    // Tanto o próprio usuário (Aryaraj) quanto o outro membro (Jordão) recebem as classes de speaking
    expect(aryarajItem).toHaveClass('speaking');
    expect(aryarajItem.querySelector('.voice-user-avatar')).toHaveClass('speaking-halo');

    expect(jordaoItem).toHaveClass('speaking');
    expect(jordaoItem.querySelector('.voice-user-avatar')).toHaveClass('speaking-halo');

    // Se o próprio usuário mutar o microfone, o halo verde some imediatamente
    rerender(
      <ChannelSidebar
        server={{ id: 1, name: 'Servidor' }}
        channels={[{ id: 10, name: 'geral', type: 'VOICE' }]}
        currentUser={{ id: 1, name: 'Aryaraj' }}
        connectedVoiceChannelId={10}
        voiceChannelUsers={voiceChannelUsers}
        voiceStates={voiceStates}
        isVoiceMuted={true}
        isVoiceDeafened={false}
      />
    );

    expect(screen.getByTestId('voice-user-item-1')).not.toHaveClass('speaking');
    expect(screen.getByTestId('voice-user-item-1').querySelector('.voice-user-avatar')).not.toHaveClass('speaking-halo');
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

  it('mantém a mesma ordem determinística de participantes por user_id na ChannelSidebar para todos os usuários', () => {
    // Mesmo que a lista venha invertida (2 antes de 1), deve ordenar consistentemente (1 na esquerda/topo, 2 depois)
    const voiceChannelUsers = {
      10: [
        { user_id: 2, user_name: 'Hokage' },
        { user_id: 1, user_name: 'Super Admin' },
      ],
    };

    render(
      <ChannelSidebar
        server={{ id: 1, name: 'Teste' }}
        channels={[{ id: 10, name: 'Sala de Voz', type: 'VOICE' }]}
        currentUser={{ id: 2, name: 'Hokage' }}
        connectedVoiceChannelId={10}
        voiceChannelUsers={voiceChannelUsers}
        voiceStates={{}}
      />
    );

    const listContainer = screen.getByTestId('voice-channel-users-10');
    const items = listContainer.querySelectorAll('.voice-user-item');
    expect(items.length).toBe(2);
    expect(items[0]).toHaveAttribute('data-testid', 'voice-user-item-1');
    expect(items[1]).toHaveAttribute('data-testid', 'voice-user-item-2');
  });

  it('exibe badge AO VIVO e botão Assistir Transmissão para participante remoto transmitindo tela via voiceStates', () => {
    const participants = [
      { user_id: 1, user_name: 'Super Admin' },
      { user_id: 2, user_name: 'Hokage', is_screen_sharing: true },
    ];

    render(
      <ToastProvider>
        <VoiceStageView
          participants={participants}
          currentUser={{ id: 1, name: 'Super Admin' }}
          remotePeersMedia={{}}
          isScreenSharing={false}
          isCameraOn={false}
          onSetVideoRef={vi.fn()}
          onSetCameraVideoRef={vi.fn()}
          voiceStates={{ 2: { is_screen_sharing: true } }}
        />
      </ToastProvider>
    );

    expect(screen.getByTestId('voice-live-badge-2')).toBeInTheDocument();
    expect(screen.getByTestId('watch-stream-btn-2')).toBeInTheDocument();

    // Clica em assistir transmissão do Hokage
    fireEvent.click(screen.getByTestId('watch-stream-btn-2'));
    expect(screen.getByTestId('remote-screen-loading-2')).toBeInTheDocument();
    expect(screen.getByText(/Conectando à transmissão ao vivo de Hokage/i)).toBeInTheDocument();
  });
});
