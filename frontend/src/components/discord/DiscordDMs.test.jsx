import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DMSidebar from './DMSidebar';
import NewDMModal from './NewDMModal';
import MemberListSidebar from './MemberListSidebar';
import ChatArea from './ChatArea';
import { ToastProvider } from '../../context/ToastContext';

describe('Discord Direct Messages (DMs)', () => {
  const mockCurrentUser = { id: 1, name: 'Alice Teste' };
  const mockConversations = [
    {
      id: 101,
      other_user: { id: 2, name: 'Bob Amigo', email: 'bob@teste.com', is_active: true },
      last_message: { id: 1, content: 'E aí Alice!', attachment_url: null },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 102,
      other_user: { id: 3, name: 'Carlos Dev', email: 'carlos@teste.com', is_active: true },
      last_message: { id: 2, content: '', attachment_url: '/api/v1/arte.png' },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ];

  const renderWithToast = (ui) => render(<ToastProvider>{ui}</ToastProvider>);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders DMSidebar with header, search bar, and conversation list', () => {
    const handleSelectConversation = vi.fn();
    const handleOpenNewDM = vi.fn();

    renderWithToast(
      <DMSidebar
        conversations={mockConversations}
        activeConversationId={101}
        onSelectConversation={handleSelectConversation}
        onOpenNewDM={handleOpenNewDM}
        currentUser={mockCurrentUser}
      />
    );

    expect(screen.getByTestId('dm-sidebar-header')).toHaveTextContent('Mensagens Diretas');
    expect(screen.getByTestId('header-new-dm-btn')).toBeInTheDocument();

    // Mostra as duas conversas
    expect(screen.getByText('Bob Amigo')).toBeInTheDocument();
    expect(screen.getByText('E aí Alice!')).toBeInTheDocument();
    expect(screen.getByText('Carlos Dev')).toBeInTheDocument();
    expect(screen.getByText('[Anexo de mídia]')).toBeInTheDocument();

    // Clica na conversa 102
    fireEvent.click(screen.getByTestId('dm-item-102'));
    expect(handleSelectConversation).toHaveBeenCalledWith(102);

    // Clica no botão de nova conversa
    fireEvent.click(screen.getByTestId('header-new-dm-btn'));
    expect(handleOpenNewDM).toHaveBeenCalledTimes(1);
  });

  it('filters conversations in DMSidebar by friend name', () => {
    renderWithToast(
      <DMSidebar
        conversations={mockConversations}
        activeConversationId={101}
        onSelectConversation={vi.fn()}
        onOpenNewDM={vi.fn()}
        currentUser={mockCurrentUser}
      />
    );

    const filterInput = screen.getByTestId('filter-dms-input');
    fireEvent.change(filterInput, { target: { value: 'Carlos' } });

    expect(screen.getByText('Carlos Dev')).toBeInTheDocument();
    expect(screen.queryByText('Bob Amigo')).not.toBeInTheDocument();
  });

  it('renders empty state in DMSidebar when no conversations exist', () => {
    const handleOpenNewDM = vi.fn();
    renderWithToast(
      <DMSidebar
        conversations={[]}
        onSelectConversation={vi.fn()}
        onOpenNewDM={handleOpenNewDM}
        currentUser={mockCurrentUser}
      />
    );

    expect(screen.getByText('Nenhuma conversa iniciada.')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('empty-start-dm-btn'));
    expect(handleOpenNewDM).toHaveBeenCalledTimes(1);
  });

  it('searches users in NewDMModal and triggers onSelectUser', async () => {
    const fakeUsers = [
      { id: 2, name: 'Bob Amigo', email: 'bob@teste.com', is_active: true },
      { id: 3, name: 'Carlos Dev', email: 'carlos@teste.com', is_active: true },
    ];

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => fakeUsers,
    });

    const handleSelectUser = vi.fn().mockResolvedValue({});
    const handleClose = vi.fn();

    renderWithToast(
      <NewDMModal
        isOpen={true}
        onClose={handleClose}
        token="fake-token"
        onSelectUser={handleSelectUser}
      />
    );

    expect(screen.getByText('Iniciar Conversa Privada')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Bob Amigo')).toBeInTheDocument();
      expect(screen.getByText('Carlos Dev')).toBeInTheDocument();
    });

    // Clica no botão de conversar com Carlos
    fireEvent.click(screen.getByTestId('start-dm-btn-3'));

    await waitFor(() => {
      expect(handleSelectUser).toHaveBeenCalledWith(3);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  it('renders MemberListSidebar with direct message action button for other members', () => {
    const handleStartDM = vi.fn();
    const members = [
      { id: 1, user_id: 1, name: 'Alice Teste', role: 'OWNER' },
      { id: 2, user_id: 2, name: 'Bob Membro', role: 'MEMBER' },
    ];

    renderWithToast(
      <MemberListSidebar
        members={members}
        currentUserId={1}
        onStartDM={handleStartDM}
      />
    );

    // Botão de DM não aparece para si mesmo
    expect(screen.queryByTestId('member-dm-btn-1')).not.toBeInTheDocument();

    // Botão de DM aparece para Bob
    const bobBtn = screen.getByTestId('member-dm-btn-2');
    expect(bobBtn).toBeInTheDocument();

    fireEvent.click(bobBtn);
    expect(handleStartDM).toHaveBeenCalledWith(2);
  });

  it('renders ChatArea in DM mode with @ prefix, private topic, and custom placeholder', () => {
    const dmChannel = {
      id: 101,
      name: 'Bob Amigo',
      is_dm: true,
      type: 'TEXT',
    };

    renderWithToast(
      <ChatArea
        channel={dmChannel}
        messages={[]}
        currentUserId={1}
        currentUserRole="MEMBER"
      />
    );

    // Header exibe @Bob Amigo e Conversa Privada
    expect(screen.getByText('@Bob Amigo')).toBeInTheDocument();
    expect(screen.getByText('Conversa Privada')).toBeInTheDocument();

    // Placeholder do input é customizado para DM
    const input = screen.getByTestId('chat-message-input');
    expect(input).toHaveAttribute('placeholder', 'Conversar com @Bob Amigo');

    // Estado vazio é adaptado para conversa privada
    expect(screen.getByText('Início da conversa com @Bob Amigo')).toBeInTheDocument();

    // Botão de alternar membros não é renderizado em DMs
    expect(screen.queryByTestId('toggle-members-btn')).not.toBeInTheDocument();
  });
});
