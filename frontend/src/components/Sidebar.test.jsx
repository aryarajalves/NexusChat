import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar';

describe('Sidebar Component', () => {
  it('renders "Projeto Base" title and logo', () => {
    render(<Sidebar />);
    expect(screen.getByText('Projeto Base')).toBeInTheDocument();
    expect(screen.getByTestId('logo-icon')).toBeInTheDocument();
  });

  it('renders "Backup Automático", "Gerenciamento de logs" and "Gestão de Usuário" buttons only for superadmin', () => {
    // Superadmin vê os botões
    const superAdminUser = { name: 'Super Admin', email: 'admin@test.com', role: 'superadmin' };
    const { unmount } = render(<Sidebar user={superAdminUser} />);
    expect(screen.queryByText('Meus vídeos')).not.toBeInTheDocument();
    expect(screen.getByText('Backup Automático')).toBeInTheDocument();
    expect(screen.getByText('Gerenciamento de logs')).toBeInTheDocument();
    expect(screen.getByText('Infraestrutura e Recursos')).toBeInTheDocument();
    expect(screen.getByText('Gestão de Usuário')).toBeInTheDocument();
    unmount();

    // Usuário comum NÃO vê os botões
    const regularUser = { name: 'Comum', email: 'comum@test.com', role: 'user' };
    render(<Sidebar user={regularUser} />);
    expect(screen.queryByText('Backup Automático')).not.toBeInTheDocument();
    expect(screen.queryByText('Gerenciamento de logs')).not.toBeInTheDocument();
    expect(screen.queryByText('Infraestrutura e Recursos')).not.toBeInTheDocument();
    expect(screen.queryByText('Gestão de Usuário')).not.toBeInTheDocument();
  });

  it('renders user profile details and logout button', () => {
    const handleLogout = vi.fn();
    const user = { name: 'Super Admin', email: 'aryarajmarketing@gmail.com', role: 'superadmin' };
    render(<Sidebar user={user} onLogout={handleLogout} />);

    expect(screen.getByText('Super Admin')).toBeInTheDocument();
    expect(screen.getByText('aryarajmarketing@gmail.com')).toBeInTheDocument();
    expect(screen.getByTestId('user-avatar')).toHaveTextContent('S');

    const logoutBtn = screen.getByTestId('logout-btn');
    fireEvent.click(logoutBtn);
    expect(handleLogout).toHaveBeenCalled();
  });

  it('allows clicking buttons and changing active state for superadmin', () => {
    const onSelectTabMock = vi.fn();
    const superAdminUser = { name: 'Super Admin', email: 'admin@test.com', role: 'superadmin' };
    render(<Sidebar user={superAdminUser} activeTab="users" onSelectTab={onSelectTabMock} />);

    const backupBtn = screen.getByTestId('nav-item-backup');
    fireEvent.click(backupBtn);
    expect(onSelectTabMock).toHaveBeenCalledWith('backup');
  });

  it('sets active class properly on "Infraestrutura e Recursos" tab', () => {
    const superAdminUser = { name: 'Super Admin', email: 'admin@test.com', role: 'superadmin' };
    render(<Sidebar user={superAdminUser} activeTab="infrastructure" />);

    const infraBtn = screen.getByTestId('nav-item-infrastructure');
    expect(infraBtn).toHaveClass('active');
    expect(infraBtn).toHaveTextContent('Infraestrutura e Recursos');
  });
});
