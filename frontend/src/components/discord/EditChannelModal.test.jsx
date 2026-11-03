import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditChannelModal from './EditChannelModal';

describe('EditChannelModal Component', () => {
  const mockChannel = {
    id: 10,
    name: 'boas-vindas',
    type: 'TEXT',
    category: 'Canais de Texto',
    is_private: false,
    allowed_role_ids: [],
  };

  const mockRoles = [
    { id: 1, name: 'Moderador', color: '#3b82f6' },
    { id: 2, name: 'VIP', color: '#10b981' },
  ];

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <EditChannelModal
        isOpen={false}
        channel={mockChannel}
        onClose={vi.fn()}
        onUpdateChannel={vi.fn()}
        onDeleteChannel={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders channel details correctly when isOpen is true', () => {
    render(
      <EditChannelModal
        isOpen={true}
        channel={mockChannel}
        roles={mockRoles}
        onClose={vi.fn()}
        onUpdateChannel={vi.fn()}
        onDeleteChannel={vi.fn()}
      />
    );

    expect(screen.getByTestId('edit-channel-modal')).toBeInTheDocument();
    expect(screen.getByText('Configurações do Canal')).toBeInTheDocument();
    const nameInput = screen.getByTestId('edit-channel-name-input');
    expect(nameInput).toHaveValue('boas-vindas');
  });

  it('calls onUpdateChannel with formatted name and private status when saving', async () => {
    const handleUpdate = vi.fn().mockResolvedValue({});
    const handleClose = vi.fn();

    render(
      <EditChannelModal
        isOpen={true}
        channel={mockChannel}
        roles={mockRoles}
        onClose={handleClose}
        onUpdateChannel={handleUpdate}
        onDeleteChannel={vi.fn()}
      />
    );

    const nameInput = screen.getByTestId('edit-channel-name-input');
    fireEvent.change(nameInput, { target: { value: 'regras e avisos' } });

    const saveBtn = screen.getByTestId('edit-channel-save-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleUpdate).toHaveBeenCalledWith(10, {
        name: 'regras-e-avisos',
        is_private: false,
        allowed_role_ids: [],
      });
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('allows toggling private channel switch and selecting roles', async () => {
    const handleUpdate = vi.fn().mockResolvedValue({});

    render(
      <EditChannelModal
        isOpen={true}
        channel={mockChannel}
        roles={mockRoles}
        onClose={vi.fn()}
        onUpdateChannel={handleUpdate}
        onDeleteChannel={vi.fn()}
      />
    );

    // Ativa canal privado
    const privateSwitch = screen.getByTestId('edit-channel-private-switch').querySelector('input');
    fireEvent.click(privateSwitch);

    // Seleciona o cargo VIP
    const roleItem = screen.getByTestId('role-checkbox-2');
    fireEvent.click(roleItem);

    const saveBtn = screen.getByTestId('edit-channel-save-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(handleUpdate).toHaveBeenCalledWith(10, {
        name: 'boas-vindas',
        is_private: true,
        allowed_role_ids: [2],
      });
    });
  });

  it('opens confirmation popup and calls onDeleteChannel when confirmed', async () => {
    const handleDelete = vi.fn().mockResolvedValue({});
    const handleClose = vi.fn();

    render(
      <EditChannelModal
        isOpen={true}
        channel={mockChannel}
        roles={mockRoles}
        onClose={handleClose}
        onUpdateChannel={vi.fn()}
        onDeleteChannel={handleDelete}
      />
    );

    // Clica em Excluir Canal
    const openDeleteBtn = screen.getByTestId('open-delete-channel-btn');
    fireEvent.click(openDeleteBtn);

    // Verifica popup de confirmação
    expect(screen.getByTestId('delete-channel-confirm-panel')).toBeInTheDocument();
    expect(screen.getByText(/Tem certeza de que deseja excluir o canal/i)).toBeInTheDocument();

    // Confirma exclusão
    const confirmBtn = screen.getByTestId('confirm-delete-channel-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(handleDelete).toHaveBeenCalledWith(10);
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('closes modal when cancel or close button is clicked', () => {
    const handleClose = vi.fn();

    render(
      <EditChannelModal
        isOpen={true}
        channel={mockChannel}
        roles={mockRoles}
        onClose={handleClose}
        onUpdateChannel={vi.fn()}
        onDeleteChannel={vi.fn()}
      />
    );

    const closeBtn = screen.getByTestId('edit-channel-close-btn');
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it('displays error banner when onUpdateChannel rejects with duplicate name error', async () => {
    const handleUpdate = vi.fn().mockRejectedValue(new Error('Já existe um canal com este nome neste servidor'));

    render(
      <EditChannelModal
        isOpen={true}
        channel={mockChannel}
        roles={mockRoles}
        onClose={vi.fn()}
        onUpdateChannel={handleUpdate}
        onDeleteChannel={vi.fn()}
      />
    );

    const saveBtn = screen.getByTestId('edit-channel-save-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByTestId('edit-channel-error')).toHaveTextContent(
        'Já existe um canal com este nome neste servidor'
      );
    });
  });
});
