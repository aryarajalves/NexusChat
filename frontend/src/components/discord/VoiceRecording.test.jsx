import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import VoiceRecordingModal from './VoiceRecordingModal';
import VoiceChannelRecorder from './VoiceChannelRecorder';
import VoiceChannelArea from './VoiceChannelArea';
import { ToastProvider } from '../../context/ToastContext';

describe('Voice Channel Recording & Export Feature', () => {
  const mockChannel = { id: 1, name: 'geral', type: 'VOICE' };
  const mockCurrentUser = { id: 1, name: 'Arya Stark', email: 'arya@example.com' };

  let lastRecorderInstance = null;

  beforeEach(() => {
    vi.restoreAllMocks();
    lastRecorderInstance = null;

    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test-recording-url');
    global.URL.revokeObjectURL = vi.fn();

    // Mock MediaRecorder using class constructor
    class MockMediaRecorder {
      constructor(stream, options) {
        this.stream = stream;
        this.options = options;
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onstop = null;
        lastRecorderInstance = this;
      }
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }
    }

    global.MediaRecorder = MockMediaRecorder;

    // Mock navigator.mediaDevices
    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {};
    }

    navigator.mediaDevices.getUserMedia = vi.fn().mockResolvedValue({
      getAudioTracks: () => [{ id: 'audio-track-1', stop: vi.fn() }],
      getVideoTracks: () => [],
      getTracks: () => [{ stop: vi.fn() }],
      addTrack: vi.fn(),
    });

    navigator.mediaDevices.getDisplayMedia = vi.fn().mockResolvedValue({
      getAudioTracks: () => [{ id: 'display-audio-1', stop: vi.fn() }],
      getVideoTracks: () => [{ id: 'display-video-1', onended: null, stop: vi.fn() }],
      getTracks: () => [{ stop: vi.fn() }],
      addTrack: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('VoiceRecordingModal Component', () => {
    it('renders audio recording preview and metadata correctly', () => {
      const onClose = vi.fn();
      const onExport = vi.fn();
      const mockBlob = new Blob(['dummy audio content'], { type: 'audio/webm' });

      render(
        <VoiceRecordingModal
          isOpen={true}
          onClose={onClose}
          channelName="geral"
          recordType="audio"
          recordedUrl="blob:http://localhost/test-audio"
          recordedBlob={mockBlob}
          durationSeconds={125} // 02:05
          onExport={onExport}
        />
      );

      expect(screen.getByTestId('voice-recording-modal')).toBeInTheDocument();
      expect(screen.getByText('Gravação Concluída')).toBeInTheDocument();
      expect(screen.getByText(/Canal #geral/)).toBeInTheDocument();
      expect(screen.getByText('02:05')).toBeInTheDocument();
      expect(screen.getByTestId('recorded-audio-preview')).toBeInTheDocument();

      // Export button click
      const exportBtn = screen.getByTestId('export-recording-btn');
      fireEvent.click(exportBtn);
      expect(onExport).toHaveBeenCalledWith(expect.stringContaining('gravacao_geral_audio_'));

      // Discard button click
      const discardBtn = screen.getByTestId('discard-recording-btn');
      fireEvent.click(discardBtn);
      expect(onClose).toHaveBeenCalled();
    });

    it('renders video recording preview when recordType is video', () => {
      const mockBlob = new Blob(['dummy video content'], { type: 'video/webm' });

      render(
        <VoiceRecordingModal
          isOpen={true}
          onClose={vi.fn()}
          channelName="reuniao"
          recordType="video"
          recordedUrl="blob:http://localhost/test-video"
          recordedBlob={mockBlob}
          durationSeconds={45} // 00:45
        />
      );

      expect(screen.getByTestId('recorded-video-preview')).toBeInTheDocument();
      expect(screen.getByText('00:45')).toBeInTheDocument();
      expect(screen.getByText('WebM (VIDEO)')).toBeInTheDocument();
    });
  });

  describe('VoiceChannelRecorder Component', () => {
    it('opens recording menu when clicking record button and starts audio recording', async () => {
      vi.useFakeTimers();

      render(
        <ToastProvider>
          <VoiceChannelRecorder channel={mockChannel} />
        </ToastProvider>
      );

      const recordBtn = screen.getByTestId('voice-record-btn');
      expect(recordBtn).toBeInTheDocument();

      // Open menu
      fireEvent.click(recordBtn);
      expect(screen.getByTestId('voice-recorder-menu')).toBeInTheDocument();

      // Click "Gravar Apenas Áudio"
      const startAudioBtn = screen.getByTestId('start-audio-recording-btn');
      await act(async () => {
        fireEvent.click(startAudioBtn);
      });

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
      expect(screen.getByTestId('voice-recording-active-dock')).toBeInTheDocument();
      expect(screen.getByText(/REC \(ÁUDIO\)/)).toBeInTheDocument();

      // Advance timer by 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByTestId('recording-timer')).toHaveTextContent('00:03');

      // Stop recording
      const stopBtn = screen.getByTestId('stop-recording-btn');
      act(() => {
        fireEvent.click(stopBtn);
      });

      // Verification: modal opens with preview
      expect(screen.getByTestId('voice-recording-modal')).toBeInTheDocument();
      expect(screen.getByText('00:03')).toBeInTheDocument();
    });

    it('starts video recording and exports file to user computer', async () => {
      render(
        <ToastProvider>
          <VoiceChannelRecorder channel={mockChannel} />
        </ToastProvider>
      );

      // Open menu
      fireEvent.click(screen.getByTestId('voice-record-btn'));

      // Start video recording
      const startVideoBtn = screen.getByTestId('start-video-recording-btn');
      await act(async () => {
        fireEvent.click(startVideoBtn);
      });

      expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({
        video: true,
        audio: true,
      });
      expect(screen.getByText(/REC \(VÍDEO\)/)).toBeInTheDocument();

      // Stop recording
      const stopBtn = screen.getByTestId('stop-recording-btn');
      act(() => {
        fireEvent.click(stopBtn);
      });

      expect(screen.getByTestId('voice-recording-modal')).toBeInTheDocument();

      // Export file
      const exportBtn = screen.getByTestId('export-recording-btn');
      fireEvent.click(exportBtn);

      // Modal closes after export
      expect(screen.queryByTestId('voice-recording-modal')).not.toBeInTheDocument();
    });
    it('supports video recording with movable webcam PiP overlay when camera is on', async () => {
      const mockCameraStream = {
        getVideoTracks: () => [{ id: 'cam-v1' }],
        getAudioTracks: () => [],
      };

      render(
        <ToastProvider>
          <VoiceChannelRecorder
            channel={mockChannel}
            cameraStream={mockCameraStream}
            isCameraOn={true}
            currentUserName="Super Admin"
          />
        </ToastProvider>
      );

      // Open menu
      fireEvent.click(screen.getByTestId('voice-record-btn'));

      // Checkbox is present
      const pipCheckbox = screen.getByTestId('include-webcam-checkbox');
      expect(pipCheckbox).toBeInTheDocument();
      expect(pipCheckbox).toBeChecked();

      // Start video recording
      const startVideoBtn = screen.getByTestId('start-video-recording-btn');
      await act(async () => {
        fireEvent.click(startVideoBtn);
      });

      // Webcam overlay is rendered on screen while recording
      expect(screen.getByTestId('webcam-pip-overlay')).toBeInTheDocument();
      expect(screen.getByText('Super Admin')).toBeInTheDocument();

      // Move webcam to top-right
      fireEvent.click(screen.getByTestId('corner-top-right-btn'));
      expect(screen.getByTestId('webcam-pip-overlay')).toHaveClass('corner-top-right');

      // Stop recording
      const stopBtn = screen.getByTestId('stop-recording-btn');
      act(() => {
        fireEvent.click(stopBtn);
      });

      // Overlay unmounts and modal opens
      expect(screen.queryByTestId('webcam-pip-overlay')).not.toBeInTheDocument();
      expect(screen.getByTestId('voice-recording-modal')).toBeInTheDocument();
    });
  });

  describe('VoiceChannelArea Integration', () => {
    it('renders VoiceChannelRecorder inside the voice control dock', () => {
      render(
        <ToastProvider>
          <VoiceChannelArea
            channel={mockChannel}
            currentUser={mockCurrentUser}
            onlineUsers={[mockCurrentUser]}
            onDisconnectVoice={vi.fn()}
          />
        </ToastProvider>
      );

      expect(screen.getByTestId('voice-recorder-controls')).toBeInTheDocument();
      expect(screen.getByTestId('voice-record-btn')).toBeInTheDocument();
    });
  });
});
