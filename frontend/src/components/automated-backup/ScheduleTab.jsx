import React from 'react';
import { Clock, HardDrive, CheckCircle2, Save } from 'lucide-react';

export default function ScheduleTab({
  scheduleConfig,
  setScheduleConfig,
  savingSchedule,
  onSaveSchedule,
}) {
  return (
    <div className="schedule-settings-card" data-testid="schedule-tab-content">
      <div className="schedule-settings-header">
        <h3>Agendamento de Backup Automático</h3>
        <p>Configure a rotina periódica de backups do banco de dados no Backblaze B2 (protocolo S3).</p>
      </div>

      <form onSubmit={onSaveSchedule}>
        {/* Toggle Ativar Backup Automático */}
        <div className="schedule-toggle-row">
          <div className="toggle-label-group">
            <span className="toggle-main-label">Ativar Backup Automático</span>
            <span className="toggle-sub-label">
              {scheduleConfig.is_active
                ? 'Rotina ativa. O sistema executará os dumps conforme o intervalo configurado.'
                : 'Rotina pausada. Nenhum backup agendado será disparado.'}
            </span>
          </div>
          <label className="switch-toggle" htmlFor="schedule-active-toggle">
            <input
              id="schedule-active-toggle"
              type="checkbox"
              checked={scheduleConfig.is_active}
              onChange={(e) =>
                setScheduleConfig((prev) => ({ ...prev, is_active: e.target.checked }))
              }
              data-testid="schedule-active-toggle"
            />
            <span className="switch-slider"></span>
          </label>
        </div>

        {/* Frequência de Execução */}
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label htmlFor="frequency-select" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f2f3f5', fontWeight: 600, fontSize: '13.5px', marginBottom: '8px' }}>
            <Clock size={16} color="#5865f2" />
            <span>Frequência de Execução</span>
          </label>
          <select
            id="frequency-select"
            className="form-control-modern"
            value={scheduleConfig.frequency}
            onChange={(e) =>
              setScheduleConfig((prev) => ({ ...prev, frequency: e.target.value }))
            }
            data-testid="frequency-select"
          >
            <option value="1h">A cada 1 hora</option>
            <option value="6h">A cada 6 horas</option>
            <option value="12h">A cada 12 horas</option>
            <option value="24h">A cada 24 horas (Diário)</option>
            <option value="7d">A cada 7 dias (Semanal)</option>
          </select>
        </div>

        {/* Pasta de Destino no S3 / Bucket B2 */}
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label htmlFor="folder-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f2f3f5', fontWeight: 600, fontSize: '13.5px', marginBottom: '8px' }}>
            <HardDrive size={16} color="#5865f2" />
            <span>Pasta de Destino no S3 / Bucket B2</span>
          </label>
          <input
            id="folder-input"
            type="text"
            className="form-control-modern"
            value={scheduleConfig.destination_folder}
            onChange={(e) =>
              setScheduleConfig((prev) => ({ ...prev, destination_folder: e.target.value }))
            }
            placeholder="projetobase/backups/"
            data-testid="destination-folder-input"
          />
          <span className="help-text">
            Caminho relativo dentro do bucket onde os arquivos .dump.gz serão gravados.
          </span>
        </div>

        {/* Limite de Retenção de Backups */}
        <div className="form-group" style={{ marginBottom: '28px' }}>
          <label htmlFor="retention-input" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f2f3f5', fontWeight: 600, fontSize: '13.5px', marginBottom: '8px' }}>
            <CheckCircle2 size={16} color="#5865f2" />
            <span>Limite de Retenção de Backups (Máximo de Dumps)</span>
          </label>
          <input
            id="retention-input"
            type="number"
            min="1"
            max="365"
            className="form-control-modern"
            value={scheduleConfig.retention_max}
            onChange={(e) =>
              setScheduleConfig((prev) => ({ ...prev, retention_max: parseInt(e.target.value) || 1 }))
            }
            data-testid="retention-input"
          />
          <span className="help-text">
            Quando a quantidade de backups ultrapassar esse limite, o backup mais antigo é excluído automaticamente do bucket.
          </span>
        </div>

        <button
          type="submit"
          className="primary-btn"
          disabled={savingSchedule}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          data-testid="save-schedule-btn"
        >
          <Save size={16} />
          <span>{savingSchedule ? 'Salvando...' : 'Salvar Configurações'}</span>
        </button>
      </form>
    </div>
  );
}
