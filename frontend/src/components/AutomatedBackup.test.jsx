import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AutomatedBackup from './AutomatedBackup';
import { ToastProvider } from '../context/ToastContext';

describe('AutomatedBackup Component', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('auth_token', 'mock_token');
    vi.restoreAllMocks();
  });

  const mockStats = {
    last_backup_filename: 'vturb_backup_2026_09_24_11_34_45.dump.gz',
    last_backup_date: '2026-09-24T14:34:45Z',
    next_backup_date: '2026-09-24T20:54:00Z',
    frequency_label: 'A cada 6 hora(s)',
    current_count: 1,
    retention_max: 30,
    total_bytes_used: 2181,
    total_size_formatted: '2.13 KB utilizados',
    b2_connected: true,
    b2_status: 'Conectado',
    b2_bucket: 'meu-bucket',
  };

  const mockBackups = [
    {
      id: 1,
      filename: 'vturb_backup_2026_09_24_11_34_45.dump.gz',
      s3_key: 'projetobase/backups/vturb_backup_2026_09_24_11_34_45.dump.gz',
      file_size_bytes: 2181,
      file_size_formatted: '2.13 KB',
      backup_type: 'automatic',
      status: 'success',
      created_at: '2026-09-24T14:34:45Z',
    },
  ];

  const mockSchedule = {
    id: 1,
    is_active: true,
    frequency: '6h',
    destination_folder: 'projetobase/backups/',
    retention_max: 30,
  };

  const setupFetchMock = () => {
    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url.includes('/dashboard-stats')) {
        return Promise.resolve({ ok: true, json: async () => mockStats });
      }
      if (url.includes('/backups/list')) {
        return Promise.resolve({ ok: true, json: async () => mockBackups });
      }
      if (url.includes('/backups/schedule') && options?.method === 'PUT') {
        return Promise.resolve({ ok: true, json: async () => mockSchedule });
      }
      if (url.includes('/backups/schedule')) {
        return Promise.resolve({ ok: true, json: async () => mockSchedule });
      }
      if (url.includes('/backups/manual') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: 2,
            filename: 'vturb_backup_manual.dump.gz',
            s3_key: 'projetobase/backups/vturb_backup_manual.dump.gz',
            file_size_bytes: 3000,
            backup_type: 'manual',
            status: 'success',
            created_at: new Date().toISOString(),
          }),
        });
      }
      if (url.includes('/backups/1') && options?.method === 'DELETE') {
        return Promise.resolve({ ok: true, json: async () => ({ message: 'Backup excluído' }) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });
  };

  it('renders top 4 metrics cards correctly', async () => {
    setupFetchMock();
    render(
      <ToastProvider>
        <AutomatedBackup currentUser={{ role: 'superadmin' }} />
      </ToastProvider>
    );

    expect(await screen.findByTestId('metric-last-backup')).toBeInTheDocument();
    expect(screen.getByTestId('metric-next-backup')).toBeInTheDocument();
    expect(screen.getByTestId('metric-retention')).toBeInTheDocument();
    expect(screen.getByTestId('metric-b2-status')).toBeInTheDocument();

    expect(screen.getByText('1 / máx 30')).toBeInTheDocument();
    expect(screen.getByText('Conectado')).toBeInTheDocument();
    expect(screen.getByText('A cada 6 hora(s)')).toBeInTheDocument();
  });

  it('renders the 3 sub-tabs and allows switching between them', async () => {
    setupFetchMock();
    render(
      <ToastProvider>
        <AutomatedBackup currentUser={{ role: 'superadmin' }} />
      </ToastProvider>
    );

    const s3TabBtn = screen.getByTestId('tab-s3-btn');
    const scheduleTabBtn = screen.getByTestId('tab-schedule-btn');
    const importTabBtn = screen.getByTestId('tab-import-btn');

    expect(s3TabBtn).toBeInTheDocument();
    expect(scheduleTabBtn).toBeInTheDocument();
    expect(importTabBtn).toBeInTheDocument();

    // Inicia na aba S3
    expect(screen.getByTestId('backups-s3-tab-content')).toBeInTheDocument();
    const filterSelect = screen.getByTestId('filter-backup-type-select');
    expect(filterSelect).toBeInTheDocument();
    expect(filterSelect).toHaveClass('form-control-modern');

    // Troca para agendamento
    fireEvent.click(scheduleTabBtn);
    expect(screen.getByTestId('schedule-tab-content')).toBeInTheDocument();
    expect(screen.getByTestId('schedule-active-toggle')).toBeInTheDocument();

    const frequencySelect = screen.getByTestId('frequency-select');
    expect(frequencySelect).toBeInTheDocument();
    expect(frequencySelect).toHaveClass('form-control-modern');
    expect(frequencySelect.value).toBe('6h');

    // Troca para importação externa
    fireEvent.click(importTabBtn);
    expect(screen.getByTestId('import-tab-content')).toBeInTheDocument();
    expect(screen.getByTestId('dropzone-upload-area')).toBeInTheDocument();
  });

  it('opens manual backup modal, allows custom name input, and triggers backup', async () => {
    setupFetchMock();
    render(
      <ToastProvider>
        <AutomatedBackup currentUser={{ role: 'superadmin' }} />
      </ToastProvider>
    );

    // Clica em "Fazer Backup Agora" no banner
    const triggerBtn = await screen.findByTestId('trigger-manual-backup-btn');
    fireEvent.click(triggerBtn);

    // Modal de backup manual deve abrir
    const modalContent = screen.getByTestId('manual-backup-modal-content');
    expect(modalContent).toBeInTheDocument();
    expect(screen.getByText('Fazer Backup Manual')).toBeInTheDocument();

    // Preenche nome customizado do backup
    const nameInput = screen.getByTestId('backup-custom-name-input');
    fireEvent.change(nameInput, { target: { value: 'backup_antes_do_deploy' } });
    expect(nameInput.value).toBe('backup_antes_do_deploy');

    // Clica em "Iniciar Backup"
    const submitBtn = screen.getByTestId('submit-manual-backup-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/backups/manual'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ custom_name: 'backup_antes_do_deploy' }),
        })
      );
    });

    // Clica no botão de excluir da linha
    const deleteBtn = await screen.findByTestId('delete-backup-btn-1');
    fireEvent.click(deleteBtn);

    // Modal de confirmação deve abrir no centro
    const confirmModalContent = screen.getByTestId('backup-confirm-modal-content');
    expect(confirmModalContent).toBeInTheDocument();
    expect(screen.getByText('Excluir Arquivo de Backup')).toBeInTheDocument();

    // Clicar fora não fecha o modal
    const overlay = screen.getByTestId('backup-confirm-modal-overlay');
    fireEvent.click(overlay);
    expect(screen.getByTestId('backup-confirm-modal-content')).toBeInTheDocument();

    // Confirmar exclusão
    const confirmBtn = screen.getByTestId('confirm-backup-modal-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByTestId('backup-confirm-modal-content')).not.toBeInTheDocument();
    });
  });

  it('opens rename modal, updates backup name and sends PATCH request', async () => {
    setupFetchMock();
    render(
      <ToastProvider>
        <AutomatedBackup currentUser={{ role: 'superadmin' }} />
      </ToastProvider>
    );

    // Clica no botão de renomear da linha
    const renameBtn = await screen.findByTestId('rename-backup-btn-1');
    fireEvent.click(renameBtn);

    // Modal de renomeação deve abrir
    const renameModalContent = screen.getByTestId('rename-backup-modal-content');
    expect(renameModalContent).toBeInTheDocument();
    expect(screen.getByText('Renomear Backup')).toBeInTheDocument();

    // Altera o nome no input
    const input = screen.getByTestId('backup-rename-input');
    fireEvent.change(input, { target: { value: 'meu_backup_renomeado' } });
    expect(input.value).toBe('meu_backup_renomeado');

    // Clica fora não fecha o modal
    const overlay = screen.getByTestId('rename-backup-modal-overlay');
    fireEvent.click(overlay);
    expect(screen.getByTestId('rename-backup-modal-content')).toBeInTheDocument();

    // Salvar
    const submitBtn = screen.getByTestId('submit-rename-backup-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/backups/1/rename'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ new_name: 'meu_backup_renomeado' }),
        })
      );
    });
  });
});
