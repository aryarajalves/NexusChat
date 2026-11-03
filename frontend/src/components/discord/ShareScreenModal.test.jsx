import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ShareScreenModal from './ShareScreenModal';

describe('ShareScreenModal Component', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onConfirmShare: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(<ShareScreenModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title, audio toggle switch, and action buttons when open', () => {
    render(<ShareScreenModal {...defaultProps} />);

    expect(screen.getByText('Compartilhar Tela')).toBeInTheDocument();
    expect(screen.getByText('Capturar som do computador')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-capture-pc-audio-checkbox')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-share-screen-btn')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-share-screen-btn')).toBeInTheDocument();
  });

  it('toggles audio capture option and persists to localStorage', () => {
    render(<ShareScreenModal {...defaultProps} />);

    const checkbox = screen.getByTestId('toggle-capture-pc-audio-checkbox');
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(localStorage.getItem('discord_capture_pc_audio')).toBe('true');

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
    expect(localStorage.getItem('discord_capture_pc_audio')).toBe('false');
  });

  it('calls onConfirmShare with captureAudio status and closes modal', async () => {
    const onConfirmShare = vi.fn().mockResolvedValue();
    const onClose = vi.fn();

    render(
      <ShareScreenModal
        isOpen={true}
        onClose={onClose}
        onConfirmShare={onConfirmShare}
      />
    );

    const checkbox = screen.getByTestId('toggle-capture-pc-audio-checkbox');
    fireEvent.click(checkbox);

    const confirmBtn = screen.getByTestId('confirm-share-screen-btn');
    fireEvent.click(confirmBtn);

    expect(onConfirmShare).toHaveBeenCalledWith({ captureAudio: true });
  });

  it('calls onClose when clicking Cancel button conforming to UX 1-close-button rule', () => {
    const onClose = vi.fn();
    render(<ShareScreenModal {...defaultProps} onClose={onClose} />);

    const cancelBtn = screen.getByTestId('cancel-share-screen-btn');
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
