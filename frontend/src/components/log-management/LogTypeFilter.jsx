import React from 'react';
import { Info, AlertTriangle, AlertCircle, Globe, ListFilter } from 'lucide-react';

export default function LogTypeFilter({ currentFilter, onSelectFilter, counts }) {
  const filterOptions = [
    {
      id: 'all',
      label: 'Todos',
      icon: ListFilter,
      count: counts.all,
      activeColor: '#5865f2',
      activeBg: '#232428',
      activeBorder: '#5865f2',
    },
    {
      id: 'info',
      label: 'Info',
      icon: Info,
      count: counts.info,
      activeColor: '#5865f2',
      activeBg: '#232428',
      activeBorder: '#5865f2',
    },
    {
      id: 'warning',
      label: 'Avisos',
      icon: AlertTriangle,
      count: counts.warning,
      activeColor: '#b45309',
      activeBg: '#fef3c7',
      activeBorder: '#fde68a',
    },
    {
      id: 'error',
      label: 'Erros',
      icon: AlertCircle,
      count: counts.error,
      activeColor: '#b91c1c',
      activeBg: '#fee2e2',
      activeBorder: '#fecaca',
    },
    {
      id: 'http',
      label: 'HTTP',
      icon: Globe,
      count: counts.http,
      activeColor: '#15803d',
      activeBg: '#dcfce7',
      activeBorder: '#bbf7d0',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        padding: '10px 16px',
        backgroundColor: '#2b2d31',
        borderRadius: '10px',
        border: '1px solid #35373c',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.2)',
        marginBottom: '12px',
      }}
      data-testid="log-type-filter-bar"
    >
      <span style={{ fontSize: '13px', fontWeight: 600, color: '#f2f3f5', marginRight: '6px' }}>
        Separar por tipo:
      </span>
      {filterOptions.map((opt) => {
        const IconComponent = opt.icon;
        const isActive = currentFilter === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelectFilter(opt.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: isActive ? 600 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              border: isActive ? `1px solid ${opt.activeBorder}` : '1px solid #35373c',
              backgroundColor: isActive ? opt.activeBg : '#1e1f22',
              color: isActive ? opt.activeColor : '#dbdee1',
            }}
            data-testid={`filter-btn-${opt.id}`}
          >
            <IconComponent size={14} color={isActive ? opt.activeColor : '#949ba4'} />
            <span>{opt.label}</span>
            <span
              style={{
                fontSize: '11px',
                padding: '1px 7px',
                borderRadius: '10px',
                backgroundColor: isActive ? opt.activeColor : '#35373c',
                color: isActive ? '#ffffff' : '#dbdee1',
                fontWeight: 700,
                minWidth: '18px',
                textAlign: 'center',
              }}
            >
              {opt.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
