import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  RefreshCw,
  Cpu,
  Database,
  Bell
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { getInfrastructureOverviewApi, getAlertConfigApi } from './infrastructureApi';
import InfrastructureResourcesTab from './InfrastructureResourcesTab';
import InfrastructureDatabaseTab from './InfrastructureDatabaseTab';
import InfrastructureAlertsTab from './InfrastructureAlertsTab';

export default function InfrastructureManagement({ currentUser }) {
  const [activeSubTab, setActiveSubTab] = useState('resources'); // 'resources' | 'database' | 'alerts'
  const [overview, setOverview] = useState(null);
  const [alertConfig, setAlertConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { addToast } = useToast();

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [overviewData, configData] = await Promise.all([
        getInfrastructureOverviewApi(),
        getAlertConfigApi(),
      ]);
      setOverview(overviewData);
      setAlertConfig(configData);
      if (isRefresh) {
        addToast('Métricas de infraestrutura atualizadas!', 'success');
      }
    } catch (err) {
      addToast(err.message || 'Erro ao carregar métricas de infraestrutura.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const ramBadge = overview?.hardware ? `${overview.hardware.ram_pct}% RAM` : '...';
  const poolBadge = overview?.database ? `${overview.database.occupancy_pct}% Pool` : '...';
  const alertBadge = overview?.alert_badge || 'Inativo';

  return (
    <div
      className="backup-page-container"
      data-testid="infrastructure-management-view"
      style={{
        padding: '24px 32px',
        maxWidth: '1240px',
        margin: '0 auto',
      }}
    >
      {/* Cabeçalho do Painel alinhado com o Design System do Projeto Base */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div
            style={{
              background: '#e0f2fe',
              border: '1px solid #bae6fd',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Server size={24} color="#0284c7" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.3px' }}>
              Infraestrutura & Recursos do Servidor
            </h1>
            <p style={{ margin: '5px 0 0 0', fontSize: '13.5px', color: '#64748b' }}>
              Painel organizado por abas com métricas de RAM, CPU, Conexões do PostgreSQL e Webhooks de notificação (Horário Oficial de Brasília).
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={refreshing || loading}
          data-testid="refresh-infra-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 18px',
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            fontSize: '13.5px',
            fontWeight: 600,
            color: '#0f172a',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.2s ease',
          }}
        >
          <RefreshCw size={15} color="#0284c7" className={refreshing ? 'spin-icon' : ''} />
          <span>{refreshing ? 'Atualizando...' : 'Atualizar'}</span>
        </button>
      </div>

      {/* Sub-Abas com Estilo Light / Theme Projeto Base */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveSubTab('resources')}
          data-testid="subtab-resources"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '11px 20px',
            background: activeSubTab === 'resources' ? '#e0f2fe' : '#ffffff',
            border: `1px solid ${activeSubTab === 'resources' ? '#bae6fd' : '#e2e8f0'}`,
            borderRadius: '12px',
            color: activeSubTab === 'resources' ? '#0284c7' : '#64748b',
            fontWeight: 700,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: activeSubTab === 'resources' ? '0 1px 4px rgba(2, 132, 199, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.2s ease',
          }}
        >
          <Cpu size={17} color={activeSubTab === 'resources' ? '#0284c7' : '#64748b'} />
          <span>Recursos do Servidor (RAM & CPU)</span>
          <span
            style={{
              background: activeSubTab === 'resources' ? '#0284c7' : '#f1f5f9',
              color: activeSubTab === 'resources' ? '#ffffff' : '#64748b',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '20px',
            }}
          >
            {ramBadge}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('database')}
          data-testid="subtab-database"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '11px 20px',
            background: activeSubTab === 'database' ? '#e0f2fe' : '#ffffff',
            border: `1px solid ${activeSubTab === 'database' ? '#bae6fd' : '#e2e8f0'}`,
            borderRadius: '12px',
            color: activeSubTab === 'database' ? '#0284c7' : '#64748b',
            fontWeight: 700,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: activeSubTab === 'database' ? '0 1px 4px rgba(2, 132, 199, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.2s ease',
          }}
        >
          <Database size={17} color={activeSubTab === 'database' ? '#0284c7' : '#64748b'} />
          <span>Conexões & Banco (PostgreSQL)</span>
          <span
            style={{
              background: activeSubTab === 'database' ? '#0284c7' : '#f1f5f9',
              color: activeSubTab === 'database' ? '#ffffff' : '#64748b',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '20px',
            }}
          >
            {poolBadge}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('alerts')}
          data-testid="subtab-alerts"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '11px 20px',
            background: activeSubTab === 'alerts' ? '#e0f2fe' : '#ffffff',
            border: `1px solid ${activeSubTab === 'alerts' ? '#bae6fd' : '#e2e8f0'}`,
            borderRadius: '12px',
            color: activeSubTab === 'alerts' ? '#0284c7' : '#64748b',
            fontWeight: 700,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: activeSubTab === 'alerts' ? '0 1px 4px rgba(2, 132, 199, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.2s ease',
          }}
        >
          <Bell size={17} color={activeSubTab === 'alerts' ? '#0284c7' : '#64748b'} />
          <span>Configurações de Alertas (Webhook)</span>
          <span
            style={{
              background: alertBadge === 'Ativo' ? '#dcfce7' : '#f1f5f9',
              color: alertBadge === 'Ativo' ? '#15803d' : '#64748b',
              border: alertBadge === 'Ativo' ? '1px solid #bbf7d0' : 'none',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '20px',
            }}
          >
            {alertBadge}
          </span>
        </button>
      </div>

      {/* Conteúdo da Sub-Aba Ativa */}
      {loading ? (
        <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={30} color="#0284c7" className="spin-icon" style={{ margin: '0 auto 12px' }} />
          <div>Carregando métricas de infraestrutura...</div>
        </div>
      ) : (
        <>
          {activeSubTab === 'resources' && (
            <InfrastructureResourcesTab hardware={overview?.hardware} alertConfig={alertConfig} />
          )}

          {activeSubTab === 'database' && (
            <InfrastructureDatabaseTab database={overview?.database} />
          )}

          {activeSubTab === 'alerts' && (
            <InfrastructureAlertsTab
              config={alertConfig}
              onUpdated={(newCfg) => setAlertConfig(newCfg)}
              addToast={addToast}
            />
          )}
        </>
      )}
    </div>
  );
}
