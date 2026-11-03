import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatArea from './ChatArea';
import VoiceChannelArea from './VoiceChannelArea';
import fs from 'fs';
import path from 'path';

// Mock do ToastContext
vi.mock('../../context/ToastContext', () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

describe('Discord Mobile Responsiveness', () => {
  const mockChannel = {
    id: 'ch-general',
    name: 'geral',
    type: 'TEXT',
    is_dm: false,
    category: 'Canais de Texto',
  };

  it('renders hamburger menu button in ChatArea and fires onToggleMobileNav on click', () => {
    const handleToggleMobileNav = vi.fn();

    render(
      <ChatArea
        channel={mockChannel}
        messages={[]}
        channels={[mockChannel]}
        onToggleMobileNav={handleToggleMobileNav}
      />
    );

    const hamburgerBtn = screen.getByTestId('chat-mobile-nav-btn');
    expect(hamburgerBtn).toBeDefined();

    fireEvent.click(hamburgerBtn);
    expect(handleToggleMobileNav).toHaveBeenCalledTimes(1);
  });

  it('renders members toggle button in ChatArea and fires onToggleMembers on click', () => {
    const handleToggleMembers = vi.fn();

    render(
      <ChatArea
        channel={mockChannel}
        messages={[]}
        channels={[mockChannel]}
        showMembers={false}
        onToggleMembers={handleToggleMembers}
      />
    );

    const membersBtn = screen.getByTestId('toggle-members-btn');
    expect(membersBtn).toBeDefined();

    fireEvent.click(membersBtn);
    expect(handleToggleMembers).toHaveBeenCalledTimes(1);
  });

  it('renders hamburger menu button in VoiceChannelArea when onToggleMobileNav is provided', () => {
    const handleToggleMobileNav = vi.fn();
    const voiceChannel = {
      id: 'ch-voice',
      name: 'Sala de Voz',
      type: 'VOICE',
    };

    render(
      <VoiceChannelArea
        channel={voiceChannel}
        currentUser={{ id: 'u1', name: 'Tester' }}
        onToggleMobileNav={handleToggleMobileNav}
      />
    );

    const hamburgerBtn = screen.getByTestId('chat-mobile-nav-btn');
    expect(hamburgerBtn).toBeDefined();

    fireEvent.click(hamburgerBtn);
    expect(handleToggleMobileNav).toHaveBeenCalledTimes(1);
  });

  it('css file discord-responsive.css contains all critical mobile drawer breakpoints', () => {
    const cssPath = path.resolve(__dirname, '../../styles/discord-responsive.css');
    expect(fs.existsSync(cssPath)).toBe(true);
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    // Valida regras essenciais do layout mobile Discord
    expect(cssContent).toContain('@media (max-width: 768px)');
    expect(cssContent).toContain('.chat-mobile-nav-btn');
    expect(cssContent).toContain('.discord-mobile-backdrop');
    expect(cssContent).toContain('.discord-mobile-members-backdrop');
    expect(cssContent).toContain('.mobile-nav-open .discord-server-list');
    expect(cssContent).toContain('.mobile-nav-open .discord-channel-sidebar');
    expect(cssContent).toContain('.mobile-members-open .discord-member-list');
    expect(cssContent).toContain('.voice-pip-container');
  });
});
