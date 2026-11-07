import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardWelcome from './DashboardWelcome';

describe('DashboardWelcome Component', () => {
  const mockSuperAdmin = {
    id: 1,
    name: 'Aryaraj',
    email: 'aryarajmarketing@gmail.com',
    role: 'superadmin',
  };

  const mockUser = {
    id: 2,
    name: 'Membro Normal',
    email: 'membro@teste.com',
    role: 'user',
  };

  it('renders welcome card, user greeting, and platform active badge', () => {
    render(<DashboardWelcome user={mockSuperAdmin} onSelectTab={vi.fn()} />);

    expect(screen.getByTestId('dashboard-welcome-container')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-welcome-card')).toBeInTheDocument();
    expect(screen.getByText(/Plataforma NexusChat Ativa/i)).toBeInTheDocument();
    expect(screen.getByText(/Olá, Aryaraj!/i)).toBeInTheDocument();
    expect(screen.getByText(/Acessar Comunidades \(Discord\)/i)).toBeInTheDocument();
  });

  it('calls onSelectTab with "discord" when main CTA button is clicked', () => {
    const onSelectTab = vi.fn();
    render(<DashboardWelcome user={mockSuperAdmin} onSelectTab={onSelectTab} />);

    const discordBtn = screen.getByTestId('welcome-enter-discord-btn');
    fireEvent.click(discordBtn);

    expect(onSelectTab).toHaveBeenCalledWith('discord');
  });

  it('does not render quick action buttons for any user', () => {
    const { rerender } = render(<DashboardWelcome user={mockSuperAdmin} onSelectTab={vi.fn()} />);

    expect(screen.queryByTestId('quick-action-users')).toBeNull();
    expect(screen.queryByTestId('quick-action-infrastructure')).toBeNull();
    expect(screen.queryByTestId('quick-action-logs')).toBeNull();
    expect(screen.queryByTestId('quick-action-backup')).toBeNull();
    expect(screen.queryByText(/Atalhos Rápidos de Gestão/i)).toBeNull();

    rerender(<DashboardWelcome user={mockUser} onSelectTab={vi.fn()} />);
    expect(screen.queryByTestId('quick-action-users')).toBeNull();
    expect(screen.queryByTestId('quick-action-infrastructure')).toBeNull();
    expect(screen.queryByText(/Olá, Membro Normal!/i)).toBeInTheDocument();
  });
});
