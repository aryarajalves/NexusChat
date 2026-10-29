import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DeleteMessageModal from './DeleteMessageModal';

describe('DeleteMessageModal Component', () => {
  const mockMessage = {
    id: 42,
    author_name: 'Alice',
    content: 'Mensagem de teste para deletar',
  };

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <DeleteMessageModal
        isOpen={false}
        message={mockMessage}
        onClose={vi.fn()}
        onConfirmDelete={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders modal with message preview and conforms to UX rules', () => {
    const handleClose = vi.fn();
    render(
      <DeleteMessageModal
        isOpen={true}
        message={mockMessage}
        onClose={handleClose}
        onConfirmDelete={vi.fn()}
      />
    );

    // Modal centralizado com backdrop escuro
    const backdrop = screen.getByTestId('delete-message-modal-backdrop');
    expect(backdrop).toBeInTheDocument();

    // NÃO fecha ao clicar no backdrop (regra de UX)
    fireEvent.click(backdrop);
    expect(handleClose).not.toHaveBeenCalled();

    // Exibe autor e conteúdo da mensagem a ser apagada
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Mensagem de teste para deletar')).toBeInTheDocument();

    // Possui exatamente 1 botão de cancelar/fechar + 1 botão de ação
    const cancelBtn = screen.getByTestId('cancel-delete-btn');
    const confirmBtn = screen.getByTestId('confirm-delete-btn');

    expect(cancelBtn).toHaveTextContent('Cancelar');
    expect(confirmBtn).toHaveTextContent('Apagar Mensagem');
  });

  it('calls onClose when cancel button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <DeleteMessageModal
        isOpen={true}
        message={mockMessage}
        onClose={handleClose}
        onConfirmDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('cancel-delete-btn'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirmDelete with message id when confirm button is clicked', async () => {
    const handleConfirm = vi.fn().mockResolvedValue({});
    const handleClose = vi.fn();

    render(
      <DeleteMessageModal
        isOpen={true}
        message={mockMessage}
        onClose={handleClose}
        onConfirmDelete={handleConfirm}
      />
    );

    await fireEvent.click(screen.getByTestId('confirm-delete-btn'));
    expect(handleConfirm).toHaveBeenCalledWith(42);
  });
});
