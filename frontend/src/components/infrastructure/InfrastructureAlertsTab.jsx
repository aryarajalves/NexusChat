import React, { useState, useEffect } from 'react';
import { Bell, Send, Save } from 'lucide-react';
import { updateAlertConfigApi, testWebhookApi } from './infrastructureApi';

export default function InfrastructureAlertsTab({ config, onUpdated, addToast = () => {} }) {
  const [poolEnabled, setPoolEnabled] = useState(true);
  const [poolThreshold, setPoolThreshold] = useState(75);

  const [ramEnabled, setRamEnabled] = useState(true);
  const [ramThreshold, setRamThreshold] = useState(80);

  const [cpuEnabled, setCpuEnabled] = useState(true);
  const [cpuThreshold, setCpuThreshold] = useState(85);

  const [cooldown, setCooldown] = useState(15);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [notifyNormalized, setNotifyNormalized] = useState(true);

  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setPoolEnabled(config.pool_alert_enabled ?? true);
      setPoolThreshold(config.pool_alert_threshold ?? 75);
      setRamEnabled(config.ram_alert_enabled ?? true);
      setRamThreshold(config.ram_alert_threshold ?? 80);
      setCpuEnabled(config.cpu_alert_enabled ?? true);
      setCpuThreshold(config.cpu_alert_threshold ?? 85);
      setCooldown(config.cooldown_minutes ?? 15);
      setWebhookUrl(config.webhook_url || '');
      setNotifyNormalized(config.notify_normalized ?? true);
    }
  }, [config]);

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim() || !webhookUrl.startsWith('http')) {
      addToast('Por favor, informe uma URL de webhook válida começando com http:// ou https://', 'error');
      return;
    }

    setTesting(true);
    try {
      const res = await testWebhookApi(webhookUrl.trim());
      addToast(res.message || 'Webhook de teste disparado com sucesso!', 'success');
    } catch (err) {
      addToast(err.message || 'Erro ao testar webhook.', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        pool_alert_enabled: poolEnabled,
        pool_alert_threshold: poolThreshold,
        ram_alert_enabled: ramEnabled,
        ram_alert_threshold: ramThreshold,
        cpu_alert_enabled: cpuEnabled,
        cpu_alert_threshold: cpuThreshold,
        cooldown_minutes: Number(cooldown),
        webhook_url: webhookUrl.trim(),
        notify_normalized: notifyNormalized,
      };
      const updated = await updateAlertConfigApi(payload);
      addToast('Configurações de infraestrutura e alertas salvas com sucesso!', 'success');
      if (onUpdated) onUpdated(updated);
    } catch (err) {
      addToast(err.message || 'Erro ao salvar configurações.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="infra-tab-content" data-testid="infra-alerts-tab">
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        {/* Cabeçalho da Central */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '26px' }}>
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
            <Bell size={22} color="#0284c7" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Central de Notificações e Webhooks</h3>
            <p style={{ margin: '5px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Ajuste as porcentagens de disparo para Conexões, RAM e CPU, e conecte seu Webhook (Discord, n8n, Slack, WhatsApp).
            </p>
          </div>
        </div>

        {/* 3 Controles com Checkbox e Slider */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '26px' }}>
          {/* Controle 1: Alerta Pool Banco */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', margin: 0, fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>
                <input
                  type="checkbox"
                  checked={poolEnabled}
                  onChange={(e) => setPoolEnabled(e.target.checked)}
                  data-testid="pool-alert-checkbox"
                  style={{ width: '16px', height: '16px', accentColor: '#0284c7', cursor: 'pointer' }}
                />
                <span>Alerta Pool Banco</span>
              </label>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#0284c7' }}>{poolThreshold}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="95"
              step="1"
              value={poolThreshold}
              onChange={(e) => setPoolThreshold(Number(e.target.value))}
              disabled={!poolEnabled}
              data-testid="pool-alert-slider"
              style={{ width: '100%', accentColor: '#0284c7', cursor: poolEnabled ? 'pointer' : 'not-allowed', opacity: poolEnabled ? 1 : 0.4 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
              <span>20% (Sensível)</span>
              <span>60% (Recomendado)</span>
              <span>95% (Crítico)</span>
            </div>
          </div>

          {/* Controle 2: Alerta de RAM (VPS) */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', margin: 0, fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>
                <input
                  type="checkbox"
                  checked={ramEnabled}
                  onChange={(e) => setRamEnabled(e.target.checked)}
                  data-testid="ram-alert-checkbox"
                  style={{ width: '16px', height: '16px', accentColor: '#0284c7', cursor: 'pointer' }}
                />
                <span>Alerta de RAM (VPS)</span>
              </label>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#0284c7' }}>{ramThreshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              step="1"
              value={ramThreshold}
              onChange={(e) => setRamThreshold(Number(e.target.value))}
              disabled={!ramEnabled}
              data-testid="ram-alert-slider"
              style={{ width: '100%', accentColor: '#0284c7', cursor: ramEnabled ? 'pointer' : 'not-allowed', opacity: ramEnabled ? 1 : 0.4 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
              <span>50%</span>
              <span>80% (Recomendado)</span>
              <span>95% (Risco OOM)</span>
            </div>
          </div>

          {/* Controle 3: Alerta de CPU */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', margin: 0, fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>
                <input
                  type="checkbox"
                  checked={cpuEnabled}
                  onChange={(e) => setCpuEnabled(e.target.checked)}
                  data-testid="cpu-alert-checkbox"
                  style={{ width: '16px', height: '16px', accentColor: '#0284c7', cursor: 'pointer' }}
                />
                <span>Alerta de CPU</span>
              </label>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#0284c7' }}>{cpuThreshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              step="1"
              value={cpuThreshold}
              onChange={(e) => setCpuThreshold(Number(e.target.value))}
              disabled={!cpuEnabled}
              data-testid="cpu-alert-slider"
              style={{ width: '100%', accentColor: '#0284c7', cursor: cpuEnabled ? 'pointer' : 'not-allowed', opacity: cpuEnabled ? 1 : 0.4 }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
              <span>50%</span>
              <span>85% (Recomendado)</span>
              <span>95% (Gargalo)</span>
            </div>
          </div>
        </div>

        {/* Cooldown Anti-Spam */}
        <div style={{ marginBottom: '22px', maxWidth: '400px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
            Intervalo Anti-Spam (Cooldown)
          </label>
          <select
            value={cooldown}
            onChange={(e) => setCooldown(Number(e.target.value))}
            data-testid="cooldown-select"
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#ffffff', color: '#0f172a' }}
          >
            <option value="5">5 minutos (Ambientes de teste)</option>
            <option value="15">15 minutos (Recomendado)</option>
            <option value="30">30 minutos</option>
            <option value="60">60 minutos (1 hora)</option>
          </select>
          <small style={{ display: 'block', fontSize: '12px', color: '#64748b', marginTop: '5px' }}>
            Evita flood de alertas caso a alta carga persista por muito tempo.
          </small>
        </div>

        {/* URL do Webhook */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
            URL do Webhook de Notificação
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="url"
              placeholder="https://webhook.site/test-1234"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              data-testid="webhook-url-input"
              style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#ffffff', color: '#0f172a' }}
            />
            <button
              type="button"
              onClick={handleTestWebhook}
              disabled={testing || !webhookUrl.trim()}
              data-testid="test-webhook-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 18px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 600, fontSize: '13.5px', color: '#0f172a', cursor: testing ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease' }}
            >
              <Send size={15} color="#0284c7" />
              <span>{testing ? 'Testando...' : 'Testar Webhook'}</span>
            </button>
          </div>
        </div>

        {/* Checkbox Tráfego Normalizado */}
        <div style={{ marginBottom: '26px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', fontSize: '13px', color: '#334155' }}>
            <input
              type="checkbox"
              checked={notifyNormalized}
              onChange={(e) => setNotifyNormalized(e.target.checked)}
              data-testid="notify-normalized-checkbox"
              style={{ width: '16px', height: '16px', accentColor: '#0284c7' }}
            />
            <span>Enviar notificação de <strong>Tráfego Normalizado</strong> quando a carga do pool voltar ao padrão.</span>
          </label>
        </div>

        {/* Botão Salvar Configurações */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '18px' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            data-testid="save-alert-config-btn"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)' }}
          >
            <Save size={16} />
            <span>{saving ? 'Salvando...' : 'Salvar Configurações'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
