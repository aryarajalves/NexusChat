import React from 'react';
import { Volume2, User, ShieldCheck, Calendar, RotateCcw, Filter } from 'lucide-react';

export default function VoiceRecordingsFilterBar({
  channels = [],
  authors = [],
  selectedChannelId,
  onSelectChannelId,
  selectedAuthorId,
  onSelectAuthorId,
  onlyAdmins,
  onToggleOnlyAdmins,
  selectedDate,
  onSelectDate,
  onClearFilters,
  hasActiveFilters,
  totalCount = 0,
  filteredCount = 0,
}) {
  return (
    <div className="voice-gallery-filter-bar" data-testid="voice-gallery-filter-bar">
      <div className="voice-gallery-filter-group">
        {/* Filtro por Sala (Canal de Voz) */}
        <div className="voice-gallery-filter-item">
          <Volume2 size={14} className="voice-gallery-filter-icon" />
          <select
            value={selectedChannelId || ''}
            onChange={(e) => onSelectChannelId(e.target.value || null)}
            className="voice-gallery-filter-select"
            data-testid="filter-channel-select"
            title="Filtrar por sala específica"
          >
            <option value="">Todas as salas</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>
                #{ch.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Pessoa (Autor da Gravação) */}
        <div className="voice-gallery-filter-item">
          <User size={14} className="voice-gallery-filter-icon" />
          <select
            value={selectedAuthorId || ''}
            onChange={(e) => onSelectAuthorId(e.target.value || null)}
            className="voice-gallery-filter-select"
            data-testid="filter-author-select"
            title="Filtrar por pessoa específica"
          >
            <option value="">Todas as pessoas</option>
            {authors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro Só dos Admins */}
        <button
          type="button"
          className={`voice-gallery-filter-btn ${onlyAdmins ? 'is-active' : ''}`}
          onClick={onToggleOnlyAdmins}
          data-testid="filter-only-admins-btn"
          title="Exibir exclusivamente vídeos gravados por administradores"
        >
          <ShieldCheck size={14} />
          <span>Só dos admins</span>
        </button>

        {/* Filtro por Data */}
        <div className="voice-gallery-filter-item">
          <Calendar size={14} className="voice-gallery-filter-icon" />
          <input
            type="date"
            value={selectedDate || ''}
            onChange={(e) => onSelectDate(e.target.value || null)}
            className="voice-gallery-filter-date"
            data-testid="filter-date-input"
            title="Filtrar por data específica"
          />
        </div>

        {/* Botão Limpar Filtros */}
        {hasActiveFilters && (
          <button
            type="button"
            className="voice-gallery-clear-filters-btn"
            onClick={onClearFilters}
            data-testid="clear-filters-btn"
            title="Limpar todos os filtros e mostrar tudo"
          >
            <RotateCcw size={12} />
            <span>Limpar filtros</span>
          </button>
        )}
      </div>

      {/* Contador de resultados */}
      {hasActiveFilters && (
        <div className="voice-gallery-filter-count" data-testid="filter-results-count">
          Filtrados: <strong>{filteredCount}</strong> de {totalCount}
        </div>
      )}
    </div>
  );
}
