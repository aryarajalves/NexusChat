// MentionAutocompletePopover.jsx - Menu de Autocompletar Menções (@)
import React, { useMemo } from 'react';
import { AtSign } from 'lucide-react';

export default function MentionAutocompletePopover({
  query = '',
  members = [],
  selectedIndex = 0,
  onSelect,
}) {
  const q = (query || '').toLowerCase().trim();

  // Constrói lista completa de opções (especiais + membros)
  const options = useMemo(() => {
    const list = [
      {
        id: 'everyone',
        name: 'everyone',
        description: 'Notifica todas as pessoas neste canal',
        isSpecial: true,
      },
      {
        id: 'here',
        name: 'here',
        description: 'Notifica todos os membros online neste canal',
        isSpecial: true,
      },
    ];

    // Adiciona membros mapeados
    const memberItems = (members || []).map((m) => {
      const displayName = m.nickname || m.name || 'Usuário';
      return {
        id: m.user_id || m.id,
        name: displayName,
        rawName: m.name,
        role: m.role,
        isSpecial: false,
        initial: displayName.charAt(0).toUpperCase(),
      };
    });

    return [...list, ...memberItems];
  }, [members]);

  // Filtra de acordo com a busca após o @
  const filteredOptions = useMemo(() => {
    if (!q) return options;
    return options.filter((item) => {
      if (item.name.toLowerCase().includes(q)) return true;
      if (item.rawName && item.rawName.toLowerCase().includes(q)) return true;
      if (item.description && item.description.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [options, q]);

  if (filteredOptions.length === 0) {
    return null;
  }

  return (
    <div
      className="mention-autocomplete-popover"
      data-testid="mention-autocomplete-popover"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mention-autocomplete-header">Membros e Menções</div>
      <div className="mention-autocomplete-list" data-testid="mention-autocomplete-list">
        {filteredOptions.map((item, idx) => {
          const isActive = idx === selectedIndex;
          return (
            <button
              key={`${item.id}-${item.name}`}
              type="button"
              className={`mention-autocomplete-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelect && onSelect(item)}
              data-testid={`mention-item-${item.id || item.name}`}
            >
              {item.isSpecial ? (
                <div className="mention-avatar-wrapper is-special">
                  <AtSign size={15} />
                </div>
              ) : (
                <div className="mention-avatar-wrapper">{item.initial}</div>
              )}

              <div className="mention-item-info">
                <div className="mention-item-name-row">
                  <span className="mention-item-name">@{item.name}</span>
                  {item.role && (item.role === 'OWNER' || item.role === 'ADMIN') && (
                    <span className="mention-item-role">{item.role}</span>
                  )}
                </div>
                {item.description && <span className="mention-item-desc">{item.description}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
