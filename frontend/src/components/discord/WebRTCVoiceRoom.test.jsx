import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import VoiceChannelArea from './VoiceChannelArea';
import { ToastProvider } from '../../context/ToastContext';

describe('WebRTC Real-Time Voice, Camera & Screen Share Transmission', () => {
  const mockChannel = { id: 42, name: 'geral', type: 'VOICE' };
  const currentUser = { id: 1, name: 'Aryaraj' };
  const remoteFriend = { user_id: 2, user_name: 'Hokage Crypto' };

  let wsInstances = [];
  let pcInstances = [];
  let originalWebSocket;
  let originalRTCPeerConnection;
  let originalMediaStream;
  let originalFetch;

  class MockWebSocket {
    static OPEN = 1;
    constructor(url) {
      this.url = url;
      this.readyState = 1;
      this.sent = [];
      this.onopen = null;
      this.onmessage = null;
      this.onclose = null;
      wsInstances.push(this);
      Promise.resolve().then(() => this.onopen?.());
    }
    send(data) {
      this.sent.push(JSON.parse(data));
    }
    close() {
      this.readyState = 3;
      this.onclose?.();
    }
    emitServerPayload(payload) {
      this.onmessage?.({ data: JSON.stringify(payload) });
    }
  }

  class MockRTCPeerConnection {
    constructor(config) {
      this.config = config;
      this.signalingState = 'stable';
      this.iceConnectionState = 'new';
      this.localDescription = null;
      this.remoteDescription = null;
      this.senders = [];
      this.addedCandidates = [];
      this.onicecandidate = null;
      this.ontrack = null;
      this.onsignalingstatechange = null;
      this.oniceconnectionstatechange = null;
      this.closed = false;
      pcInstances.push(this);
    }
    getSenders() {
      return this.senders;
    }
    addTrack(track, stream) {
      const sender = { track, stream };
      this.senders.push(sender);
      return sender;
    }
    removeTrack(sender) {
      this.senders = this.senders.filter((s) => s !== sender);
    }
    async createOffer() {
      return { type: 'offer', sdp: 'mock-local-offer-sdp' };
    }
    async createAnswer() {
      return { type: 'answer', sdp: 'mock-local-answer-sdp' };
    }
    async setLocalDescription(desc) {
      this.localDescription = desc;
      if (desc?.type === 'offer') this.signalingState = 'have-local-offer';
      if (desc?.type === 'answer' || desc?.type === 'rollback') this.signalingState = 'stable';
      this.onsignalingstatechange?.();
    }
    async setRemoteDescription(desc) {
      this.remoteDescription = desc;
      this.signalingState = desc?.type === 'offer' ? 'have-remote-offer' : 'stable';
      this.onsignalingstatechange?.();
    }
    async addIceCandidate(cand) {
      this.addedCandidates.push(cand);
    }
    close() {
      this.closed = true;
    }
  }

  class MockMediaStream {
    constructor(tracks = [], id = `stream-${Math.random().toString(36).slice(2, 8)}`) {
      this.id = id;
      this._tracks = tracks;
    }
    getTracks() {
      return this._tracks;
    }
    getAudioTracks() {
      return this._tracks.filter((t) => t.kind === 'audio');
    }
    getVideoTracks() {
      return this._tracks.filter((t) => t.kind === 'video');
    }
  }

  beforeEach(() => {
    wsInstances = [];
    pcInstances = [];
    originalWebSocket = globalThis.WebSocket;
    originalRTCPeerConnection = globalThis.RTCPeerConnection;
    originalMediaStream = globalThis.MediaStream;
    originalFetch = globalThis.fetch;

    globalThis.WebSocket = MockWebSocket;
    globalThis.RTCPeerConnection = MockRTCPeerConnection;
    globalThis.MediaStream = MockMediaStream;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ token: 'lk-jwt', url: 'ws://localhost:7880' }),
    });

    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue(
          new MockMediaStream([{ id: 'local-mic-1', kind: 'audio', enabled: true, stop: vi.fn() }], 'local-mic-stream')
        ),
        getDisplayMedia: vi.fn(),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    globalThis.RTCPeerConnection = originalRTCPeerConnection;
    globalThis.MediaStream = originalMediaStream;
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  const renderVoiceRoom = (extraProps = {}) =>
    render(
      <ToastProvider>
        <VoiceChannelArea
          channel={mockChannel}
          connectionStatus="connected"
          currentUser={currentUser}
          onlineUsers={[currentUser]}
          token="jwt-test-token"
          {...extraProps}
        />
      </ToastProvider>
    );

  it('estabelece negociação WebRTC (peer-join, sdp-offer, sdp-answer, ice-candidate) ao entrar um amigo', async () => {
    renderVoiceRoom();

    await act(async () => {
      await Promise.resolve();
    });

    expect(wsInstances.length).toBe(1);
    const ws = wsInstances[0];
    expect(ws.sent.some((m) => m.event === 'voice:signal' && m.signal?.type === 'peer-join')).toBe(true);

    // Amigo (ID 2) entra na sala e envia peer-join
    await act(async () => {
      ws.emitServerPayload({
        event: 'voice:signal',
        sender_id: 2,
        sender_name: 'Hokage Crypto',
        target_user_id: null,
        signal: {
          type: 'peer-join',
          user_id: 2,
          user_name: 'Hokage Crypto',
          mediaState: { isCameraOn: false, isScreenSharing: false },
        },
      });
    });

    // Como currentUser.id (1) < sender_id (2), deve responder peer-ready e iniciar sdp-offer
    expect(pcInstances.length).toBe(1);
    expect(ws.sent.some((m) => m.target_user_id === 2 && m.signal?.type === 'peer-ready')).toBe(true);
    expect(ws.sent.some((m) => m.target_user_id === 2 && m.signal?.type === 'sdp-offer')).toBe(true);

    // Amigo responde com sdp-answer e ice-candidate
    await act(async () => {
      ws.emitServerPayload({
        event: 'voice:signal',
        sender_id: 2,
        sender_name: 'Hokage Crypto',
        target_user_id: 1,
        signal: {
          type: 'sdp-answer',
          sdp: { type: 'answer', sdp: 'remote-answer-sdp' },
        },
      });
      ws.emitServerPayload({
        event: 'voice:signal',
        sender_id: 2,
        sender_name: 'Hokage Crypto',
        target_user_id: 1,
        signal: {
          type: 'ice-candidate',
          candidate: { candidate: 'candidate:1 1 UDP 2122252543 192.168.1.10 50000 typ host' },
        },
      });
    });

    expect(pcInstances[0].remoteDescription).toEqual({ type: 'answer', sdp: 'remote-answer-sdp' });
    expect(pcInstances[0].addedCandidates.length).toBe(1);
    expect(screen.getByTestId('voice-user-tile-2')).toBeInTheDocument();
  });

  it('reproduz áudio de voz remoto no RemoteAudioPool, silencia ao clicar em Ensurdecer e mantém áudio ativo em PiP', async () => {
    const { rerender } = renderVoiceRoom();
    await act(async () => {
      await Promise.resolve();
    });

    const ws = wsInstances[0];
    await act(async () => {
      ws.emitServerPayload({
        event: 'voice:signal',
        sender_id: remoteFriend.user_id,
        sender_name: remoteFriend.user_name,
        signal: { type: 'peer-join', user_id: remoteFriend.user_id, user_name: remoteFriend.user_name },
      });
    });

    const pc = pcInstances[0];
    const remoteAudioTrack = { id: 'remote-mic-track-2', kind: 'audio', readyState: 'live' };
    const remoteAudioStream = new MockMediaStream([remoteAudioTrack], 'remote-mic-stream-2');

    await act(async () => {
      pc.ontrack?.({ track: remoteAudioTrack, streams: [remoteAudioStream] });
    });

    const audioEl = await screen.findByTestId('remote-audio-2-0');
    expect(audioEl).toBeInTheDocument();
    expect(audioEl.srcObject).toBe(remoteAudioStream);
    expect(audioEl.muted).toBe(false);

    // Clicar em Ensurdecer (Deafen) deve silenciar o áudio remoto recebido
    fireEvent.click(screen.getByTestId('voice-toggle-deafen-btn'));
    expect(audioEl.muted).toBe(true);

    // Restaurar áudio
    fireEvent.click(screen.getByTestId('voice-toggle-deafen-btn'));
    expect(audioEl.muted).toBe(false);

    // Minimizar para modo PiP (navegando em canal de texto): o elemento <audio> remoto continua montado!
    rerender(
      <ToastProvider>
        <VoiceChannelArea
          channel={mockChannel}
          connectionStatus="connected"
          currentUser={currentUser}
          onlineUsers={[currentUser]}
          token="jwt-test-token"
          isMinimized={true}
        />
      </ToastProvider>
    );

    expect(screen.getByTestId('voice-pip-container')).toBeInTheDocument();
    expect(screen.getByTestId('remote-audio-2-0')).toBeInTheDocument();
  });

  it('exibe câmera remota no cartão do amigo e compartilhamento de tela remoto no palco ao vivo', async () => {
    renderVoiceRoom();
    await act(async () => {
      await Promise.resolve();
    });

    const ws = wsInstances[0];

    // Amigo envia oferta com câmera ligada e compartilhamento de tela ativo simultaneamente
    await act(async () => {
      ws.emitServerPayload({
        event: 'voice:signal',
        sender_id: 2,
        sender_name: 'Hokage Crypto',
        target_user_id: 1,
        signal: {
          type: 'sdp-offer',
          sdp: { type: 'offer', sdp: 'remote-offer-with-cam-and-screen' },
          user_id: 2,
          user_name: 'Hokage Crypto',
          mediaState: {
            isCameraOn: true,
            isScreenSharing: true,
            cameraStreamId: 'friend-cam-stream',
            screenStreamId: 'friend-screen-stream',
          },
        },
      });
    });

    const pc = pcInstances[0];
    const camTrack = { id: 'cam-v-2', kind: 'video', readyState: 'live' };
    const screenTrack = { id: 'scr-v-2', kind: 'video', readyState: 'live' };
    const camStream = new MockMediaStream([camTrack], 'friend-cam-stream');
    const screenStream = new MockMediaStream([screenTrack], 'friend-screen-stream');

    await act(async () => {
      pc.ontrack?.({ track: camTrack, streams: [camStream] });
      pc.ontrack?.({ track: screenTrack, streams: [screenStream] });
    });

    // Verifica câmera remota dentro do card do participante 2
    const remoteCamVideo = await screen.findByTestId('remote-camera-video-2');
    expect(remoteCamVideo).toBeInTheDocument();
    expect(remoteCamVideo.srcObject).toBe(camStream);

    // Conforme regra do Discord (on-demand), clica em "Assistir Transmissão" para assistir a tela
    const watchBtn = await screen.findByTestId('watch-stream-btn-2');
    expect(watchBtn).toBeInTheDocument();
    await act(async () => {
      watchBtn.click();
    });

    // Verifica compartilhamento de tela remoto no palco principal
    const remoteScreenBox = await screen.findByTestId('remote-screen-share-2');
    expect(remoteScreenBox).toBeInTheDocument();
    expect(screen.getByText(/Transmissão ao vivo de Hokage Crypto/i)).toBeInTheDocument();

    const remoteScreenVideo = screen.getByTestId('remote-screen-video-2');
    expect(remoteScreenVideo.srcObject).toBe(screenStream);

    // Quando o amigo encerra o compartilhamento de tela (media-state: isScreenSharing = false), remove do palco
    await act(async () => {
      ws.emitServerPayload({
        event: 'voice:signal',
        sender_id: 2,
        sender_name: 'Hokage Crypto',
        signal: {
          type: 'media-state',
          mediaState: {
            isCameraOn: true,
            isScreenSharing: false,
            cameraStreamId: 'friend-cam-stream',
            screenStreamId: null,
          },
        },
      });
    });

    expect(screen.queryByTestId('remote-screen-share-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('remote-camera-video-2')).toBeInTheDocument();
  });
});
