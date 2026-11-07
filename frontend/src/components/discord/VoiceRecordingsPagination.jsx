import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function VoiceRecordingsPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}) {
  if (totalItems <= itemsPerPage && totalPages <= 1) {
    return null;
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="voice-gallery-pagination" data-testid="voice-gallery-pagination">
      <div className="voice-gallery-pagination-info" data-testid="pagination-info">
        Mostrando <strong>{startItem}–{endItem}</strong> de <strong>{totalItems}</strong> gravações
      </div>

      <div className="voice-gallery-pagination-controls">
        <button
          type="button"
          className="voice-gallery-page-btn"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Página Anterior"
          data-testid="pagination-prev-btn"
        >
          <ChevronLeft size={16} />
          <span>Anterior</span>
        </button>

        <span className="voice-gallery-page-indicator" data-testid="pagination-current-page">
          Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong>
        </span>

        <button
          type="button"
          className="voice-gallery-page-btn"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Próxima Página"
          data-testid="pagination-next-btn"
        >
          <span>Próxima</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
