import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeleteServerModal from './DeleteServerModal';

describe('DeleteServerModal Component', () => {
  const mockServer = {
    id: 101,
    name: 'Servidor dos Devs',
    icon_url: 'https://example.com/icon.png',
  };

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <DeleteServerModal
        isOpen={false}
        server={mockServer}
        onClose={vi.fn()}
        onConfirmDelete={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('does not render when server is null', () => {
    const { container } = render(
      <DeleteServerModal
        isOpen={true}
        server={null}
        onClose={vi.fn()}
        onConfirmDelete={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with server preview and conforms to UX rules', () => {
    const handleClose = vi.fn();
    render(
      <DeleteServerModal
        isOpen={true}
        server={mockServer}
        onClose={handleClose}
        onConfirmDelete={vi.fn()}
      />
    );

    // Modal centralizado com backdrop escuro
    const backdrop = screen.getByTestId('delete-server-modal-backdrop');
    expect(backdrop).toBeInTheDocument();

    // NÃO fecha ao clicar no backdrop (regra estrita de UX)
    fireEvent.click(backdrop);
    expect(handleClose).not.toHaveBeenCalled();

    // Exibe nome do servidor no título/corpo
    expect(screen.getAllByText('Servidor dos Devs').length).toBeGreaterThan(0);
    expect(screen.getByText(/permanente e irreversível/i)).toBeInTheDocument();

    // Possui exatamente 1 botão de cancelar/fechar + 1 botão de confirmação
    const cancelBtn = screen.getByTestId('cancel-delete-server-btn');
    const confirmBtn = screen.getByTestId('confirm-delete-server-btn');

    expect(cancelBtn).toHaveTextContent('Cancelar');
    expect(confirmBtn).toHaveTextContent('Excluir Servidor');
  });

  it('calls onClose when cancel button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <DeleteServerModal
        isOpen={true}
        server={mockServer}
        onClose={handleClose}
        onConfirmDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('cancel-delete-server-btn'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirmDelete with server id and manages loading state', async () => {
    let resolveDelete;
    const deletePromise = new Promise((resolve) => {
      resolveDelete = resolve;
    });
    const handleConfirm = vi.fn().mockImplementation(() => deletePromise);

    render(
      <DeleteServerModal
        isOpen={true}
        server={mockServer}
        onClose={vi.fn()}
        onConfirmDelete={handleConfirm}
      />
    );

    const confirmBtn = screen.getByTestId('confirm-delete-server-btn');
    fireEvent.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledWith(101);
    expect(confirmBtn).toHaveTextContent('Excluindo...');
    expect(confirmBtn).toBeDisabled();

    // Finaliza a deleção
    resolveDelete({});
    await waitFor(() => {
      expect(confirmBtn).not.toBeDisabled();
    });
  });
});
