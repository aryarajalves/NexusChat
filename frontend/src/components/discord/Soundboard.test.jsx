import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SoundboardPopover from './SoundboardPopover';
import ServerSoundboardTab from './ServerSoundboardTab';
import VoiceChannelArea from './VoiceChannelArea';
import { playSoundboardAudio, DEFAULT_SOUNDBOARD_SOUNDS } from './soundboardSynth';
import { ToastProvider } from '../../context/ToastContext';

describe('Soundboard Feature', () => {
  const mockServer = { id: 1, name: 'Servidor Teste', owner_id: 1 };
  const mockUser = { id: 1, name: 'Admin', role: 'superadmin' };
  const mockChannel = { id: 10, name: 'Sala de Voz', type: 'VOICE', server_id: 1 };

  const mockCustomSounds = [
    { id: 1, server_id: 1, name: 'Buzina F1', emoji: '🏎️', audio_url: '/uploads/f1.mp3', volume: 1.0 },
    { id: 2, server_id: 1, name: 'Gato Miando', emoji: '🐱', audio_url: '/uploads/cat.ogg', volume: 0.8 },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem('auth_token', 'test-token');
  });

  const renderWithToast = (ui) => render(<ToastProvider>{ui}</ToastProvider>);

  describe('SoundboardPopover Component', () => {
    it('renders default sounds and server sounds when open', () => {
      const handleTrigger = vi.fn();
      render(
        <SoundboardPopover
          isOpen={true}
          onClose={vi.fn()}
          channelId={10}
          serverId={1}
          serverSounds={mockCustomSounds}
          onTriggerSound={handleTrigger}
        />
      );

      expect(screen.getByText('Soundboard')).toBeInTheDocument();
      expect(screen.getByTestId('soundboard-default-section')).toBeInTheDocument();
      expect(screen.getByTestId('soundboard-server-section')).toBeInTheDocument();
      expect(screen.getByText('Quack')).toBeInTheDocument();
      expect(screen.getByText('Airhorn')).toBeInTheDocument();
      expect(screen.getByText('Buzina F1')).toBeInTheDocument();
      expect(screen.getByText('Gato Miando')).toBeInTheDocument();
    });

    it('filters sounds based on search input query', () => {
      render(
        <SoundboardPopover
          isOpen={true}
          onClose={vi.fn()}
          channelId={10}
          serverId={1}
          serverSounds={mockCustomSounds}
        />
      );

      const searchInput = screen.getByTestId('soundboard-search-input');
      fireEvent.change(searchInput, { target: { value: 'Buzina' } });

      expect(screen.getByText('Buzina F1')).toBeInTheDocument();
      expect(screen.queryByText('Quack')).not.toBeInTheDocument();
      expect(screen.queryByText('Gato Miando')).not.toBeInTheDocument();
    });

    it('triggers sound callback and plays sound when clicking a sound card', () => {
      const handleTrigger = vi.fn();
      render(
        <SoundboardPopover
          isOpen={true}
          onClose={vi.fn()}
          channelId={10}
          serverId={1}
          serverSounds={mockCustomSounds}
          onTriggerSound={handleTrigger}
        />
      );

      const quackBtn = screen.getByTestId('soundboard-play-default-def_quack');
      fireEvent.click(quackBtn);

      expect(handleTrigger).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Quack', emoji: '🦆' }),
        expect.any(Number)
      );
    });

    it('updates volume slider and saves in localStorage', () => {
      render(
        <SoundboardPopover
          isOpen={true}
          onClose={vi.fn()}
          channelId={10}
          serverId={1}
        />
      );

      const volSlider = screen.getByTestId('soundboard-volume-slider');
      fireEvent.change(volSlider, { target: { value: '0.5' } });

      expect(localStorage.getItem('discord_soundboard_volume')).toBe('0.5');
    });

    it('calls onClose when close button is clicked', () => {
      const handleClose = vi.fn();
      render(
        <SoundboardPopover
          isOpen={true}
          onClose={handleClose}
          channelId={10}
          serverId={1}
        />
      );

      const closeBtn = screen.getByTestId('close-soundboard-btn');
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe('ServerSoundboardTab Component', () => {
    it('renders tab with title and loads existing server sounds', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockCustomSounds,
      });

      renderWithToast(<ServerSoundboardTab server={mockServer} currentUser={mockUser} />);

      expect(screen.getByText('Soundboard do Servidor')).toBeInTheDocument();
      expect(screen.getByTestId('upload-sound-form')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Buzina F1')).toBeInTheDocument();
        expect(screen.getByText('Gato Miando')).toBeInTheDocument();
      });
    });

    it('allows selecting audio file and submitting a new custom sound', async () => {
      const newSound = { id: 3, server_id: 1, name: 'Trompete', emoji: '🎺', audio_url: '/uploads/trumpet.mp3', volume: 1.0 };

      global.fetch = vi.fn().mockImplementation((url, opts) => {
        if (opts?.method === 'POST') {
          return Promise.resolve({ ok: true, json: async () => newSound });
        }
        return Promise.resolve({ ok: true, json: async () => mockCustomSounds });
      });

      renderWithToast(<ServerSoundboardTab server={mockServer} currentUser={mockUser} />);

      await waitFor(() => {
        expect(screen.getByText('Buzina F1')).toBeInTheDocument();
      });

      const file = new File(['dummy sound bytes'], 'trumpet.mp3', { type: 'audio/mpeg' });
      const fileInput = screen.getByTestId('sound-file-input');
      fireEvent.change(fileInput, { target: { files: [file] } });

      const nameInput = screen.getByTestId('sound-name-input');
      fireEvent.change(nameInput, { target: { value: 'Trompete' } });

      const emojiInput = screen.getByTestId('sound-emoji-input');
      fireEvent.change(emojiInput, { target: { value: '🎺' } });

      const submitBtn = screen.getByTestId('submit-sound-btn');
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText('Trompete')).toBeInTheDocument();
      });
    });

    it('opens confirmation popup before deleting sound and handles cancellation & confirmation', async () => {
      global.fetch = vi.fn().mockImplementation((url, opts) => {
        if (opts?.method === 'DELETE') {
          return Promise.resolve({ ok: true, json: async () => ({ message: 'Som excluído com sucesso.' }) });
        }
        return Promise.resolve({ ok: true, json: async () => mockCustomSounds });
      });

      renderWithToast(<ServerSoundboardTab server={mockServer} currentUser={mockUser} />);

      await waitFor(() => {
        expect(screen.getByText('Buzina F1')).toBeInTheDocument();
      });

      const deleteBtn = screen.getByTestId('delete-sound-btn-1');
      fireEvent.click(deleteBtn);

      // Valida abertura do popup de deleção centralizado com backdrop
      const backdrop = screen.getByTestId('delete-sound-backdrop');
      expect(backdrop).toBeInTheDocument();
      const modal = screen.getByTestId('delete-sound-modal');
      expect(modal).toHaveTextContent('Buzina F1');

      // Cancela
      const cancelBtn = screen.getByTestId('cancel-delete-sound-btn');
      fireEvent.click(cancelBtn);
      expect(screen.queryByTestId('delete-sound-backdrop')).not.toBeInTheDocument();
      expect(screen.getByText('Buzina F1')).toBeInTheDocument();

      // Confirma deleção
      fireEvent.click(deleteBtn);
      const confirmBtn = screen.getByTestId('confirm-delete-sound-btn');
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.queryByText('Buzina F1')).not.toBeInTheDocument();
      });
    });
  });

  describe('VoiceChannelArea Soundboard Button', () => {
    it('renders Soundboard button in voice channel header and opens popover on click', () => {
      renderWithToast(
        <VoiceChannelArea
          channel={mockChannel}
          currentUser={mockUser}
          token="fake-token"
        />
      );

      const soundboardBtn = screen.getByTestId('open-soundboard-btn');
      expect(soundboardBtn).toBeInTheDocument();

      fireEvent.click(soundboardBtn);
      expect(screen.getByTestId('discord-soundboard-popover')).toBeInTheDocument();
    });
  });

  describe('soundboardSynth Helper', () => {
    it('plays default sound without errors', () => {
      expect(() => {
        playSoundboardAudio(DEFAULT_SOUNDBOARD_SOUNDS[0], 0.8);
      }).not.toThrow();
    });
  });
});
