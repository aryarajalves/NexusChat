import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InfrastructureManagement from './InfrastructureManagement';
import { ToastProvider } from '../../context/ToastContext';
import * as api from './infrastructureApi';

describe('InfrastructureManagement Component', () => {
  const mockOverview = {
    hardware: {
      ram_used_gb: 2.61,
      ram_total_gb: 11.54,
      ram_free_gb: 8.93,
      ram_pct: 22.6,
      api_container_mb: 152.4,
      ram_status: 'Saudável',
      cpu_pct: 5.6,
      vcpus: 16,
      cpu_status: 'Normal',
      peak_ram_pct: 22.6,
      peak_ram_details: '22.6% (2.61 GB)',
      peak_ram_recorded_at: '27/10/2026 14:08:46 (Horário de Brasília)',
      peak_cpu_pct: 5.6,
      peak_cpu_recorded_at: '27/10/2026 14:08:46 (Horário de Brasília)',
    },
    database: {
      active_connections: 7,
      pool_capacity: 50,
      pool_base: 20,
      overflow_reserve: 30,
      occupancy_pct: 14.0,
      idle_connections: 3,
      status: 'Saudável',
      peak_connections_today: 7,
      peak_pct_today: 14.0,
      peak_time_today: '27/10/2026 14:08:46 (Horário de Brasília)',
      history_24h: [
        {
          period: '22/10/2026 18:00',
          peak_connections: 1,
          pool_capacity: 50,
          occupancy_pct: 3.3,
          status: 'Normal',
        },
      ],
    },
    alert_badge: 'Inativo',
  };

  const mockConfig = {
    pool_alert_enabled: true,
    pool_alert_threshold: 75,
    ram_alert_enabled: true,
    ram_alert_threshold: 80,
    cpu_alert_enabled: true,
    cpu_alert_threshold: 85,
    cooldown_minutes: 15,
    webhook_url: '',
    notify_normalized: true,
    is_active: false,
  };

  const renderComponent = (props = { currentUser: { role: 'superadmin' } }) => {
    return render(
      <ToastProvider>
        <InfrastructureManagement {...props} />
      </ToastProvider>
    );
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'getInfrastructureOverviewApi').mockResolvedValue(mockOverview);
    vi.spyOn(api, 'getAlertConfigApi').mockResolvedValue(mockConfig);
    vi.spyOn(api, 'updateAlertConfigApi').mockResolvedValue({ ...mockConfig, pool_alert_threshold: 80 });
    vi.spyOn(api, 'testWebhookApi').mockResolvedValue({ success: true, message: 'Webhook testado com sucesso!' });
  });

  it('renders overview header, hardware metrics and badges correctly', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Carregando métricas de infraestrutura...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Infraestrutura & Recursos do Servidor')).toBeInTheDocument();
    expect(screen.getByText('2.61 GB')).toBeInTheDocument();
    expect(screen.getAllByText(/5\.6%/).length).toBeGreaterThan(0);
    expect(screen.getByText('22.6% RAM')).toBeInTheDocument();
  });

  it('allows switching between subtabs (Database and Alerts)', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Carregando métricas de infraestrutura...')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('subtab-database'));
    await waitFor(() => {
      expect(screen.getByText('Conexões em Uso Agora')).toBeInTheDocument();
    });
    expect(screen.getByText('Maior Pico Registrado Hoje')).toBeInTheDocument();
    expect(screen.getByText(/conexões simultâneas máx/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('subtab-alerts'));
    await waitFor(() => {
      expect(screen.getByText('Central de Notificações e Webhooks')).toBeInTheDocument();
    });
  });

  it('triggers test webhook and saves configuration', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.queryByText('Carregando métricas de infraestrutura...')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('subtab-alerts'));

    await waitFor(() => {
      expect(screen.getByTestId('webhook-url-input')).toBeInTheDocument();
    });

    const input = screen.getByTestId('webhook-url-input');
    fireEvent.change(input, { target: { value: 'https://webhook.site/test-1234' } });

    const testBtn = screen.getByTestId('test-webhook-btn');
    fireEvent.click(testBtn);
    await waitFor(() => {
      expect(api.testWebhookApi).toHaveBeenCalledWith('https://webhook.site/test-1234');
    });

    const saveBtn = screen.getByTestId('save-alert-config-btn');
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(api.updateAlertConfigApi).toHaveBeenCalled();
    });
  });
});
