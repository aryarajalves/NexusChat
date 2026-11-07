import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Sidebar from './Sidebar';

describe('Sidebar Component', () => {
  it('renders "NexusChat" title and logo', () => {
    render(<Sidebar />);
    expect(screen.getByText('NexusChat')).toBeInTheDocument();
    expect(screen.getByTestId('logo-icon')).toBeInTheDocument();
  });

  it('renders categories "APLICAÇÃO", "GESTÃO" and "INFRAESTRUTURA & DADOS" for superadmin', () => {
    const superAdminUser = { name: 'Super Admin', email: 'admin@test.com', role: 'superadmin' };
    render(<Sidebar user={superAdminUser} />);
    expect(screen.getByText('APLICAÇÃO')).toBeInTheDocument();
    expect(screen.getByText('GESTÃO')).toBeInTheDocument();
    expect(screen.getByText('INFRAESTRUTURA & DADOS')).toBeInTheDocument();
  });

  it('renders "Infraestrutura & Dados" and "Gestão de Usuário" buttons only for superadmin', () => {
    // Superadmin vê os botões
    const superAdminUser = { name: 'Super Admin', email: 'admin@test.com', role: 'superadmin' };
    const { unmount } = render(<Sidebar user={superAdminUser} />);
    expect(screen.queryByText('Meus vídeos')).not.toBeInTheDocument();
    expect(screen.getByText('Gestão de Usuário')).toBeInTheDocument();
    expect(screen.getByText('Infraestrutura & Dados')).toBeInTheDocument();
    expect(screen.queryByText('Backup Automático')).not.toBeInTheDocument();
    expect(screen.queryByText('Gerenciamento de logs')).not.toBeInTheDocument();
    unmount();

    // Usuário comum NÃO vê os botões de gestão e infraestrutura
    const regularUser = { name: 'Comum', email: 'comum@test.com', role: 'user' };
    render(<Sidebar user={regularUser} />);
    expect(screen.getByText('APLICAÇÃO')).toBeInTheDocument();
    expect(screen.queryByText('GESTÃO')).not.toBeInTheDocument();
    expect(screen.queryByText('INFRAESTRUTURA & DADOS')).not.toBeInTheDocument();
    expect(screen.queryByText('Gestão de Usuário')).not.toBeInTheDocument();
    expect(screen.queryByText('Infraestrutura & Dados')).not.toBeInTheDocument();
    expect(screen.queryByText('Backup Automático')).not.toBeInTheDocument();
    expect(screen.queryByText('Gerenciamento de logs')).not.toBeInTheDocument();
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

    const infraBtn = screen.getByTestId('nav-item-infrastructure');
    fireEvent.click(infraBtn);
    expect(onSelectTabMock).toHaveBeenCalledWith('infrastructure');
  });

  it('sets active class properly on "Infraestrutura & Dados" tab when activeTab is infrastructure, logs or backup', () => {
    const superAdminUser = { name: 'Super Admin', email: 'admin@test.com', role: 'superadmin' };
    const { rerender } = render(<Sidebar user={superAdminUser} activeTab="infrastructure" />);

    const infraBtn = screen.getByTestId('nav-item-infrastructure');
    expect(infraBtn).toHaveClass('active');
    expect(infraBtn).toHaveTextContent('Infraestrutura & Dados');

    // Logs also activates infrastructure tab
    rerender(<Sidebar user={superAdminUser} activeTab="logs" />);
    expect(screen.getByTestId('nav-item-infrastructure')).toHaveClass('active');

    // Backup also activates infrastructure tab
    rerender(<Sidebar user={superAdminUser} activeTab="backup" />);
    expect(screen.getByTestId('nav-item-infrastructure')).toHaveClass('active');
  });
});
