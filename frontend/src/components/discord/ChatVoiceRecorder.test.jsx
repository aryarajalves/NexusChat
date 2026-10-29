import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastProvider } from '../../context/ToastContext';
import ChatVoiceRecorder from './ChatVoiceRecorder';

describe('ChatVoiceRecorder Component', () => {
  let mockStream;
  let mockMediaRecorderInstance;

  beforeEach(() => {
    vi.useFakeTimers();

    const mockTrack = { stop: vi.fn() };
    mockStream = {
      getTracks: vi.fn().mockReturnValue([mockTrack]),
    };

    class MockMediaRecorder {
      constructor(stream, options) {
        this.stream = stream;
        this.options = options;
        this.state = 'recording';
        this.mimeType = 'audio/webm;codecs=opus';
        this.ondataavailable = null;
        this.onstop = null;
        mockMediaRecorderInstance = this;
      }
      start = vi.fn();
      stop = vi.fn(() => {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      });
    }

    global.MediaRecorder = MockMediaRecorder;
    global.MediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true);

    navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const renderWithToast = (ui) => render(<ToastProvider>{ui}</ToastProvider>);

  const setupRecorder = async (props = {}) => {
    const rendered = renderWithToast(<ChatVoiceRecorder onCancel={vi.fn()} onFinish={vi.fn()} {...props} />);
    await act(async () => {
      await Promise.resolve();
    });
    return rendered;
  };

  it('renders recording UI with pulsing dot, label and timer 00:00', async () => {
    await setupRecorder();

    expect(screen.getByTestId('chat-voice-recorder-bar')).toBeInTheDocument();
    expect(screen.getByTestId('voice-recording-dot')).toBeInTheDocument();
    expect(screen.getByText('Gravando áudio...')).toBeInTheDocument();
    expect(screen.getByTestId('voice-recording-timer')).toHaveTextContent('00:00');
  });

  it('increments recording timer as seconds elapse', async () => {
    await setupRecorder();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByTestId('voice-recording-timer')).toHaveTextContent('00:03');

    act(() => {
      vi.advanceTimersByTime(62000);
    });

    expect(screen.getByTestId('voice-recording-timer')).toHaveTextContent('01:05');
  });

  it('cancels recording and stops stream when cancel button is clicked', async () => {
    const onCancelMock = vi.fn();
    await setupRecorder({ onCancel: onCancelMock });

    const cancelBtn = screen.getByTestId('cancel-voice-recording-btn');
    fireEvent.click(cancelBtn);

    expect(onCancelMock).toHaveBeenCalledTimes(1);
    expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();
  });

  it('finishes recording, stops stream, and calls onFinish with audio file', async () => {
    const onFinishMock = vi.fn();
    await setupRecorder({ onFinish: onFinishMock });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Simula chunk de áudio gerado
    if (mockMediaRecorderInstance && mockMediaRecorderInstance.ondataavailable) {
      mockMediaRecorderInstance.ondataavailable({ data: new Blob(['fake-audio-bytes'], { type: 'audio/webm' }) });
    }

    const sendBtn = screen.getByTestId('send-voice-recording-btn');
    fireEvent.click(sendBtn);

    expect(mockMediaRecorderInstance.stop).toHaveBeenCalled();
    expect(onFinishMock).toHaveBeenCalled();
    const passedFile = onFinishMock.mock.calls[0][0];
    expect(passedFile).toBeInstanceOf(File);
    expect(passedFile.name).toMatch(/^audio_\d+\.webm$/);
  });

  it('handles microphone access error gracefully and calls onCancel', async () => {
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(new Error('Permission denied'));
    const onCancelMock = vi.fn();

    renderWithToast(<ChatVoiceRecorder onCancel={onCancelMock} onFinish={vi.fn()} />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(onCancelMock).toHaveBeenCalled();
  });
});
