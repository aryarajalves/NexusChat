import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  isSoundMuted,
  setSoundMuted,
  toggleSoundMuted,
  getSoundVolume,
  setSoundVolume,
  playDiscordSound,
  resetAudioContextForTesting,
} from './discordSounds';
import ChannelSidebar from './ChannelSidebar';
import DMSidebar from './DMSidebar';

describe('Discord Sounds & Web Audio Synthesizer (Item 4)', () => {
  let mockGainNode;
  let mockOscillatorNode;
  let mockAudioContext;

  beforeEach(() => {
    localStorage.clear();
    resetAudioContextForTesting();

    mockGainNode = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    mockOscillatorNode = {
      type: 'sine',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    mockAudioContext = {
      currentTime: 0,
      state: 'running',
      destination: {},
      createGain: vi.fn(() => ({
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      })),
      createOscillator: vi.fn(() => ({
        type: 'sine',
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      resume: vi.fn().mockResolvedValue(),
    };

    function MockAudioContextConstructor() {
      return mockAudioContext;
    }

    window.AudioContext = MockAudioContextConstructor;
    window.webkitAudioContext = MockAudioContextConstructor;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Sound Settings & Volume Controls', () => {
    it('isSoundMuted returns false by default', () => {
      expect(isSoundMuted()).toBe(false);
    });

    it('setSoundMuted updates localStorage and isSoundMuted state', () => {
      setSoundMuted(true);
      expect(isSoundMuted()).toBe(true);

      setSoundMuted(false);
      expect(isSoundMuted()).toBe(false);
    });

    it('toggleSoundMuted toggles the muted state and returns new value', () => {
      expect(toggleSoundMuted()).toBe(true);
      expect(isSoundMuted()).toBe(true);

      expect(toggleSoundMuted()).toBe(false);
      expect(isSoundMuted()).toBe(false);
    });

    it('getSoundVolume returns default 0.4 when unset', () => {
      expect(getSoundVolume()).toBe(0.4);
    });

    it('setSoundVolume updates volume within [0, 1] range', () => {
      setSoundVolume(0.8);
      expect(getSoundVolume()).toBe(0.8);

      setSoundVolume(1.5);
      expect(getSoundVolume()).toBe(1.0);

      setSoundVolume(-0.2);
      expect(getSoundVolume()).toBe(0.0);
    });
  });

  describe('Sound Synthesis (playDiscordSound)', () => {
    it('plays message sound with dual harmonics', () => {
      const played = playDiscordSound('message');
      expect(played).toBe(true);
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('plays mention sound with arpeggio chord', () => {
      const played = playDiscordSound('mention');
      expect(played).toBe(true);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(4);
    });

    it('plays voice_join sound with ascending frequencies', () => {
      const played = playDiscordSound('voice_join');
      expect(played).toBe(true);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(3);
    });

    it('plays voice_leave sound with descending frequencies', () => {
      const played = playDiscordSound('voice_leave');
      expect(played).toBe(true);
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(3);
    });

    it('plays mute and unmute audio cues', () => {
      expect(playDiscordSound('mute')).toBe(true);
      expect(playDiscordSound('unmute')).toBe(true);
    });

    it('does not play any sound when isSoundMuted is true', () => {
      setSoundMuted(true);
      const played = playDiscordSound('message');
      expect(played).toBe(false);
      expect(mockAudioContext.createOscillator).not.toHaveBeenCalled();
    });

    it('returns false gracefully when AudioContext is unsupported', () => {
      window.AudioContext = undefined;
      window.webkitAudioContext = undefined;
      const played = playDiscordSound('message');
      expect(played).toBe(false);
    });
  });

  describe('ChannelSidebar Audio Button UI', () => {
    const defaultProps = {
      server: { id: 1, name: 'Servidor Geral' },
      channels: [{ id: 10, name: 'geral', type: 'TEXT' }],
      activeChannelId: 10,
      currentUser: { id: 1, name: 'Arya' },
      onSelectChannel: vi.fn(),
      onOpenCreateChannel: vi.fn(),
      onOpenInvite: vi.fn(),
      onDisconnectVoice: vi.fn(),
      onToggleSoundMute: vi.fn(),
    };

    it('renders headphones icon when not muted', () => {
      render(<ChannelSidebar {...defaultProps} isSoundMuted={false} />);
      const btn = screen.getByTestId('audio-btn');
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute('title', 'Silenciar Efeitos Sonoros');
      expect(btn).not.toHaveClass('muted');
    });

    it('renders VolumeX icon and muted class when muted', () => {
      render(<ChannelSidebar {...defaultProps} isSoundMuted={true} />);
      const btn = screen.getByTestId('audio-btn');
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute('title', 'Ativar Efeitos Sonoros');
      expect(btn).toHaveClass('muted');
    });

    it('calls onToggleSoundMute when audio button is clicked', () => {
      const toggleMock = vi.fn();
      render(<ChannelSidebar {...defaultProps} onToggleSoundMute={toggleMock} />);
      const btn = screen.getByTestId('audio-btn');
      fireEvent.click(btn);
      expect(toggleMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('DMSidebar Audio Button UI', () => {
    const defaultDMProps = {
      conversations: [
        { id: 1, other_user: { id: 2, name: 'Amigo 1', email: 'amigo@teste.com' } },
      ],
      activeConversationId: 1,
      currentUser: { id: 1, name: 'Arya' },
      onSelectConversation: vi.fn(),
      onOpenNewDM: vi.fn(),
      onToggleSoundMute: vi.fn(),
    };

    it('renders headphones icon when not muted in DM sidebar', () => {
      render(<DMSidebar {...defaultDMProps} isSoundMuted={false} />);
      const btn = screen.getByTestId('dm-headphones-btn');
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute('title', 'Silenciar Efeitos Sonoros');
      expect(btn).not.toHaveClass('muted');
    });

    it('renders VolumeX icon and muted class when muted in DM sidebar', () => {
      render(<DMSidebar {...defaultDMProps} isSoundMuted={true} />);
      const btn = screen.getByTestId('dm-headphones-btn');
      expect(btn).toBeInTheDocument();
      expect(btn).toHaveAttribute('title', 'Ativar Efeitos Sonoros');
      expect(btn).toHaveClass('muted');
    });

    it('calls onToggleSoundMute when clicked in DM sidebar', () => {
      const toggleMock = vi.fn();
      render(<DMSidebar {...defaultDMProps} onToggleSoundMute={toggleMock} />);
      const btn = screen.getByTestId('dm-headphones-btn');
      fireEvent.click(btn);
      expect(toggleMock).toHaveBeenCalledTimes(1);
    });
  });
});
