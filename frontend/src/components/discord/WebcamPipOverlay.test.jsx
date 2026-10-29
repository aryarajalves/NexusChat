import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WebcamPipOverlay from './WebcamPipOverlay';
import { PIP_CORNERS } from './videoCompositeUtils';

describe('WebcamPipOverlay Component', () => {
  let mockCameraStream;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockCameraStream = {
      getVideoTracks: () => [{ id: 'mock-cam-track' }],
    };
  });

  it('renders webcam overlay with user name and video preview', () => {
    render(
      <WebcamPipOverlay
        cameraStream={mockCameraStream}
        pipPosition={{ corner: PIP_CORNERS.BOTTOM_RIGHT }}
        userName="Super Admin"
        isRecording={true}
      />
    );

    expect(screen.getByTestId('webcam-pip-overlay')).toBeInTheDocument();
    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByTestId('webcam-pip-rec-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('webcam-pip-video-preview')).toBeInTheDocument();
  });

  it('allows clicking quick corner buttons to change position', () => {
    const onPositionChange = vi.fn();

    render(
      <WebcamPipOverlay
        cameraStream={mockCameraStream}
        pipPosition={{ corner: PIP_CORNERS.BOTTOM_RIGHT }}
        onPositionChange={onPositionChange}
      />
    );

    // Click Top Left
    fireEvent.click(screen.getByTestId('corner-top-left-btn'));
    expect(onPositionChange).toHaveBeenCalledWith({
      corner: PIP_CORNERS.TOP_LEFT,
      customCoords: null,
    });

    // Click Top Right
    fireEvent.click(screen.getByTestId('corner-top-right-btn'));
    expect(onPositionChange).toHaveBeenCalledWith({
      corner: PIP_CORNERS.TOP_RIGHT,
      customCoords: null,
    });

    // Click Bottom Left
    fireEvent.click(screen.getByTestId('corner-bottom-left-btn'));
    expect(onPositionChange).toHaveBeenCalledWith({
      corner: PIP_CORNERS.BOTTOM_LEFT,
      customCoords: null,
    });

    // Click Bottom Right
    fireEvent.click(screen.getByTestId('corner-bottom-right-btn'));
    expect(onPositionChange).toHaveBeenCalledWith({
      corner: PIP_CORNERS.BOTTOM_RIGHT,
      customCoords: null,
    });
  });

  it('applies custom inline coordinates when dragging', () => {
    const { container } = render(
      <WebcamPipOverlay
        cameraStream={mockCameraStream}
        pipPosition={{
          corner: PIP_CORNERS.CUSTOM,
          customCoords: { x: 350, y: 420 },
        }}
      />
    );

    const overlay = screen.getByTestId('webcam-pip-overlay');
    expect(overlay.style.left).toBe('350px');
    expect(overlay.style.top).toBe('420px');
  });

  it('initiates drag and updates custom position on pointer move', () => {
    const onPositionChange = vi.fn();

    render(
      <WebcamPipOverlay
        cameraStream={mockCameraStream}
        pipPosition={{ corner: PIP_CORNERS.BOTTOM_RIGHT }}
        onPositionChange={onPositionChange}
      />
    );

    const overlay = screen.getByTestId('webcam-pip-overlay');
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      top: 100,
      width: 270,
      height: 195,
      right: 370,
      bottom: 295,
    });

    // Trigger pointer down on overlay
    fireEvent.pointerDown(overlay, { clientX: 120, clientY: 110 });

    // Move pointer
    fireEvent(
      window,
      new MouseEvent('pointermove', {
        clientX: 300,
        clientY: 250,
      })
    );

    expect(onPositionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        corner: PIP_CORNERS.CUSTOM,
        customCoords: expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
        }),
      })
    );

    // Release pointer
    fireEvent(window, new MouseEvent('pointerup'));
  });
});
