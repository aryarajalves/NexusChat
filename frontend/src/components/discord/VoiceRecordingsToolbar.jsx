import React from 'react';
import { Trash2, CheckSquare, Square, MinusSquare } from 'lucide-react';

export default function VoiceRecordingsToolbar({
  recordingsCount,
  selectedCount,
  itemsPerPage,
  isAllCurrentPageSelected,
  isPartiallySelected,
  onToggleSelectAll,
  onSelectEntireChannel,
  onClearSelection,
  onOpenBatchDelete,
}) {
  if (recordingsCount === 0) return null;

  return (
    <div className="voice-gallery-toolbar" data-testid="voice-gallery-toolbar">
      <div className="voice-gallery-toolbar-left">
        <button
          type="button"
          className="voice-gallery-select-all-btn"
          onClick={onToggleSelectAll}
          data-testid="select-all-recordings-btn"
          title={isAllCurrentPageSelected ? 'Desmarcar página atual' : 'Selecionar todos da página atual'}
        >
          {isAllCurrentPageSelected ? (
            <CheckSquare size={16} color="#5865f2" />
          ) : isPartiallySelected ? (
            <MinusSquare size={16} color="#5865f2" />
          ) : (
            <Square size={16} />
          )}
          <span>Selecionar todos</span>
        </button>

        {recordingsCount > itemsPerPage && selectedCount > 0 && selectedCount < recordingsCount && (
          <button
            type="button"
            className="voice-gallery-text-link-btn"
            onClick={onSelectEntireChannel}
            data-testid="select-all-pages-btn"
          >
            Selecionar todas as {recordingsCount} gravações
          </button>
        )}

        {selectedCount > 0 && (
          <button
            type="button"
            className="voice-gallery-text-link-btn"
            onClick={onClearSelection}
            data-testid="clear-selection-btn"
          >
            Limpar seleção
          </button>
        )}
      </div>

      <div className="voice-gallery-toolbar-right">
        {selectedCount > 0 && (
          <>
            <span className="voice-gallery-selected-badge" data-testid="selected-count-badge">
              {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
            </span>
            <button
              type="button"
              className="discord-btn discord-btn-danger voice-gallery-bulk-delete-btn"
              onClick={onOpenBatchDelete}
              data-testid="bulk-delete-btn"
              title="Excluir gravações selecionadas"
            >
              <Trash2 size={15} />
              <span>Excluir Selecionados ({selectedCount})</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
