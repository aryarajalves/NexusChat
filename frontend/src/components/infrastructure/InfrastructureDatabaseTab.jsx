import React from 'react';
import { Database, Clock, Server } from 'lucide-react';

export default function InfrastructureDatabaseTab({ database }) {
  if (!database) return null;

  const getStatusBadge = (status) => {
    if (status === 'Crítico') {
      return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
    }
    if (status === 'Atenção') {
      return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
    }
    return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
  };

  const poolBadge = getStatusBadge(database.status);

  return (
    <div className="infra-tab-content" data-testid="infra-database-tab" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Grade de 3 Cards Superiores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {/* Card 1: Conexões em Uso Agora */}
        <div
          className="infra-card"
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <Database size={18} color="#0284c7" />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Conexões em Uso Agora</span>
              </div>
              <span
                style={{
                  background: poolBadge.bg,
                  color: poolBadge.text,
                  border: `1px solid ${poolBadge.border}`,
                  padding: '3px 11px',
                  borderRadius: '20px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                }}
              >
                ● {database.status}
              </span>
            </div>

            <div style={{ fontSize: '25px', fontWeight: 800, color: '#0f172a', marginBottom: '14px' }}>
              {database.active_connections}{' '}
              <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 500 }}>/ {database.pool_capacity}</span>{' '}
              <span style={{ fontSize: '16px', color: '#0284c7', fontWeight: 700 }}>({database.occupancy_pct}%)</span>
            </div>

            {/* Barra de Progresso */}
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
              <div
                style={{
                  width: `${Math.min(100, database.occupancy_pct)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                  borderRadius: '10px',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          <div style={{ fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
            <span>{database.idle_connections} conexões ociosas prontas no pool.</span>
          </div>
        </div>

        {/* Card 2: Maior Pico Registrado Hoje */}
        <div
          className="infra-card"
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <Clock size={18} color="#059669" />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Maior Pico Registrado Hoje</span>
              </div>
              <span
                style={{
                  background: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #bbf7d0',
                  padding: '3px 11px',
                  borderRadius: '20px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                }}
              >
                ✓ Pico Seguro
              </span>
            </div>

            <div style={{ fontSize: '25px', fontWeight: 800, color: '#0f172a', marginBottom: '14px' }}>
              {database.peak_connections_today}{' '}
              <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 500 }}>/ {database.pool_capacity}</span>{' '}
              <span style={{ fontSize: '16px', color: '#15803d', fontWeight: 700 }}>({database.peak_pct_today}%)</span>
            </div>

            {/* Barra de Progresso */}
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
              <div
                style={{
                  width: `${Math.min(100, database.peak_pct_today)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #059669, #34d399)',
                  borderRadius: '10px',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          <div style={{ fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
            <span>Horário do pico: <strong style={{ color: '#0f172a' }}>{database.peak_time_today}</strong></span>
          </div>
        </div>

        {/* Card 3: Capacidade do Servidor */}
        <div
          className="infra-card"
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '16px' }}>
            <Server size={18} color="#64748b" />
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Capacidade do Servidor</span>
          </div>

          <div>
            <div style={{ fontSize: '25px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
              {database.pool_capacity}{' '}
              <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>conexões simultâneas máx</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#334155' }}>
              <div>• Pool Base: <strong style={{ color: '#0f172a' }}>{database.pool_base} conexões abertas</strong></div>
              <div>• Overflow Reserva: <strong style={{ color: '#0f172a' }}>+{database.overflow_reserve} conexões temporárias</strong></div>
            </div>
          </div>
        </div>
      </div>

      {/* Histórico de Picos por Hora */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '22px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <Clock size={18} color="#0284c7" />
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Histórico de Picos por Hora (Horário de Brasília)</h4>
          </div>
          <span style={{ background: '#f1f5f9', color: '#64748b', padding: '4px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
            Últimas 24 Horas
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', color: '#64748b', background: '#f8fafc' }}>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Período / Hora (Brasília)</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Pico de Conexões</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Ocupação (%)</th>
                <th style={{ padding: '12px 14px', fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {database.history_24h && database.history_24h.length > 0 ? (
                database.history_24h.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', color: '#0f172a' }}>
                    <td style={{ padding: '13px 14px', fontWeight: 500 }}>{item.period}</td>
                    <td style={{ padding: '13px 14px', color: '#475569' }}>{item.peak_connections} ativas</td>
                    <td style={{ padding: '13px 14px', fontWeight: 700, color: '#0284c7' }}>{item.occupancy_pct}%</td>
                    <td style={{ padding: '13px 14px' }}>
                      <span style={{ color: '#15803d', fontWeight: 600, background: '#dcfce7', border: '1px solid #bbf7d0', padding: '3px 10px', borderRadius: '6px', fontSize: '11.5px' }}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                    Nenhum histórico registrado até o momento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
