import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToastProvider } from '../../context/ToastContext';
import ServerListBar from './ServerListBar';
import ChannelSidebar from './ChannelSidebar';
import ChatArea from './ChatArea';
import MemberListSidebar from './MemberListSidebar';
import CreateServerModal from './CreateServerModal';
import CreateChannelModal from './CreateChannelModal';
import ServerInviteModal from './ServerInviteModal';
import VoicePipPlayer from './VoicePipPlayer';

const mockUser = {
  id: 1,
  name: 'Arya Stark',
  email: 'arya@winterfell.com',
  role: 'superadmin',
};

const mockServers = [
  { id: 1, name: 'Comunidade Dev', owner_id: 1, channels: [] },
  { id: 2, name: 'Gamer Zone', owner_id: 1, channels: [] },
];

const mockChannels = [
  { id: 10, server_id: 1, name: 'geral', type: 'TEXT', category: 'Canais de Texto' },
  { id: 11, server_id: 1, name: 'anuncios', type: 'TEXT', category: 'Canais de Texto' },
  { id: 12, server_id: 1, name: 'sala-voz', type: 'VOICE', category: 'Canais de Voz' },
];

describe('Discord Frontend Components (3-Column Layout & Modals)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });
  });

  it('renders ServerListBar with DM button, servers and add button', () => {
    const onSelectServer = vi.fn();
    const onOpenCreateServer = vi.fn();

    render(
      <ServerListBar
        servers={mockServers}
        activeServerId={1}
        onSelectServer={onSelectServer}
        onOpenCreateServer={onOpenCreateServer}
      />
    );

    expect(screen.getByTestId('dm-server-btn')).toBeInTheDocument();
    expect(screen.getByTestId('server-icon-1')).toBeInTheDocument();
    expect(screen.getByTestId('server-icon-2')).toBeInTheDocument();
    expect(screen.getByTestId('add-server-btn')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('server-icon-2'));
    expect(onSelectServer).toHaveBeenCalledWith(2);

    fireEvent.click(screen.getByTestId('add-server-btn'));
    expect(onOpenCreateServer).toHaveBeenCalled();
  });

  it('renders ChannelSidebar with categories, channels and user status bar', () => {
    const onSelectChannel = vi.fn();
    const onOpenCreateChannel = vi.fn();
    const onOpenInvite = vi.fn();

    render(
      <ChannelSidebar
        server={mockServers[0]}
        channels={mockChannels}
        activeChannelId={10}
        onSelectChannel={onSelectChannel}
        onOpenCreateChannel={onOpenCreateChannel}
        onOpenInvite={onOpenInvite}
        currentUser={mockUser}
      />
    );

    expect(screen.getByText('Comunidade Dev')).toBeInTheDocument();
    expect(screen.getByText('Canais de Texto')).toBeInTheDocument();
    expect(screen.getByText('Canais de Voz')).toBeInTheDocument();
    expect(screen.getByText('geral')).toBeInTheDocument();
    expect(screen.getByText('sala-voz')).toBeInTheDocument();
    expect(screen.getByText('Arya Stark')).toBeInTheDocument();
    expect(screen.getByTestId('mic-btn')).toBeInTheDocument();
    expect(screen.getByTestId('audio-btn')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('channel-item-11'));
    expect(onSelectChannel).toHaveBeenCalledWith(11);
  });

  it('renders ChatArea with messages feed and allows sending a message', async () => {
    const onSendMessage = vi.fn().mockResolvedValue();
    const mockMessages = [
      { id: 101, content: 'Primeira mensagem no chat!', author_name: 'Bob', created_at: '2026-10-28T12:00:00Z' },
    ];

    render(
      <ToastProvider>
        <ChatArea
          channel={mockChannels[0]}
          messages={mockMessages}
          onSendMessage={onSendMessage}
          typingUsers={['Alice']}
          showMembers={true}
          onToggleMembers={vi.fn()}
        />
      </ToastProvider>
    );

    expect(screen.getByText('geral')).toBeInTheDocument();
    expect(screen.getByText('Primeira mensagem no chat!')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/digitando/i)).toBeInTheDocument();

    const input = screen.getByTestId('chat-message-input');
    fireEvent.change(input, { target: { value: 'Nova mensagem de teste' } });
    expect(input.value).toBe('Nova mensagem de teste');

    const sendBtn = screen.getByTestId('chat-send-btn');
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(onSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Nova mensagem de teste' })
      );
    });
  });

  it('renders MemberListSidebar grouped by roles', () => {
    const mockMembers = [
      { id: 1, name: 'Arya Stark', role: 'OWNER' },
      { id: 2, name: 'Jon Snow', role: 'MEMBER' },
    ];

    render(<MemberListSidebar members={mockMembers} />);

    expect(screen.getByText('Administração — 1')).toBeInTheDocument();
    expect(screen.getByText('Membros — 1')).toBeInTheDocument();
    expect(screen.getByText('Arya Stark')).toBeInTheDocument();
    expect(screen.getByText('Jon Snow')).toBeInTheDocument();
  });

  it('opens CreateServerModal, cancels and validates submission', async () => {
    const onClose = vi.fn();
    const onCreateServer = vi.fn().mockResolvedValue();

    render(<CreateServerModal isOpen={true} onClose={onClose} onCreateServer={onCreateServer} />);

    expect(screen.getByText('Criar seu Servidor')).toBeInTheDocument();
    const nameInput = screen.getByTestId('server-name-input');
    fireEvent.change(nameInput, { target: { value: 'Novo Servidor Legal' } });

    fireEvent.click(screen.getByTestId('server-submit-btn'));
    await waitFor(() => {
      expect(onCreateServer).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Novo Servidor Legal' })
      );
    });

    fireEvent.click(screen.getByTestId('server-cancel-btn'));
    expect(onClose).toHaveBeenCalled();
  });

  it('opens CreateChannelModal with text and voice options', async () => {
    const onClose = vi.fn();
    const onCreateChannel = vi.fn().mockResolvedValue();

    render(<CreateChannelModal isOpen={true} onClose={onClose} onCreateChannel={onCreateChannel} />);

    expect(screen.getByTestId('create-channel-modal')).toBeInTheDocument();
    expect(screen.getByText('Texto')).toBeInTheDocument();
    expect(screen.getByText('Voz')).toBeInTheDocument();

    const nameInput = screen.getByTestId('channel-name-input');
    fireEvent.change(nameInput, { target: { value: 'bate-papo' } });

    fireEvent.click(screen.getByTestId('channel-submit-btn'));
    await waitFor(() => {
      expect(onCreateChannel).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'bate-papo', type: 'TEXT' })
      );
    });
  });

  it('opens ServerInviteModal and provides copy function', async () => {
    const onClose = vi.fn();
    const onCreateInvite = vi.fn().mockResolvedValue({ code: 'inv-xyz-123' });

    render(
      <ToastProvider>
        <ServerInviteModal
          isOpen={true}
          onClose={onClose}
          server={mockServers[0]}
          onCreateInvite={onCreateInvite}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(onCreateInvite).toHaveBeenCalled();
      expect(screen.getByTestId('invite-link-input').value).toContain('inv-xyz-123');
    });

    const copyBtn = screen.getByTestId('copy-invite-btn');
    fireEvent.click(copyBtn);
    expect(screen.getByText('Copiado!')).toBeInTheDocument();
  });

  it('renders VoicePipPlayer with video when screen sharing or camera is active in PiP', () => {
    const handleReturn = vi.fn();
    const handleDisconnect = vi.fn();

    render(
      <VoicePipPlayer
        channel={mockChannels[2]}
        currentUser={mockUser}
        isMuted={false}
        isSpeaking={true}
        isCameraOn={true}
        isScreenSharing={false}
        onToggleMute={vi.fn()}
        onToggleCamera={vi.fn()}
        onToggleScreenShare={vi.fn()}
        onDisconnectVoice={handleDisconnect}
        onReturnToVoice={handleReturn}
        onSetVideoRef={vi.fn()}
        onSetCameraVideoRef={vi.fn()}
      />
    );

    expect(screen.getByTestId('voice-pip-container')).toBeInTheDocument();
    expect(screen.getByText('#sala-voz')).toBeInTheDocument();
    expect(screen.getByTestId('voice-pip-camera-video')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('voice-pip-title-btn'));
    expect(handleReturn).toHaveBeenCalledTimes(1);
  });
});
