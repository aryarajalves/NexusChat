import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateUserModal from './CreateUserModal';
import { ToastProvider } from '../../context/ToastContext';
import * as api from './userManagementApi';

describe('CreateUserModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(
      <ToastProvider>
        <CreateUserModal isOpen={false} onClose={vi.fn()} onSuccess={vi.fn()} />
      </ToastProvider>
    );

    expect(screen.queryByTestId('create-user-modal-overlay')).not.toBeInTheDocument();
  });

  it('renders all form fields and requirements checklist when isOpen is true', () => {
    render(
      <ToastProvider>
        <CreateUserModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />
      </ToastProvider>
    );

    expect(screen.getByText('Criar Conta de Usuário')).toBeInTheDocument();
    expect(screen.getByTestId('create-user-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('create-user-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('create-user-role-select')).toBeInTheDocument();
    expect(screen.getByTestId('create-user-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('create-user-password-confirm-input')).toBeInTheDocument();

    // Checklist de requisitos
    expect(screen.getByTestId('rule-length')).toHaveClass('rule-unmet');
    expect(screen.getByTestId('rule-upper')).toHaveClass('rule-unmet');
    expect(screen.getByTestId('rule-lower')).toHaveClass('rule-unmet');
    expect(screen.getByTestId('rule-number')).toHaveClass('rule-unmet');
    expect(screen.getByTestId('rule-special')).toHaveClass('rule-unmet');
  });

  it('updates password checklist rules as user types strong password', () => {
    render(
      <ToastProvider>
        <CreateUserModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />
      </ToastProvider>
    );

    const passwordInput = screen.getByTestId('create-user-password-input');

    // Senha parcial (apenas letras minúsculas)
    fireEvent.change(passwordInput, { target: { value: 'senhafraca' } });
    expect(screen.getByTestId('rule-lower')).toHaveClass('rule-met');
    expect(screen.getByTestId('rule-length')).toHaveClass('rule-unmet');
    expect(screen.getByTestId('rule-upper')).toHaveClass('rule-unmet');

    // Senha completa atendendo a todos os requisitos
    fireEvent.change(passwordInput, { target: { value: 'MinhaSenhaForte123!@' } });
    expect(screen.getByTestId('rule-length')).toHaveClass('rule-met');
    expect(screen.getByTestId('rule-upper')).toHaveClass('rule-met');
    expect(screen.getByTestId('rule-lower')).toHaveClass('rule-met');
    expect(screen.getByTestId('rule-number')).toHaveClass('rule-met');
    expect(screen.getByTestId('rule-special')).toHaveClass('rule-met');
  });

  it('validates password match correctly', () => {
    render(
      <ToastProvider>
        <CreateUserModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />
      </ToastProvider>
    );

    const passwordInput = screen.getByTestId('create-user-password-input');
    const confirmInput = screen.getByTestId('create-user-password-confirm-input');

    fireEvent.change(passwordInput, { target: { value: 'MinhaSenhaForte123!@' } });
    fireEvent.change(confirmInput, { target: { value: 'Diferente123!@' } });

    expect(screen.getByTestId('password-match-status')).toHaveTextContent('✕ As senhas não coincidem');
    expect(screen.getByTestId('submit-create-user-btn')).toBeDisabled();

    fireEvent.change(confirmInput, { target: { value: 'MinhaSenhaForte123!@' } });
    expect(screen.getByTestId('password-match-status')).toHaveTextContent('✓ As senhas coincidem');
  });

  it('submits form successfully and calls onSuccess and onClose', async () => {
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    vi.spyOn(api, 'createUserManualApi').mockResolvedValueOnce({
      id: 99,
      name: 'Novo Usuário',
      email: 'novo@exemplo.com',
      role: 'user',
      is_active: true,
      created_at: new Date().toISOString(),
    });

    render(
      <ToastProvider>
        <CreateUserModal isOpen={true} onClose={handleClose} onSuccess={handleSuccess} />
      </ToastProvider>
    );

    fireEvent.change(screen.getByTestId('create-user-name-input'), { target: { value: 'Novo Usuário' } });
    fireEvent.change(screen.getByTestId('create-user-email-input'), { target: { value: 'novo@exemplo.com' } });
    fireEvent.change(screen.getByTestId('create-user-password-input'), { target: { value: 'MinhaSenhaForte123!@' } });
    fireEvent.change(screen.getByTestId('create-user-password-confirm-input'), { target: { value: 'MinhaSenhaForte123!@' } });

    const submitBtn = screen.getByTestId('submit-create-user-btn');
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.createUserManualApi).toHaveBeenCalledWith(
        {
          name: 'Novo Usuário',
          email: 'novo@exemplo.com',
          password: 'MinhaSenhaForte123!@',
          password_confirm: 'MinhaSenhaForte123!@',
          role: 'user',
        },
        null
      );
      expect(handleSuccess).toHaveBeenCalled();
      expect(handleClose).toHaveBeenCalled();
    });
  });

  it('displays error banner if API creation fails', async () => {
    vi.spyOn(api, 'createUserManualApi').mockRejectedValueOnce(
      new Error('Já existe um usuário cadastrado com este e-mail.')
    );

    render(
      <ToastProvider>
        <CreateUserModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} />
      </ToastProvider>
    );

    fireEvent.change(screen.getByTestId('create-user-name-input'), { target: { value: 'Novo Usuário' } });
    fireEvent.change(screen.getByTestId('create-user-email-input'), { target: { value: 'novo@exemplo.com' } });
    fireEvent.change(screen.getByTestId('create-user-password-input'), { target: { value: 'MinhaSenhaForte123!@' } });
    fireEvent.change(screen.getByTestId('create-user-password-confirm-input'), { target: { value: 'MinhaSenhaForte123!@' } });

    fireEvent.click(screen.getByTestId('submit-create-user-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('create-user-error-banner')).toHaveTextContent(
        'Já existe um usuário cadastrado com este e-mail.'
      );
    });
  });
});
