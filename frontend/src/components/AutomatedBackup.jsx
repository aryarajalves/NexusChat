import React from 'react';
import { Database, Calendar, UploadCloud } from 'lucide-react';
import {
  BackupMetricsCards,
  S3BackupsTab,
  ScheduleTab,
  ImportBackupTab,
  BackupConfirmModal,
  ManualBackupModal,
  RenameBackupModal,
  useAutomatedBackup,
} from './automated-backup';

export default function AutomatedBackup({ currentUser, embedded = false }) {
  const {
    activeTab,
    handleSelectTab,
    stats,
    selectedBackupIds,
    setSelectedBackupIds,
    backupTypeFilter,
    setBackupTypeFilter,
    backupsPage,
    setBackupsPage,
    PAGE_SIZE,
    loadingManual,
    manualModalOpen,
    setManualModalOpen,
    loadingRestoreId,
    scheduleConfig,
    setScheduleConfig,
    savingSchedule,
    dragActive,
    uploadingFile,
    fileInputRef,
    confirmModal,
    closeConfirmModal,
    handleTriggerManualBackup,
    handleSaveSchedule,
    handleDownloadBackup,
    handlePromptRestore,
    renameModal,
    handleOpenRename,
    handleCloseRename,
    handleConfirmRename,
    handleDeleteBackup,
    handleBulkDeleteBackups,
    handleUploadBackupFile,
    handleDrag,
    handleDrop,
    filteredBackups,
    totalBackupPages,
    paginatedBackups,
    isAllPageSelected,
    handleToggleSelectAll,
    handleToggleSelectOne,
  } = useAutomatedBackup();

  return (
    <div className={`backup-page-container ${embedded ? "backup-page-embedded" : ""}`} data-testid="automated-backup-page">
      {/* Cabeçalho */}
      <div className="backup-page-header">
        <h1>Backup Automático</h1>
        <p>Gerenciamento e sincronização dos backups do PostgreSQL com o Backblaze B2 (S3).</p>
      </div>

      {/* 4 Cards de Métricas do Topo */}
      <BackupMetricsCards stats={stats} />

      {/* Navegação entre Abas */}
      <div className="sub-tabs-container">
        <button
          type="button"
          className={`sub-tab-btn ${activeTab === 's3' ? 'active' : ''}`}
          onClick={() => handleSelectTab('s3')}
          data-testid="tab-s3-btn"
        >
          <Database size={16} />
          <span>Backups no S3</span>
        </button>
        <button
          type="button"
          className={`sub-tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => handleSelectTab('schedule')}
          data-testid="tab-schedule-btn"
        >
          <Calendar size={16} />
          <span>Agendamento Automático</span>
        </button>
        <button
          type="button"
          className={`sub-tab-btn ${activeTab === 'import' ? 'active' : ''}`}
          onClick={() => handleSelectTab('import')}
          data-testid="tab-import-btn"
        >
          <UploadCloud size={16} />
          <span>Importar Backup Externo</span>
        </button>
      </div>

      {/* ABA 1: Backups no S3 */}
      {activeTab === 's3' && (
        <S3BackupsTab
          loadingManual={loadingManual}
          onTriggerManualBackup={() => setManualModalOpen(true)}
          backupTypeFilter={backupTypeFilter}
          setBackupTypeFilter={setBackupTypeFilter}
          setBackupsPage={setBackupsPage}
          setSelectedBackupIds={setSelectedBackupIds}
          selectedBackupIds={selectedBackupIds}
          handleBulkDeleteBackups={handleBulkDeleteBackups}
          filteredBackups={filteredBackups}
          isAllPageSelected={isAllPageSelected}
          handleToggleSelectAll={handleToggleSelectAll}
          paginatedBackups={paginatedBackups}
          handleToggleSelectOne={handleToggleSelectOne}
          handleDownloadBackup={handleDownloadBackup}
          handlePromptRestore={handlePromptRestore}
          handleOpenRename={handleOpenRename}
          loadingRestoreId={loadingRestoreId}
          handleDeleteBackup={handleDeleteBackup}
          backupsPage={backupsPage}
          totalBackupPages={totalBackupPages}
          pageSize={PAGE_SIZE}
        />
      )}

      {/* ABA 2: Agendamento Automático */}
      {activeTab === 'schedule' && (
        <ScheduleTab
          scheduleConfig={scheduleConfig}
          setScheduleConfig={setScheduleConfig}
          savingSchedule={savingSchedule}
          onSaveSchedule={handleSaveSchedule}
        />
      )}

      {/* ABA 3: Importar Backup Externo */}
      {activeTab === 'import' && (
        <ImportBackupTab
          dragActive={dragActive}
          uploadingFile={uploadingFile}
          fileInputRef={fileInputRef}
          onDrag={handleDrag}
          onDrop={handleDrop}
          onUploadFile={handleUploadBackupFile}
        />
      )}

      {/* Modal de Backup Manual com Nome Customizado */}
      <ManualBackupModal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        onConfirm={handleTriggerManualBackup}
        loading={loadingManual}
      />

      {/* Modal de Renomeação de Backup */}
      <RenameBackupModal
        isOpen={renameModal.isOpen}
        backup={renameModal.backup}
        onClose={handleCloseRename}
        onConfirm={handleConfirmRename}
        loading={renameModal.loading}
      />

      {/* Modal de Confirmação Centralizado */}
      <BackupConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        loading={confirmModal.loading}
        isDanger={confirmModal.isDanger}
        confirmBtnText={confirmModal.confirmBtnText}
        onConfirm={confirmModal.confirmAction}
        onClose={closeConfirmModal}
      />
    </div>
  );
}
