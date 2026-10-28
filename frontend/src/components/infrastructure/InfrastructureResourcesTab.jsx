import React from 'react';
import { HardDrive, Cpu, Zap, ShieldCheck } from 'lucide-react';

export default function InfrastructureResourcesTab({ hardware, alertConfig }) {
  if (!hardware) return null;

  const ramThreshold = alertConfig?.ram_alert_threshold || 80;
  const cpuThreshold = alertConfig?.cpu_alert_threshold || 85;

  const getBadgeStyle = (status) => {
    if (status === 'Crítico' || status === 'Alto') {
      return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' };
    }
    if (status === 'Atenção') {
      return { bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
    }
    return { bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
  };

  const ramBadge = getBadgeStyle(hardware.ram_status);
  const cpuBadge = getBadgeStyle(hardware.cpu_status);

  return (
    <div className="infra-tab-content" data-testid="infra-resources-tab" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Grade de 3 Cards Superiores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        {/* Card 1: Memória RAM (VPS) */}
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
                <HardDrive size={18} color="#0284c7" />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Memória RAM (VPS)</span>
              </div>
              <span
                style={{
                  background: ramBadge.bg,
                  color: ramBadge.text,
                  border: `1px solid ${ramBadge.border}`,
                  padding: '3px 11px',
                  borderRadius: '20px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                }}
              >
                ● {hardware.ram_status}
              </span>
            </div>

            <div style={{ fontSize: '25px', fontWeight: 800, color: '#0f172a', marginBottom: '14px' }}>
              {hardware.ram_used_gb} GB{' '}
              <span style={{ fontSize: '15px', color: '#64748b', fontWeight: 500 }}>/ {hardware.ram_total_gb} GB</span>{' '}
              <span style={{ fontSize: '16px', color: '#0284c7', fontWeight: 700 }}>({hardware.ram_pct}%)</span>
            </div>

            {/* Barra de Progresso */}
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
              <div
                style={{
                  width: `${Math.min(100, hardware.ram_pct)}%`,
                  height: '100%',
                  background: hardware.ram_pct >= 90 ? 'linear-gradient(90deg, #dc2626, #ef4444)' : 'linear-gradient(90deg, #0284c7, #38bdf8)',
                  borderRadius: '10px',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
            <span>Resta livre: <strong style={{ color: '#0f172a' }}>{hardware.ram_free_gb} GB</strong></span>
            <span>Contêiner API: <strong style={{ color: '#0f172a' }}>{hardware.api_container_mb} MB</strong></span>
          </div>
        </div>

        {/* Card 2: Processamento (CPU) */}
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
                <Cpu size={18} color="#0284c7" />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Processamento (CPU)</span>
              </div>
              <span
                style={{
                  background: cpuBadge.bg,
                  color: cpuBadge.text,
                  border: `1px solid ${cpuBadge.border}`,
                  padding: '3px 11px',
                  borderRadius: '20px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                }}
              >
                ● {hardware.cpu_status}
              </span>
            </div>

            <div style={{ fontSize: '25px', fontWeight: 800, color: '#0f172a', marginBottom: '14px' }}>
              {hardware.cpu_pct}%{' '}
              <span style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>({hardware.vcpus} vCPUs disponíveis)</span>
            </div>

            {/* Barra de Progresso */}
            <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
              <div
                style={{
                  width: `${Math.min(100, hardware.cpu_pct)}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
                  borderRadius: '10px',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          <div style={{ fontSize: '12px', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
            <span>Alerta dispara quando o uso sustentado passar de <strong style={{ color: '#0f172a' }}>{cpuThreshold}%</strong>.</span>
          </div>
        </div>

        {/* Card 3: Maiores Picos de Hardware (24h) */}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <Zap size={18} color="#d97706" />
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Maiores Picos de Hardware (24h)</span>
            </div>
            <span
              style={{
                background: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fde68a',
                padding: '3px 11px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: 700,
              }}
            >
              Hoje
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                <span style={{ color: '#64748b' }}>Pico Máximo de RAM:</span>
                <strong style={{ color: '#0f172a' }}>{hardware.peak_ram_details || `${hardware.peak_ram_pct}%`}</strong>
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '3px' }}>
                Registrado em: {hardware.peak_ram_recorded_at}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                <span style={{ color: '#64748b' }}>Pico Máximo de CPU:</span>
                <strong style={{ color: '#0f172a' }}>{hardware.peak_cpu_pct}%</strong>
              </div>
              <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '3px' }}>
                Registrado em: {hardware.peak_cpu_recorded_at}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Inferior: Diretrizes de Infraestrutura */}
      <div
        style={{
          background: '#f0f9ff',
          borderRadius: '12px',
          border: '1px solid #bae6fd',
          padding: '22px',
          boxShadow: '0 1px 3px rgba(2, 132, 199, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
          <ShieldCheck size={18} color="#0284c7" />
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0369a1' }}>Diretrizes de Infraestrutura do Servidor</h4>
        </div>
        <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: '#0f172a' }}>
          Todos os horários de picos acima seguem o <strong>Horário Oficial de Brasília (UTC-3)</strong>. Caso o consumo de memória RAM passe do limite configurado ({ramThreshold}%), um alerta será disparado automaticamente para evitar a sobrecarga do servidor por falta de memória (OOM Killer).
        </p>
      </div>
    </div>
  );
}
