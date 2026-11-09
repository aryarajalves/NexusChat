import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DocumentPipAnnotationWindow from './DocumentPipAnnotationWindow';
import { ToastProvider } from '../../context/ToastContext';

describe('Document Picture-in-Picture (Always-on-Top Annotation Window)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      isOpen: true,
      onClose: vi.fn(),
      channel: { id: 10, name: 'Sala de Voz' },
      currentUser: { id: 1, name: 'Super Admin' },
      stream: { getVideoTracks: () => [{ id: 'mock-track' }] },
      isPresenter: true,
      isCollaborative: false,
      onToggleCollaborative: vi.fn(),
      onSendDraw: vi.fn(),
      incomingDrawEvent: null,
      onRegisterAnnotationCanvas: vi.fn(),
      isMuted: false,
      onToggleMute: vi.fn(),
      isDeafened: false,
      onToggleDeafen: vi.fn(),
      onDisconnectVoice: vi.fn(),
      ...props,
    };

    return {
      ...render(
        <ToastProvider>
          <DocumentPipAnnotationWindow {...defaultProps} />
        </ToastProvider>
      ),
      props: defaultProps,
    };
  };

  it('renders nothing when isOpen is false', () => {
    renderComponent({ isOpen: false });
    expect(screen.queryByTestId('document-pip-wrapper')).not.toBeInTheDocument();
  });

  it('renders header with channel name, always-on-top live badge, and close button', () => {
    const { props } = renderComponent();

    expect(screen.getByTestId('document-pip-header')).toBeInTheDocument();
    expect(screen.getByText('#Sala de Voz')).toBeInTheDocument();
    expect(screen.getAllByText(/Always-on-Top/i).length).toBeGreaterThanOrEqual(1);

    const closeBtn = screen.getByTestId('close-document-pip-btn');
    expect(closeBtn).toBeInTheDocument();

    fireEvent.click(closeBtn);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('renders video element and ScreenAnnotationOverlay inside the content area', () => {
    renderComponent();

    expect(screen.getByTestId('document-pip-content')).toBeInTheDocument();
    expect(screen.getByTestId('document-pip-video')).toBeInTheDocument();
    expect(screen.getByTestId('screen-annotation-container')).toBeInTheDocument();
    expect(screen.getByTestId('screen-annotation-canvas')).toBeInTheDocument();
  });

  it('renders quick call controls (Mute, Deafen, Disconnect) and triggers their actions', () => {
    const onToggleMute = vi.fn();
    const onToggleDeafen = vi.fn();
    const onDisconnectVoice = vi.fn();

    renderComponent({ onToggleMute, onToggleDeafen, onDisconnectVoice, isMuted: true });

    const muteBtn = screen.getByTestId('pip-toggle-mute-btn');
    expect(muteBtn).toHaveClass('btn-active-red');
    fireEvent.click(muteBtn);
    expect(onToggleMute).toHaveBeenCalledTimes(1);

    const deafenBtn = screen.getByTestId('pip-toggle-deafen-btn');
    fireEvent.click(deafenBtn);
    expect(onToggleDeafen).toHaveBeenCalledTimes(1);

    const disconnectBtn = screen.getByTestId('pip-disconnect-btn');
    fireEvent.click(disconnectBtn);
    expect(onDisconnectVoice).toHaveBeenCalledTimes(1);
  });
});
