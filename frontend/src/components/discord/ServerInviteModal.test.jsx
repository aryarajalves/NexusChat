import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ServerInviteModal from './ServerInviteModal';
import { ToastProvider } from '../../context/ToastContext';

describe('ServerInviteModal Component', () => {
  const mockServer = { id: 1, name: 'Servidor Teste' };

  it('renders modal and generates invite code automatically once', async () => {
    const handleCreateInvite = vi.fn().mockResolvedValue({ code: 'inv-abc-123' });

    render(
      <ToastProvider>
        <ServerInviteModal
          isOpen={true}
          onClose={vi.fn()}
          server={mockServer}
          onCreateInvite={handleCreateInvite}
        />
      </ToastProvider>
    );

    expect(screen.getByText('Convidar amigos para Servidor Teste')).toBeInTheDocument();
    await waitFor(() => {
      expect(handleCreateInvite).toHaveBeenCalledTimes(1);
    });

    const input = screen.getByTestId('invite-link-input');
    expect(input.value).toContain('inv-abc-123');
  });

  it('handles generation failure without infinite loop and displays retry button', async () => {
    const handleCreateInvite = vi.fn().mockRejectedValue(new Error('Falha ao gerar'));

    render(
      <ToastProvider>
        <ServerInviteModal
          isOpen={true}
          onClose={vi.fn()}
          server={mockServer}
          onCreateInvite={handleCreateInvite}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(handleCreateInvite).toHaveBeenCalledTimes(1);
    });

    // Erro é exibido e botão de tentar novamente aparece
    await waitFor(() => {
      expect(screen.getByTestId('retry-invite-btn')).toBeInTheDocument();
      expect(screen.getByTestId('invite-link-input')).toHaveValue('Não foi possível gerar o link');
    });

    // Não chamou em loop (apenas 1 vez)
    expect(handleCreateInvite).toHaveBeenCalledTimes(1);

    // Toast de erro apareceu apenas 1 vez (sem enxurrada de toasts)
    expect(screen.getAllByText('Falha ao gerar link de convite.').length).toBe(1);

    // Ao clicar em tentar novamente, tenta gerar mais uma vez
    handleCreateInvite.mockResolvedValueOnce({ code: 'inv-sucesso-novo' });
    fireEvent.click(screen.getByTestId('retry-invite-btn'));

    await waitFor(() => {
      expect(handleCreateInvite).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId('invite-link-input').value).toContain('inv-sucesso-novo');
    });
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <ToastProvider>
        <ServerInviteModal
          isOpen={true}
          onClose={handleClose}
          server={mockServer}
          onCreateInvite={vi.fn().mockResolvedValue({ code: 'test' })}
        />
      </ToastProvider>
    );

    fireEvent.click(screen.getByTestId('invite-close-btn'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
