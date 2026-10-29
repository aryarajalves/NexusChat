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
  const [activeSubTab, setActiveSubTab] = useState(() => {
    return localStorage.getItem('active_subtab_infrastructure') || 'resources';
  });
  const [overview, setOverview] = useState(null);
  const [alertConfig, setAlertConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { addToast } = useToast();

  const handleSelectSubTab = (tab) => {
    setActiveSubTab(tab);
    localStorage.setItem('active_subtab_infrastructure', tab);
  };

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
              background: '#2b2d31',
              border: '1px solid #35373c',
              borderRadius: '12px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Server size={24} color="#5865f2" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#f2f3f5', letterSpacing: '-0.3px' }}>
              Infraestrutura & Recursos do Servidor
            </h1>
            <p style={{ margin: '5px 0 0 0', fontSize: '13.5px', color: '#949ba4' }}>
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
            background: '#2b2d31',
            border: '1px solid #35373c',
            borderRadius: '10px',
            fontSize: '13.5px',
            fontWeight: 600,
            color: '#f2f3f5',
            cursor: refreshing ? 'not-allowed' : 'pointer',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.2s ease',
          }}
        >
          <RefreshCw size={15} color="#5865f2" className={refreshing ? 'spin-icon' : ''} />
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
          onClick={() => handleSelectSubTab('resources')}
          data-testid="subtab-resources"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '11px 20px',
            background: activeSubTab === 'resources' ? '#5865f2' : '#2b2d31',
            border: `1px solid ${activeSubTab === 'resources' ? '#5865f2' : '#35373c'}`,
            borderRadius: '12px',
            color: activeSubTab === 'resources' ? '#ffffff' : '#949ba4',
            fontWeight: 700,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: activeSubTab === 'resources' ? '0 1px 4px rgba(2, 132, 199, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.2s ease',
          }}
        >
          <Cpu size={17} color={activeSubTab === 'resources' ? '#ffffff' : '#949ba4'} />
          <span>Recursos do Servidor (RAM & CPU)</span>
          <span
            style={{
              background: activeSubTab === 'resources' ? 'rgba(255,255,255,0.2)' : '#1e1f22',
              color: activeSubTab === 'resources' ? '#ffffff' : '#dbdee1',
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
          onClick={() => handleSelectSubTab('database')}
          data-testid="subtab-database"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '11px 20px',
            background: activeSubTab === 'database' ? '#5865f2' : '#2b2d31',
            border: `1px solid ${activeSubTab === 'database' ? '#5865f2' : '#35373c'}`,
            borderRadius: '12px',
            color: activeSubTab === 'database' ? '#ffffff' : '#949ba4',
            fontWeight: 700,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: activeSubTab === 'database' ? '0 1px 4px rgba(2, 132, 199, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.2s ease',
          }}
        >
          <Database size={17} color={activeSubTab === 'database' ? '#ffffff' : '#949ba4'} />
          <span>Conexões & Banco (PostgreSQL)</span>
          <span
            style={{
              background: activeSubTab === 'database' ? 'rgba(255,255,255,0.2)' : '#1e1f22',
              color: activeSubTab === 'database' ? '#ffffff' : '#dbdee1',
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
          onClick={() => handleSelectSubTab('alerts')}
          data-testid="subtab-alerts"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '11px 20px',
            background: activeSubTab === 'alerts' ? '#5865f2' : '#2b2d31',
            border: `1px solid ${activeSubTab === 'alerts' ? '#5865f2' : '#35373c'}`,
            borderRadius: '12px',
            color: activeSubTab === 'alerts' ? '#ffffff' : '#949ba4',
            fontWeight: 700,
            fontSize: '13.5px',
            cursor: 'pointer',
            boxShadow: activeSubTab === 'alerts' ? '0 1px 4px rgba(2, 132, 199, 0.15)' : '0 1px 2px rgba(0,0,0,0.03)',
            transition: 'all 0.2s ease',
          }}
        >
          <Bell size={17} color={activeSubTab === 'alerts' ? '#ffffff' : '#949ba4'} />
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
