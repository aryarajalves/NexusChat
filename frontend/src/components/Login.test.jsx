import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Login from './Login';
import { ToastProvider } from '../context/ToastContext';

describe('Login Component', () => {
  it('renders login form with email, password and submit button', () => {
    render(
      <ToastProvider>
        <Login />
      </ToastProvider>
    );
    expect(screen.getByText('NexusChat')).toBeInTheDocument();
    expect(screen.getByTestId('login-email-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-password-input')).toBeInTheDocument();
    expect(screen.getByTestId('login-submit-btn')).toBeInTheDocument();
  });

  it('toggles password visibility when clicking eye button', () => {
    render(
      <ToastProvider>
        <Login />
      </ToastProvider>
    );
    const passwordInput = screen.getByTestId('login-password-input');
    const toggleBtn = screen.getByTestId('toggle-password-visibility');

    expect(passwordInput).toHaveAttribute('type', 'password');
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');
    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('updates email and password inputs correctly when user types inside input-wrapper', () => {
    render(
      <ToastProvider>
        <Login />
      </ToastProvider>
    );
    const emailInput = screen.getByTestId('login-email-input');
    const passwordInput = screen.getByTestId('login-password-input');

    expect(emailInput.closest('.input-wrapper')).toBeInTheDocument();
    expect(passwordInput.closest('.input-wrapper')).toBeInTheDocument();

    fireEvent.change(emailInput, { target: { value: 'usuario@exemplo.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Senha@123456' } });

    expect(emailInput.value).toBe('usuario@exemplo.com');
    expect(passwordInput.value).toBe('Senha@123456');
  });
});
