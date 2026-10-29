import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LogManagement from './LogManagement';
import { ToastProvider } from '../context/ToastContext';

describe('LogManagement Component', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('auth_token', 'mock_token');
    vi.restoreAllMocks();
  });

  const mockLogsBackend = {
    service: 'backend',
    container: 'nexus_chat_backend',
    available: true,
    logs: [
      '[INFO] [nexus_chat]: Servidor iniciado com sucesso.',
      '[WARNING] [nexus_chat]: Conexão lenta detectada.',
      '[ERROR] [nexus_chat]: Falha simulada para teste de log.',
    ],
    total_lines: 3,
    error: null,
  };

  const mockLogsFrontend = {
    service: 'frontend',
    container: 'nexus_chat_frontend',
    available: true,
    logs: [
      '172.31.0.1 - - [29/Sep/2026:17:59:35 +0000] "GET /assets/index.js HTTP/1.1" 200 450',
      '172.31.0.1 - - [29/Sep/2026:17:59:40 +0000] "GET /api/v1/unknown HTTP/1.1" 404 120',
    ],
    total_lines: 2,
    error: null,
  };

  const setupFetchMock = () => {
    global.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/logs/frontend')) {
        return Promise.resolve({ ok: true, json: async () => mockLogsFrontend });
      }
      return Promise.resolve({ ok: true, json: async () => mockLogsBackend });
    });
  };

  it('renders log management header and only backend/frontend service tabs (no postgres)', async () => {
    setupFetchMock();
    render(
      <ToastProvider>
        <LogManagement currentUser={{ role: 'superadmin' }} />
      </ToastProvider>
    );

    expect(screen.getByText('Gerenciamento de logs')).toBeInTheDocument();
    expect(screen.getByTestId('tab-service-backend')).toBeInTheDocument();
    expect(screen.getByTestId('tab-service-frontend')).toBeInTheDocument();
    // Confirma explicitamente que a aba do PostgreSQL foi removida
    expect(screen.queryByTestId('tab-service-db')).not.toBeInTheDocument();

    // Aguarda carregar logs do backend
    await waitFor(() => {
      expect(screen.getByText(/Servidor iniciado com sucesso/)).toBeInTheDocument();
      expect(screen.getByText(/Falha simulada para teste de log/)).toBeInTheDocument();
    });
  });

  it('renders log type filter bar with categories and badges', async () => {
    setupFetchMock();
    render(
      <ToastProvider>
        <LogManagement currentUser={{ role: 'superadmin' }} />
      </ToastProvider>
    );

    expect(screen.getByTestId('log-type-filter-bar')).toBeInTheDocument();
    expect(screen.getByTestId('filter-btn-all')).toBeInTheDocument();
    expect(screen.getByTestId('filter-btn-info')).toBeInTheDocument();
    expect(screen.getByTestId('filter-btn-warning')).toBeInTheDocument();
    expect(screen.getByTestId('filter-btn-error')).toBeInTheDocument();
    expect(screen.getByTestId('filter-btn-http')).toBeInTheDocument();

    // Aguarda carregar e verificar badges
    await waitFor(() => {
      expect(screen.getByTestId('badge-log-error')).toHaveTextContent('ERRO');
      expect(screen.getByTestId('badge-log-warning')).toHaveTextContent('AVISO');
      expect(screen.getByTestId('badge-log-info')).toHaveTextContent('INFO');
    });
  });

  it('filters logs by type when clicking filter buttons', async () => {
    setupFetchMock();
    render(
      <ToastProvider>
        <LogManagement currentUser={{ role: 'superadmin' }} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Servidor iniciado com sucesso/)).toBeInTheDocument();
    });

    // Clica no filtro "Erros"
    const errorFilterBtn = screen.getByTestId('filter-btn-error');
    fireEvent.click(errorFilterBtn);

    // Apenas a linha de erro deve aparecer
    expect(screen.getByText(/Falha simulada para teste de log/)).toBeInTheDocument();
    expect(screen.queryByText(/Servidor iniciado com sucesso/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Conexão lenta detectada/)).not.toBeInTheDocument();

    // Clica no filtro "Avisos"
    const warnFilterBtn = screen.getByTestId('filter-btn-warning');
    fireEvent.click(warnFilterBtn);

    expect(screen.getByText(/Conexão lenta detectada/)).toBeInTheDocument();
    expect(screen.queryByText(/Falha simulada para teste de log/)).not.toBeInTheDocument();
  });

  it('switches container to frontend and displays HTTP logs with Brasilia time', async () => {
    setupFetchMock();
    render(
      <ToastProvider>
        <LogManagement currentUser={{ role: 'superadmin' }} />
      </ToastProvider>
    );

    const frontTab = screen.getByTestId('tab-service-frontend');
    fireEvent.click(frontTab);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/logs/frontend'),
        expect.anything()
      );
      // Confirma que 17:59 UTC foi exibido como 14:59 (Horário de Brasília)
      expect(screen.getByText(/14:59:35/)).toBeInTheDocument();
      expect(screen.getByText(/HTTP 200/)).toBeInTheDocument();
    });
  });

  it('filters logs by text search input', async () => {
    setupFetchMock();
    render(
      <ToastProvider>
        <LogManagement currentUser={{ role: 'superadmin' }} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Servidor iniciado com sucesso/)).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId('log-search-input');
    fireEvent.change(searchInput, { target: { value: 'Falha simulada' } });

    expect(screen.getByText(/Falha simulada para teste de log/)).toBeInTheDocument();
    expect(screen.queryByText(/Servidor iniciado com sucesso/)).not.toBeInTheDocument();
  });

  it('copies filtered logs to clipboard', async () => {
    setupFetchMock();
    const writeTextMock = vi.fn().mockResolvedValue();
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <ToastProvider>
        <LogManagement currentUser={{ role: 'superadmin' }} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Servidor iniciado com sucesso/)).toBeInTheDocument();
    });

    const copyBtn = screen.getByTestId('copy-logs-btn');
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalled();
  });

  it('filters logs by date and time when clicking apply date filter button', async () => {
    setupFetchMock();
    render(
      <ToastProvider>
        <LogManagement currentUser={{ role: 'superadmin' }} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Servidor iniciado com sucesso/)).toBeInTheDocument();
    });

    const dateInput = screen.getByTestId('log-date-input');
    const startTimeInput = screen.getByTestId('log-start-time-input');
    const endTimeInput = screen.getByTestId('log-end-time-input');

    fireEvent.change(dateInput, { target: { value: '2026-09-29' } });
    fireEvent.change(startTimeInput, { target: { value: '14:00' } });
    fireEvent.change(endTimeInput, { target: { value: '16:00' } });

    const applyBtn = screen.getByTestId('apply-date-filter-btn');
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('date=2026-09-29'),
        expect.anything()
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('start_time=14%3A00'),
        expect.anything()
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('end_time=16%3A00'),
        expect.anything()
      );
    });

    // Limpar filtros de data
    const clearBtn = screen.getByTestId('clear-date-filter-btn');
    fireEvent.click(clearBtn);

    await waitFor(() => {
      expect(dateInput).toHaveValue('');
      expect(startTimeInput).toHaveValue('');
      expect(endTimeInput).toHaveValue('');
    });
  });

  it('allows toggling between light theme and dark theme for terminal', async () => {
    setupFetchMock();
    render(
      <ToastProvider>
        <LogManagement currentUser={{ role: 'superadmin' }} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Servidor iniciado com sucesso/)).toBeInTheDocument();
    });

    const themeToggleBtn = screen.getByTestId('toggle-terminal-theme-btn');
    expect(themeToggleBtn).toHaveTextContent('Tema Claro');

    fireEvent.click(themeToggleBtn);
    expect(themeToggleBtn).toHaveTextContent('Tema Escuro');

    fireEvent.click(themeToggleBtn);
    expect(themeToggleBtn).toHaveTextContent('Tema Claro');
  });
});
