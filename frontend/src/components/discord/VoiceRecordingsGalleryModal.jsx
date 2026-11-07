import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Film, RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import VoiceRecordingCard from './VoiceRecordingCard';
import VoiceRecordingsToolbar from './VoiceRecordingsToolbar';
import VoiceRecordingsPagination from './VoiceRecordingsPagination';
import VoiceRecordingDeleteModal from './VoiceRecordingDeleteModal';
import VoiceRecordingsBatchDeleteModal from './VoiceRecordingsBatchDeleteModal';
import '../../styles/discord-voice-gallery.css';
import '../../styles/discord-voice-gallery-batch.css';

const ITEMS_PER_PAGE = 20;

export default function VoiceRecordingsGalleryModal({
  isOpen,
  onClose,
  channel,
  serverId: propServerId,
  currentUser,
}) {
  const targetServerId = propServerId || channel?.server_id;
  const [recordings, setRecordings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  // Estados de seleção e paginação
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  // Estado do popup de exclusão individual
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  let addToast = () => {};
  try {
    const toastCtx = useToast();
    if (toastCtx?.addToast) addToast = toastCtx.addToast;
  } catch {}

  const getHeaders = () => {
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
    return token
      ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      : { 'Content-Type': 'application/json' };
  };

  const getMediaUrl = (url) => {
    if (!url) return '';
    const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';
    if (!token) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  };

  const fetchRecordings = useCallback(async () => {
    if (!targetServerId && !channel?.id) return;
    try {
      setIsLoading(true);
      const endpoint = targetServerId
        ? `/api/v1/discord/servers/${targetServerId}/recordings`
        : `/api/v1/discord/channels/${channel.id}/recordings`;
      const res = await fetch(endpoint, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Erro ao buscar gravações');
      const data = await res.json();
      setRecordings(data || []);
      setSelectedIds([]);
    } catch (err) {
      console.error('[VoiceRecordings] Erro ao carregar gravações:', err);
      addToast('Não foi possível carregar as gravações da sala.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [targetServerId, channel?.id, addToast]);

  useEffect(() => {
    if (isOpen) {
      fetchRecordings();
      setCurrentPage(1);
      setSelectedIds([]);
    } else {
      setEditingId(null);
      setDeleteTarget(null);
      setIsBatchModalOpen(false);
      setSelectedIds([]);
    }
  }, [isOpen, fetchRecordings]);

  // Cálculos de Paginação (Máx 20 por página)
  const totalPages = Math.ceil(recordings.length / ITEMS_PER_PAGE) || 1;
  const paginatedRecordings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return recordings.slice(start, start + ITEMS_PER_PAGE);
  }, [recordings, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  if (!isOpen) return null;

  const formatDuration = (secs) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(2)} MB`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      let raw = String(dateStr).trim();
      if (raw.includes('T') && !raw.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(raw)) {
        raw += 'Z';
      } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw)) {
        raw = raw.replace(' ', 'T') + 'Z';
      }
      const d = new Date(raw);
      if (isNaN(d.getTime())) return '';
      const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(d);
      const get = (t) => parts.find((p) => p.type === t)?.value || '';
      return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
    } catch {
      return '';
    }
  };

  // Gerenciamento de Seleção Individual e em Lote
  const handleToggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const currentPageIds = paginatedRecordings.map((r) => r.id);
  const isAllCurrentPageSelected =
    currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.includes(id));
  const isPartiallySelected =
    currentPageIds.some((id) => selectedIds.includes(id)) && !isAllCurrentPageSelected;

  const handleToggleSelectAll = () => {
    if (isAllCurrentPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
    }
  };

  const handleSelectEntireChannel = () => {
    setSelectedIds(recordings.map((r) => r.id));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Renomear gravação
  const handleStartRename = (rec) => {
    setEditingId(rec.id);
    setEditTitle(rec.title);
  };

  const handleSaveRename = async (recId) => {
    const clean = editTitle.trim();
    if (!clean) {
      addToast('O nome da gravação não pode ficar vazio.', 'warning');
      return;
    }
    try {
      setIsSavingTitle(true);
      const res = await fetch(`/api/v1/discord/recordings/${recId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ title: clean }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Erro ao renomear a gravação.');
      }
      const updated = await res.json();
      setRecordings((prev) =>
        prev.map((r) => (r.id === recId ? { ...r, title: updated.title } : r))
      );
      setEditingId(null);
      addToast('Gravação renomeada com sucesso!', 'success');
    } catch (err) {
      addToast(err.message || 'Erro ao renomear a gravação.', 'error');
    } finally {
      setIsSavingTitle(false);
    }
  };

  // Exclusão Individual
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      const res = await fetch(`/api/v1/discord/recordings/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Erro ao excluir gravação.');
      }
      setRecordings((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
      addToast('Gravação excluída do servidor e do Backblaze B2!', 'success');
      setDeleteTarget(null);
    } catch (err) {
      addToast(err.message || 'Erro ao excluir gravação.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Exclusão em Lote
  const handleConfirmBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      setIsBatchDeleting(true);
      const endpoint = targetServerId
        ? `/api/v1/discord/servers/${targetServerId}/recordings/batch-delete`
        : `/api/v1/discord/channels/${channel.id}/recordings/batch-delete`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ recording_ids: selectedIds }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Erro ao excluir gravações em lote.');
      }
      const data = await res.json();
      const deletedSet = new Set(data.deleted_ids || []);
      setRecordings((prev) => prev.filter((r) => !deletedSet.has(r.id)));
      setSelectedIds([]);
      setIsBatchModalOpen(false);
      addToast(`${data.count || deletedSet.size} gravações excluídas do servidor e do B2!`, 'success');
    } catch (err) {
      addToast(err.message || 'Erro ao excluir gravações em lote.', 'error');
    } finally {
      setIsBatchDeleting(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop" data-testid="voice-gallery-modal-backdrop">
        <div className="voice-gallery-dialog" data-testid="voice-gallery-modal">
          {/* Cabeçalho */}
          <div className="voice-gallery-header">
            <div className="voice-gallery-header-info">
              <div className="voice-gallery-icon-pill">
                <Film size={20} />
              </div>
              <div>
                <h3 className="voice-gallery-title">
                  {targetServerId ? 'Gravações do Servidor' : 'Gravações da Sala'}
                </h3>
                <p className="voice-gallery-subtitle">
                  #{channel?.name || 'geral'} • Salvas na nuvem (Backblaze B2) • Máx. 20 por página
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="voice-gallery-close-btn"
                onClick={fetchRecordings}
                disabled={isLoading}
                title="Recarregar gravações"
                data-testid="refresh-recordings-btn"
              >
                <RefreshCw size={18} className={isLoading ? 'spin-anim' : ''} />
              </button>
              <button
                type="button"
                className="voice-gallery-close-btn"
                onClick={onClose}
                title="Fechar galeria"
                data-testid="close-gallery-btn"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Barra de Seleção e Ações em Lote */}
          <VoiceRecordingsToolbar
            recordingsCount={recordings.length}
            selectedCount={selectedIds.length}
            itemsPerPage={ITEMS_PER_PAGE}
            isAllCurrentPageSelected={isAllCurrentPageSelected}
            isPartiallySelected={isPartiallySelected}
            onToggleSelectAll={handleToggleSelectAll}
            onSelectEntireChannel={handleSelectEntireChannel}
            onClearSelection={handleClearSelection}
            onOpenBatchDelete={() => setIsBatchModalOpen(true)}
          />

          {/* Corpo / Lista Paginada de Gravações */}
          <div className="voice-gallery-body" data-testid="voice-gallery-list">
            {isLoading ? (
              <div className="voice-gallery-loading" data-testid="voice-gallery-loading">
                <Loader2 size={32} color="#5865f2" className="spin-anim" />
                <span>Carregando gravações salvas...</span>
              </div>
            ) : recordings.length === 0 ? (
              <div className="voice-gallery-empty" data-testid="voice-gallery-empty">
                <div className="voice-gallery-empty-icon">
                  <Film size={28} />
                </div>
                <strong>Nenhuma gravação nesta sala</strong>
                <p className="voice-gallery-empty-text">
                  Quando você ou um administrador gravar o áudio ou vídeo nesta sala e salvar no servidor, o conteúdo ficará disponível aqui para streaming e download.
                </p>
              </div>
            ) : (
              paginatedRecordings.map((rec) => (
                <VoiceRecordingCard
                  key={rec.id}
                  rec={rec}
                  isSelected={selectedIds.includes(rec.id)}
                  onToggleSelect={handleToggleSelect}
                  editingId={editingId}
                  editTitle={editTitle}
                  setEditTitle={setEditTitle}
                  onStartRename={handleStartRename}
                  onSaveRename={handleSaveRename}
                  onCancelRename={() => setEditingId(null)}
                  isSavingTitle={isSavingTitle}
                  onDeleteRequest={(target) => setDeleteTarget(target)}
                  getMediaUrl={getMediaUrl}
                  getHeaders={getHeaders}
                  formatDuration={formatDuration}
                  formatSize={formatSize}
                  formatDate={formatDate}
                />
              ))
            )}
          </div>

          {/* Paginação */}
          {recordings.length > 0 && (
            <VoiceRecordingsPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={recordings.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={(p) => setCurrentPage(p)}
            />
          )}
        </div>
      </div>

      {/* Popup de Exclusão Individual */}
      <VoiceRecordingDeleteModal
        recording={deleteTarget}
        isDeleting={isDeleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />

      {/* Popup de Exclusão em Lote */}
      <VoiceRecordingsBatchDeleteModal
        isOpen={isBatchModalOpen}
        selectedCount={selectedIds.length}
        isDeleting={isBatchDeleting}
        onClose={() => setIsBatchModalOpen(false)}
        onConfirm={handleConfirmBatchDelete}
      />
    </>
  );
}
