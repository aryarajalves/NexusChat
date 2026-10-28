import React from 'react';
import { Calendar, Clock, X, Search } from 'lucide-react';

export default function LogDateFilter({
  selectedDate,
  onDateChange,
  startTime,
  onStartTimeChange,
  endTime,
  onEndTimeChange,
  onApplyFilter,
  onClearFilter,
  isActive
}) {
  const handleSetToday = () => {
    // Data atual em Horário de Brasília
    const now = new Date();
    const brDate = new Intl.DateTimeFormat('fr-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    onDateChange(brDate);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        padding: '12px 16px',
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: isActive ? '1px solid #0284c7' : '1px solid #e2e8f0',
        boxShadow: isActive ? '0 0 0 3px rgba(2, 132, 199, 0.1)' : '0 1px 3px rgba(0, 0, 0, 0.04)',
        marginBottom: '12px',
        transition: 'all 0.2s ease',
      }}
      data-testid="log-date-filter-bar"
    >
      {/* Campo Data */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Calendar size={16} color="#0284c7" />
        <label htmlFor="log-date-input" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
          Data:
        </label>
        <input
          id="log-date-input"
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            fontSize: '13px',
            outline: 'none',
          }}
          data-testid="log-date-input"
        />
        <button
          type="button"
          onClick={handleSetToday}
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            backgroundColor: '#e0f2fe',
            color: '#0284c7',
            border: '1px solid #bae6fd',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          data-testid="btn-today-date"
          title="Definir data de hoje (Brasília)"
        >
          Hoje
        </button>
      </div>

      {/* Horário Inicial */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Clock size={16} color="#64748b" />
        <label htmlFor="log-start-time" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
          De:
        </label>
        <input
          id="log-start-time"
          type="time"
          value={startTime}
          onChange={(e) => onStartTimeChange(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            fontSize: '13px',
            outline: 'none',
          }}
          data-testid="log-start-time-input"
        />
      </div>

      {/* Horário Final */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <label htmlFor="log-end-time" style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>
          Até:
        </label>
        <input
          id="log-end-time"
          type="time"
          value={endTime}
          onChange={(e) => onEndTimeChange(e.target.value)}
          style={{
            padding: '6px 10px',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            fontSize: '13px',
            outline: 'none',
          }}
          data-testid="log-end-time-input"
        />
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
        <button
          type="button"
          onClick={onApplyFilter}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '8px',
            backgroundColor: '#0284c7',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.2)',
            transition: 'all 0.15s ease',
          }}
          data-testid="apply-date-filter-btn"
        >
          <Search size={14} />
          <span>Filtrar período</span>
        </button>

        {isActive && (
          <button
            type="button"
            onClick={onClearFilter}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '7px 12px',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            data-testid="clear-date-filter-btn"
            title="Limpar filtro de data e horário"
          >
            <X size={14} />
            <span>Limpar</span>
          </button>
        )}
      </div>
    </div>
  );
}
