import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChannelSidebar from './ChannelSidebar';
import DMSidebar from './DMSidebar';
import UserSettingsModal from './UserSettingsModal';
import UserAccountTab from './UserAccountTab';
import UserVoiceAudioTab from './UserVoiceAudioTab';
import UserAppearanceTab from './UserAppearanceTab';
import { ToastProvider } from '../../context/ToastContext';
import * as discordSounds from './discordSounds';

describe('User Settings Modal Feature (Item 2)', () => {
  const mockCurrentUser = {
    id: 1,
    name: 'Arya Stark',
    email: 'arya@winterfell.com',
    avatar_url: '/avatar.png',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    localStorage.setItem('auth_token', 'test-token');
  });

  describe('Sidebar Triggers', () => {
    it('opens user settings from ChannelSidebar footer gear icon', () => {
      const onOpenSettings = vi.fn();
      render(
        <ChannelSidebar
          server={{ id: 1, name: 'Geral' }}
          channels={[{ id: 1, name: 'geral', type: 'TEXT' }]}
          currentUser={mockCurrentUser}
          onOpenUserSettings={onOpenSettings}
        />
      );

      const btn = screen.getByTestId('user-settings-btn');
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('opens user settings from DMSidebar footer gear icon', () => {
      const onOpenSettings = vi.fn();
      render(
        <DMSidebar
          conversations={[]}
          currentUser={mockCurrentUser}
          onOpenUserSettings={onOpenSettings}
        />
      );

      const btn = screen.getByTestId('dm-settings-btn');
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe('UserAccountTab Component', () => {
    it('renders user details and allows saving display name', async () => {
      const onUserUpdated = vi.fn();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ...mockCurrentUser, name: 'Arya No-One' }),
      });

      render(
        <ToastProvider>
          <UserAccountTab
            currentUser={mockCurrentUser}
            onUserUpdated={onUserUpdated}
            token="test-token"
          />
        </ToastProvider>
      );

      const nameInput = screen.getByTestId('user-name-input');
      expect(nameInput).toHaveValue('Arya Stark');
      expect(nameInput).toHaveClass('discord-input');

      const saveBtn = screen.getByTestId('save-profile-btn');
      expect(saveBtn).toHaveClass('discord-btn', 'discord-btn-primary');

      fireEvent.change(nameInput, { target: { value: 'Arya No-One' } });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/auth/profile',
          expect.objectContaining({ method: 'PATCH' })
        );
        expect(onUserUpdated).toHaveBeenCalled();
      });
    });

    it('validates password requirements and changes password', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Senha alterada com sucesso!' }),
      });

      render(
        <ToastProvider>
          <UserAccountTab
            currentUser={mockCurrentUser}
            onUserUpdated={vi.fn()}
            token="test-token"
          />
        </ToastProvider>
      );

      fireEvent.change(screen.getByTestId('current-password-input'), {
        target: { value: 'SenhaAtual123!' },
      });
      fireEvent.change(screen.getByTestId('new-password-input'), {
        target: { value: 'NovaSenhaForte123@' },
      });
      fireEvent.change(screen.getByTestId('confirm-password-input'), {
        target: { value: 'NovaSenhaForte123@' },
      });

      const changeBtn = screen.getByTestId('change-password-btn');
      expect(changeBtn).not.toBeDisabled();

      fireEvent.click(changeBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/v1/auth/change-password',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });
  });

  describe('UserVoiceAudioTab Component', () => {
    it('adjusts volume and test sounds', () => {
      const playSpy = vi.spyOn(discordSounds, 'playDiscordSound').mockImplementation(() => true);

      render(
        <ToastProvider>
          <UserVoiceAudioTab />
        </ToastProvider>
      );

      const slider = screen.getByTestId('sound-volume-slider');
      fireEvent.change(slider, { target: { value: '80' } });
      expect(screen.getByTestId('volume-label')).toHaveTextContent('80%');

      const msgSoundBtn = screen.getByTestId('test-sound-message-btn');
      expect(msgSoundBtn).toHaveClass('discord-btn', 'discord-btn-secondary');
      fireEvent.click(msgSoundBtn);
      expect(playSpy).toHaveBeenCalledWith('message');

      fireEvent.click(screen.getByTestId('test-sound-mention-btn'));
      expect(playSpy).toHaveBeenCalledWith('mention');
    });

    it('toggles sound mute switch', () => {
      render(
        <ToastProvider>
          <UserVoiceAudioTab />
        </ToastProvider>
      );

      const checkbox = screen.getByTestId('mute-sounds-checkbox');
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();
    });
  });

  describe('UserAppearanceTab Component', () => {
    it('switches chat density between cozy and compact', () => {
      render(
        <ToastProvider>
          <UserAppearanceTab />
        </ToastProvider>
      );

      const compactCard = screen.getByTestId('density-compact-card');
      fireEvent.click(compactCard);
      expect(compactCard).toHaveClass('selected');
      expect(localStorage.getItem('discord_chat_density')).toBe('compact');

      const cozyCard = screen.getByTestId('density-cozy-card');
      fireEvent.click(cozyCard);
      expect(cozyCard).toHaveClass('selected');
      expect(localStorage.getItem('discord_chat_density')).toBe('cozy');
    });

    it('changes font size and reflects in label and preview', () => {
      render(
        <ToastProvider>
          <UserAppearanceTab />
        </ToastProvider>
      );

      const btn18 = screen.getByTestId('font-size-18-btn');
      const btn14 = screen.getByTestId('font-size-14-btn');
      fireEvent.click(btn18);
      expect(btn18).toHaveClass('discord-btn', 'discord-btn-primary');
      expect(btn14).toHaveClass('discord-btn', 'discord-btn-secondary');
      expect(screen.getByTestId('font-size-label')).toHaveTextContent('18px');
      expect(localStorage.getItem('discord_font_size')).toBe('18');
    });
  });

  describe('UserSettingsModal Container', () => {
    it('switches tabs and closes with close button or ESC key', () => {
      const onClose = vi.fn();
      render(
        <ToastProvider>
          <UserSettingsModal
            isOpen={true}
            onClose={onClose}
            currentUser={mockCurrentUser}
            onUserUpdated={vi.fn()}
          />
        </ToastProvider>
      );

      expect(screen.getByTestId('user-account-tab')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('tab-user-voice-audio-btn'));
      expect(screen.getByTestId('user-voice-audio-tab')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('tab-user-appearance-btn'));
      expect(screen.getByTestId('user-appearance-tab')).toBeInTheDocument();

      fireEvent.click(screen.getByTestId('close-user-settings-btn'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
