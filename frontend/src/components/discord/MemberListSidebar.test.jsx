import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MemberListSidebar from './MemberListSidebar';
import ServerMembersTab from './ServerMembersTab';
import { ToastProvider } from '../../context/ToastContext';

describe('MemberListSidebar & Kick Member Functionality', () => {
  const mockServer = {
    id: 1,
    name: 'Servidor dos Devs',
    owner_id: 10,
  };

  const mockMembers = [
    {
      id: 101,
      user_id: 10,
      name: 'Aryaraj Owner',
      role: 'OWNER',
      is_online: true,
    },
    {
      id: 102,
      user_id: 20,
      name: 'Hokage Admin',
      role: 'ADMIN',
      role_name: 'Moderador',
      role_color: '#5865f2',
      is_online: true,
    },
    {
      id: 103,
      user_id: 30,
      name: 'Jordão Membro',
      role: 'MEMBER',
      is_online: true,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza membros divididos entre Administração e Membros', () => {
    render(
      <ToastProvider>
        <MemberListSidebar
          members={mockMembers}
          currentUserId={30}
          activeServer={mockServer}
        />
      </ToastProvider>
    );

    expect(screen.getByText('Administração — 2')).toBeInTheDocument();
    expect(screen.getByText('Membros — 1')).toBeInTheDocument();
    expect(screen.getByText('Aryaraj Owner')).toBeInTheDocument();
    expect(screen.getByText('Jordão Membro')).toBeInTheDocument();
  });

  it('não exibe botão de remover para membros comuns sem privilégios', () => {
    render(
      <ToastProvider>
        <MemberListSidebar
          members={mockMembers}
          currentUserId={30}
          currentUserRole="user"
          activeServer={mockServer}
        />
      </ToastProvider>
    );

    expect(screen.queryByTestId('member-kick-btn-10')).not.toBeInTheDocument();
    expect(screen.queryByTestId('member-kick-btn-20')).not.toBeInTheDocument();
    expect(screen.queryByTestId('member-kick-btn-30')).not.toBeInTheDocument();
  });

  it('exibe botão de remover para o Dono do servidor nos membros e administradores (exceto si mesmo e o dono)', () => {
    render(
      <ToastProvider>
        <MemberListSidebar
          members={mockMembers}
          currentUserId={10} // Dono
          currentUserRole="user"
          activeServer={mockServer}
        />
      </ToastProvider>
    );

    // Dono não pode remover a si mesmo
    expect(screen.queryByTestId('member-kick-btn-10')).not.toBeInTheDocument();

    // Dono pode remover admin e membro comum
    expect(screen.getByTestId('member-kick-btn-20')).toBeInTheDocument();
    expect(screen.getByTestId('member-kick-btn-30')).toBeInTheDocument();
  });

  it('abre o modal de confirmação ao clicar no botão de kick e fecha ao cancelar', () => {
    render(
      <ToastProvider>
        <MemberListSidebar
          members={mockMembers}
          currentUserId={10}
          activeServer={mockServer}
        />
      </ToastProvider>
    );

    const kickBtn = screen.getByTestId('member-kick-btn-30');
    fireEvent.click(kickBtn);

    const modal = screen.getByTestId('kick-member-modal');
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveTextContent(/Tem certeza que deseja remover/i);
    expect(modal).toHaveTextContent('Jordão Membro');

    // Cancelar fecha o popup
    const cancelBtn = screen.getByTestId('cancel-kick-member-btn');
    fireEvent.click(cancelBtn);
    expect(screen.queryByTestId('kick-member-modal')).not.toBeInTheDocument();
  });

  it('não fecha o modal ao clicar no backdrop (fechamento forçado apenas via botão)', () => {
    render(
      <ToastProvider>
        <MemberListSidebar
          members={mockMembers}
          currentUserId={10}
          activeServer={mockServer}
        />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('member-kick-btn-30'));
    expect(screen.getByTestId('kick-member-modal')).toBeInTheDocument();

    const backdrop = screen.getByTestId('kick-member-modal-backdrop');
    fireEvent.click(backdrop);

    // Modal continua aberto
    expect(screen.getByTestId('kick-member-modal')).toBeInTheDocument();
  });

  it('executa a remoção com sucesso via onKickMember ou fetch DELETE', async () => {
    const onMemberRemoved = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Removido com sucesso' }),
    });

    render(
      <ToastProvider>
        <MemberListSidebar
          members={mockMembers}
          currentUserId={10}
          activeServer={mockServer}
          token="fake-token"
          onMemberRemoved={onMemberRemoved}
        />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('member-kick-btn-30'));
    const confirmBtn = screen.getByTestId('confirm-kick-member-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/servers/1/members/30',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(onMemberRemoved).toHaveBeenCalledWith(30);
    });

    expect(screen.queryByTestId('kick-member-modal')).not.toBeInTheDocument();
  });

  it('renderiza o botão de remover membro na aba ServerMembersTab e abre confirmação', () => {
    render(
      <ToastProvider>
        <ServerMembersTab
          server={mockServer}
          members={mockMembers}
          roles={[]}
          token="fake-token"
          currentUserId={10}
        />
      </ToastProvider>
    );

    // Botão de remover no tab de membros para Jordão Membro
    const kickBtnTab = screen.getByTestId('server-tab-kick-btn-103');
    expect(kickBtnTab).toBeInTheDocument();

    fireEvent.click(kickBtnTab);
    const modal = screen.getByTestId('kick-member-modal');
    expect(modal).toBeInTheDocument();
    expect(screen.getByTestId('confirm-kick-member-btn')).toBeInTheDocument();
  });

  it('separa membros online em seus cargos e agrupa membros offline na seção dedicada Offline', () => {
    const mixedMembers = [
      { id: 1, user_id: 10, name: 'Super Admin', role: 'OWNER', is_online: true },
      { id: 2, user_id: 20, name: 'Hokage Online', role: 'ADMIN', is_online: true },
      { id: 3, user_id: 30, name: 'Membro Ativo', role: 'MEMBER', is_online: true },
      { id: 4, user_id: 40, name: 'Membro Desconectado', role: 'MEMBER', is_online: false },
      { id: 5, user_id: 50, name: 'Admin Ausente', role: 'ADMIN', is_online: false },
    ];

    render(
      <ToastProvider>
        <MemberListSidebar
          members={mixedMembers}
          currentUserId={10}
          activeServer={mockServer}
        />
      </ToastProvider>
    );

    // Online: Administração — 2 (Super Admin e Hokage Online)
    expect(screen.getByText('Administração — 2')).toBeInTheDocument();
    // Online: Membros — 1 (Membro Ativo)
    expect(screen.getByText('Membros — 1')).toBeInTheDocument();
    // Offline: Offline — 2 (Membro Desconectado e Admin Ausente)
    expect(screen.getByTestId('offline-group-title')).toHaveTextContent('Offline — 2');

    // Textos de status
    expect(screen.getByTestId('member-status-text-10')).toHaveTextContent('● Online');
    expect(screen.getByTestId('member-status-text-30')).toHaveTextContent('● Online');
    expect(screen.getByTestId('member-status-text-40')).toHaveTextContent('Offline');
    expect(screen.getByTestId('member-status-text-50')).toHaveTextContent('Offline');

    // Classes visuais
    const rowOffline = screen.getByTestId('member-row-4');
    expect(rowOffline).toHaveClass('is-offline');
    const rowOnline = screen.getByTestId('member-row-3');
    expect(rowOnline).toHaveClass('is-online');
  });
});
