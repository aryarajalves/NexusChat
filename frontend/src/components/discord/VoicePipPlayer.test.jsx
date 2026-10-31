import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VoicePipPlayer from './VoicePipPlayer';

describe('VoicePipPlayer Draggable Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const defaultProps = {
    channel: { id: 10, name: 'geral' },
    currentUser: { id: 1, name: 'Super Admin' },
    isMuted: false,
    isSpeaking: false,
    isCameraOn: false,
    isScreenSharing: false,
    onToggleMute: vi.fn(),
    onToggleCamera: vi.fn(),
    onToggleScreenShare: vi.fn(),
    onDisconnectVoice: vi.fn(),
    onReturnToVoice: vi.fn(),
    onSetVideoRef: vi.fn(),
    onSetCameraVideoRef: vi.fn(),
  };

  it('renders PiP floating box with channel name, avatar, and controls', () => {
    render(<VoicePipPlayer {...defaultProps} />);

    expect(screen.getByTestId('voice-pip-container')).toBeInTheDocument();
    expect(screen.getByText('#geral')).toBeInTheDocument();
    expect(screen.getByText('Super Admin conectado')).toBeInTheDocument();

    // Controles
    expect(screen.getByTestId('voice-pip-mute-btn')).toBeInTheDocument();
    expect(screen.getByTestId('voice-pip-camera-btn')).toBeInTheDocument();
    expect(screen.getByTestId('voice-pip-screen-btn')).toBeInTheDocument();
    expect(screen.getByTestId('voice-pip-disconnect-btn')).toBeInTheDocument();
    expect(screen.getByTestId('voice-pip-expand-btn')).toBeInTheDocument();
  });

  it('triggers onReturnToVoice when clicking the expand button or header title', () => {
    const handleReturn = vi.fn();
    render(<VoicePipPlayer {...defaultProps} onReturnToVoice={handleReturn} />);

    fireEvent.click(screen.getByTestId('voice-pip-expand-btn'));
    expect(handleReturn).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('voice-pip-title-btn'));
    expect(handleReturn).toHaveBeenCalledTimes(2);
  });

  it('triggers voice action buttons correctly', () => {
    const handleMute = vi.fn();
    const handleCamera = vi.fn();
    const handleScreen = vi.fn();
    const handleDisconnect = vi.fn();

    render(
      <VoicePipPlayer
        {...defaultProps}
        onToggleMute={handleMute}
        onToggleCamera={handleCamera}
        onToggleScreenShare={handleScreen}
        onDisconnectVoice={handleDisconnect}
      />
    );

    fireEvent.click(screen.getByTestId('voice-pip-mute-btn'));
    expect(handleMute).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('voice-pip-camera-btn'));
    expect(handleCamera).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('voice-pip-screen-btn'));
    expect(handleScreen).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('voice-pip-disconnect-btn'));
    expect(handleDisconnect).toHaveBeenCalled();
  });

  it('supports dragging the PiP container across the screen and updates position style', () => {
    render(<VoicePipPlayer {...defaultProps} />);

    const container = screen.getByTestId('voice-pip-container');
    const dragHandle = screen.getByTestId('voice-pip-drag-handle');

    // Mock getBoundingClientRect
    container.getBoundingClientRect = () => ({
      left: 100,
      top: 200,
      width: 310,
      height: 250,
      right: 410,
      bottom: 450,
    });

    // Inicia o arrasto
    fireEvent.mouseDown(dragHandle, { button: 0, clientX: 150, clientY: 220 });
    expect(container).toHaveClass('is-dragging');

    // Move o mouse
    fireEvent.mouseMove(window, { clientX: 300, clientY: 400 });

    // Finaliza o arrasto
    fireEvent.mouseUp(window);
    expect(container).not.toHaveClass('is-dragging');

    // Verifica que a posição customizada foi aplicada ao estilo inline
    expect(container.style.left).toBe('250px');
    expect(container.style.top).toBe('380px');
  });
});
