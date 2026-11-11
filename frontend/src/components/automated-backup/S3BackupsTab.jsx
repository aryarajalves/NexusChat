import React from 'react';
import {
  Database,
  Play,
  Filter,
  Trash2,
  FileArchive,
  Download,
  RotateCw,
  Edit3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function S3BackupsTab({
  loadingManual,
  onTriggerManualBackup,
  backupTypeFilter,
  setBackupTypeFilter,
  setBackupsPage,
  setSelectedBackupIds,
  selectedBackupIds,
  handleBulkDeleteBackups,
  filteredBackups,
  isAllPageSelected,
  handleToggleSelectAll,
  paginatedBackups,
  handleToggleSelectOne,
  handleDownloadBackup,
  handlePromptRestore,
  handleOpenRename,
  loadingRestoreId,
  handleDeleteBackup,
  backupsPage,
  totalBackupPages,
  pageSize,
}) {
  return (
    <div className="backup-s3-view" data-testid="backups-s3-tab-content">
      {/* Banner de Execução Manual */}
      <div className="manual-backup-banner">
        <div className="manual-backup-text">
          <div className="manual-backup-title">
            <Database size={20} color="#0284c7" />
            <span>Execução de Backup Manual</span>
          </div>
          <p className="manual-backup-desc">
            Gere imediatamente um dump compactado (.dump.gz) do banco de dados PostgreSQL e armazene com segurança criptografada no bucket do Backblaze B2 (S3).
          </p>
        </div>
        <button
          type="button"
          className="trigger-backup-btn"
          onClick={onTriggerManualBackup}
          disabled={loadingManual}
          data-testid="trigger-manual-backup-btn"
        >
          <Play size={16} fill="currentColor" />
          <span>{loadingManual ? 'Gerando Backup...' : 'Fazer Backup Agora'}</span>
        </button>
      </div>

      {/* Tabela de Backups Registrados */}
      <div className="table-card">
        {/* Toolbar de Filtros e Exclusão em Lote */}
        <div className="table-toolbar">
          <div className="table-filter-group">
            <Filter size={15} color="#949ba4" />
            <label
              htmlFor="backup-type-filter"
              style={{ fontSize: '13px', fontWeight: 600, color: '#949ba4' }}
            >
              Filtrar por tipo:
            </label>
            <select
              id="backup-type-filter"
              className="form-control-modern"
              value={backupTypeFilter}
              onChange={(e) => {
                setBackupTypeFilter(e.target.value);
                setBackupsPage(1);
                setSelectedBackupIds([]);
              }}
              data-testid="filter-backup-type-select"
              style={{ width: 'auto', minWidth: '160px', padding: '8px 36px 8px 12px' }}
            >
              <option value="all">Todos os tipos</option>
              <option value="automatic">Automático</option>
              <option value="manual">Manual</option>
              <option value="imported">Importado</option>
            </select>
          </div>

          <div className="bulk-actions-group">
            {selectedBackupIds.length > 0 && (
              <>
                <span className="selected-count-badge" data-testid="selected-backups-count">
                  {selectedBackupIds.length} selecionado(s)
                </span>
                <button
                  type="button"
                  onClick={handleBulkDeleteBackups}
                  className="table-action-btn btn-danger"
                  data-testid="bulk-delete-backups-btn"
                >
                  <Trash2 size={14} />
                  <span>Excluir Selecionados</span>
                </button>
              </>
            )}
            <span className="text-secondary" style={{ fontSize: '13px' }}>
              {filteredBackups.length} backup(s) registrado(s)
            </span>
          </div>
        </div>

        <table className="users-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  className="table-checkbox"
                  checked={isAllPageSelected}
                  onChange={handleToggleSelectAll}
                  disabled={paginatedBackups.length === 0}
                  title="Selecionar todos os backups da página"
                  data-testid="select-all-backups-checkbox"
                />
              </th>
              <th>ARQUIVO</th>
              <th>TAMANHO</th>
              <th>TIPO</th>
              <th>CRIADO EM</th>
              <th style={{ textAlign: 'center' }}>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            {paginatedBackups.length === 0 ? (
              <tr>
                <td colSpan="6" className="empty-table-state">
                  Nenhum backup encontrado no armazenamento.
                </td>
              </tr>
            ) : (
              paginatedBackups.map((bkp) => {
                const isChecked = selectedBackupIds.includes(bkp.id);
                return (
                  <tr key={bkp.id} className={isChecked ? 'row-selected' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        className="table-checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSelectOne(bkp.id)}
                        data-testid={`select-backup-check-${bkp.id}`}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileArchive size={16} color="#0284c7" />
                        <span className="font-semibold text-primary">{bkp.filename}</span>
                      </div>
                    </td>
                    <td className="text-secondary">
                      {bkp.file_size_formatted || `${(bkp.file_size_bytes / 1024).toFixed(2)} KB`}
                    </td>
                    <td>
                      <span
                        className={`badge badge-${bkp.backup_type}`}
                        style={{ textTransform: 'capitalize' }}
                      >
                        {bkp.backup_type === 'automatic'
                          ? 'Automático'
                          : bkp.backup_type === 'manual'
                          ? 'Manual'
                          : 'Importado'}
                      </span>
                    </td>
                    <td className="text-secondary">
                      {new Date(bkp.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td>
                      <div className="table-actions-group" style={{ justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleDownloadBackup(bkp.id, bkp.filename)}
                          className="table-action-btn btn-secondary"
                          title="Baixar dump compactado"
                          data-testid={`download-backup-btn-${bkp.id}`}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenRename(bkp)}
                          className="table-action-btn btn-secondary"
                          title="Renomear este backup"
                          data-testid={`rename-backup-btn-${bkp.id}`}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePromptRestore(bkp.id, bkp.filename)}
                          className="table-action-btn btn-secondary"
                          title="Restaurar este banco de dados"
                          disabled={loadingRestoreId === bkp.id}
                          data-testid={`restore-backup-btn-${bkp.id}`}
                        >
                          <RotateCw
                            size={14}
                            className={loadingRestoreId === bkp.id ? 'spin-animation' : ''}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBackup(bkp.id, bkp.filename)}
                          className="table-action-btn btn-danger"
                          title="Excluir do bucket S3"
                          data-testid={`delete-backup-btn-${bkp.id}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Paginação */}
        <div className="table-pagination-footer" data-testid="backups-pagination">
          <span>
            Mostrando {filteredBackups.length === 0 ? 0 : (backupsPage - 1) * pageSize + 1} a{' '}
            {Math.min(backupsPage * pageSize, filteredBackups.length)} de{' '}
            {filteredBackups.length} backups
          </span>
          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-btn"
              onClick={() => setBackupsPage((prev) => Math.max(prev - 1, 1))}
              disabled={backupsPage <= 1}
              data-testid="backups-prev-page-btn"
            >
              <ChevronLeft size={16} />
              <span>Anterior</span>
            </button>
            <span className="pagination-page-indicator">
              Página {backupsPage} de {totalBackupPages}
            </span>
            <button
              type="button"
              className="pagination-btn"
              onClick={() => setBackupsPage((prev) => Math.min(prev + 1, totalBackupPages))}
              disabled={backupsPage >= totalBackupPages}
              data-testid="backups-next-page-btn"
            >
              <span>Próximo</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
