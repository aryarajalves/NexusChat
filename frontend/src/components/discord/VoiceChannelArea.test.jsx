import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import VoiceChannelArea from './VoiceChannelArea';
import { ToastProvider } from '../../context/ToastContext';

describe('VoiceChannelArea Component', () => {
  const mockChannel = { id: 2, name: 'geral', type: 'VOICE' };
  const mockUser = { id: 1, name: 'Super Admin' };
  const mockOnlineUsers = [
    { user_id: 1, user_name: 'Super Admin' },
    { user_id: 2, user_name: 'Bob' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithToast = (ui) => {
    return render(<ToastProvider>{ui}</ToastProvider>);
  };

  it('renders voice channel header, status pill and participant tiles', () => {
    renderWithToast(
      <VoiceChannelArea
        channel={mockChannel}
        connectionStatus="connected"
        currentUser={mockUser}
        onlineUsers={mockOnlineUsers}
      />
    );

    expect(screen.getByText('geral')).toBeInTheDocument();
    expect(screen.getByText('Canal de Voz & Transmissão')).toBeInTheDocument();
    expect(screen.getByTestId('voice-connection-status-pill')).toHaveTextContent('Voz Conectada (RTC)');

    expect(screen.getByTestId('voice-user-tile-1')).toBeInTheDocument();
    expect(screen.getByTestId('voice-user-tile-2')).toBeInTheDocument();
    expect(screen.getByText(/Super Admin/i)).toBeInTheDocument();
    expect(screen.getByText(/Bob/i)).toBeInTheDocument();
  });

  it('toggles microphone mute state when mute button is clicked', () => {
    const handleVoiceState = vi.fn();
    renderWithToast(
      <VoiceChannelArea
        channel={mockChannel}
        currentUser={mockUser}
        onlineUsers={mockOnlineUsers}
        onSendVoiceState={handleVoiceState}
      />
    );

    const muteBtn = screen.getByTestId('voice-toggle-mute-btn');
    expect(muteBtn).toHaveAttribute('title', 'Desativar Microfone');

    fireEvent.click(muteBtn);
    expect(handleVoiceState).toHaveBeenCalledWith(
      expect.objectContaining({ is_muted: true, is_speaking: false })
    );
    expect(muteBtn).toHaveAttribute('title', 'Ativar Microfone');
  });

  it('toggles deafen state when deafen button is clicked', () => {
    const handleVoiceState = vi.fn();
    renderWithToast(
      <VoiceChannelArea
        channel={mockChannel}
        currentUser={mockUser}
        onlineUsers={mockOnlineUsers}
        onSendVoiceState={handleVoiceState}
      />
    );

    const deafenBtn = screen.getByTestId('voice-toggle-deafen-btn');
    fireEvent.click(deafenBtn);

    expect(handleVoiceState).toHaveBeenCalledWith(
      expect.objectContaining({ is_deafened: true, is_muted: true })
    );
  });

  it('calls onDisconnectVoice when disconnect button is clicked', () => {
    const handleDisconnect = vi.fn();
    renderWithToast(
      <VoiceChannelArea
        channel={mockChannel}
        currentUser={mockUser}
        onlineUsers={mockOnlineUsers}
        onDisconnectVoice={handleDisconnect}
      />
    );

    const disconnectBtn = screen.getByTestId('voice-disconnect-btn');
    fireEvent.click(disconnectBtn);

    expect(handleDisconnect).toHaveBeenCalledTimes(1);
  });

  it('starts screen sharing, attaches MediaStream to video element, and stops on toggle', async () => {
    const mockTrack = { stop: vi.fn(), onended: null };
    const mockStream = {
      getVideoTracks: vi.fn().mockReturnValue([mockTrack]),
      getTracks: vi.fn().mockReturnValue([mockTrack]),
    };

    const originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        ...originalMediaDevices,
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
        getDisplayMedia: vi.fn().mockResolvedValue(mockStream),
      },
      configurable: true,
    });

    renderWithToast(
      <VoiceChannelArea
        channel={mockChannel}
        currentUser={mockUser}
        onlineUsers={mockOnlineUsers}
      />
    );

    const screenBtn = screen.getByTestId('voice-toggle-screen-btn');
    expect(screenBtn).toHaveAttribute('title', 'Compartilhar Tela');

    // Clica para iniciar o compartilhamento
    await act(async () => {
      fireEvent.click(screenBtn);
    });

    // Janela de vídeo e prévia da transmissão devem ser montados
    const preview = await screen.findByTestId('screen-share-preview');
    expect(preview).toBeInTheDocument();
    expect(preview).toHaveClass('voice-screen-share-box');
    expect(screen.getByText(/Transmissão ao vivo de Super Admin/i)).toBeInTheDocument();

    const videoEl = screen.getByTestId('screen-share-video');
    expect(videoEl).toBeInTheDocument();
    expect(videoEl).toHaveClass('voice-screen-video');
    expect(videoEl.srcObject).toBe(mockStream);
    expect(screenBtn).toHaveAttribute('title', 'Parar Transmissão');

    // Clica novamente para encerrar
    await act(async () => {
      fireEvent.click(screenBtn);
    });
    expect(mockTrack.stop).toHaveBeenCalled();
    expect(screen.queryByTestId('screen-share-preview')).not.toBeInTheDocument();
  });

  it('toggles camera on and off, attaches camera MediaStream to video element', async () => {
    const mockCamTrack = { stop: vi.fn(), onended: null };
    const mockCamStream = {
      getVideoTracks: vi.fn().mockReturnValue([mockCamTrack]),
      getTracks: vi.fn().mockReturnValue([mockCamTrack]),
    };

    const originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        ...originalMediaDevices,
        getUserMedia: vi.fn((constraints) => {
          if (constraints?.video) {
            return Promise.resolve(mockCamStream);
          }
          return Promise.resolve({ getTracks: () => [] });
        }),
      },
      configurable: true,
    });

    renderWithToast(
      <VoiceChannelArea
        channel={mockChannel}
        currentUser={mockUser}
        onlineUsers={mockOnlineUsers}
      />
    );

    const cameraBtn = screen.getByTestId('voice-toggle-camera-btn');
    expect(cameraBtn).toHaveAttribute('title', 'Ligar Câmera');

    // Liga a câmera
    await act(async () => {
      fireEvent.click(cameraBtn);
    });

    const camPreview = await screen.findByTestId('user-camera-preview');
    expect(camPreview).toBeInTheDocument();

    const camVideo = screen.getByTestId('user-camera-video');
    expect(camVideo).toBeInTheDocument();
    expect(camVideo.srcObject).toBe(mockCamStream);
    expect(cameraBtn).toHaveAttribute('title', 'Desligar Câmera');

    // Desliga a câmera
    await act(async () => {
      fireEvent.click(cameraBtn);
    });
    expect(mockCamTrack.stop).toHaveBeenCalled();
    expect(screen.queryByTestId('user-camera-preview')).not.toBeInTheDocument();
  });

  it('renders in Picture-in-Picture mode when isMinimized is true and allows returning to full voice room', () => {
    const handleReturn = vi.fn();
    const handleDisconnect = vi.fn();

    renderWithToast(
      <VoiceChannelArea
        channel={mockChannel}
        currentUser={mockUser}
        onlineUsers={mockOnlineUsers}
        isMinimized={true}
        onReturnToVoice={handleReturn}
        onDisconnectVoice={handleDisconnect}
      />
    );

    expect(screen.getByTestId('voice-pip-container')).toBeInTheDocument();
    expect(screen.getByText('#geral')).toBeInTheDocument();

    // Botão de expandir
    const expandBtn = screen.getByTestId('voice-pip-expand-btn');
    fireEvent.click(expandBtn);
    expect(handleReturn).toHaveBeenCalledTimes(1);

    // Botão de desconectar no PiP
    const disconnectBtn = screen.getByTestId('voice-pip-disconnect-btn');
    fireEvent.click(disconnectBtn);
    expect(handleDisconnect).toHaveBeenCalledTimes(1);
  });
});
