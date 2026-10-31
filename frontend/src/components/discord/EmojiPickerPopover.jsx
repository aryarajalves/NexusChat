// EmojiPickerPopover.jsx - Popover Completo e Categorizado de Emojis do Discord
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Clock } from 'lucide-react';
import {
  EMOJI_CATEGORIES,
  EMOJI_LIST,
  getRecentEmojis,
  saveRecentEmoji,
  searchEmojis,
} from './emojiData';

export default function EmojiPickerPopover({
  onSelectEmoji,
  onClose,
  placement = 'input',
  testId = 'chat-input-emoji-picker',
  itemTestIdPrefix = 'input-emoji-select',
}) {
  const [activeTab, setActiveTab] = useState('smileys');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentList, setRecentList] = useState([]);
  const [hoveredItem, setHoveredItem] = useState(null);

  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);
  const bodyRef = useRef(null);

  // Inicializa recentes
  useEffect(() => {
    setRecentList(getRecentEmojis());
  }, []);

  // Foco inicial no campo de busca e ajuste de segurança aos limites da tela
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInputRef.current) searchInputRef.current.focus();
      if (popoverRef.current) {
        const rect = popoverRef.current.getBoundingClientRect();
        if (rect.top < 10) {
          popoverRef.current.style.top = '10px';
          popoverRef.current.style.bottom = 'auto';
        } else if (rect.bottom > window.innerHeight - 10) {
          popoverRef.current.style.bottom = '10px';
          popoverRef.current.style.top = 'auto';
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Fechar com Escape ou clique fora
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Resultados de busca
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchEmojis(searchQuery);
  }, [searchQuery]);

  // Emojis agrupados por categoria
  const categoryGroups = useMemo(() => {
    const groups = {};
    EMOJI_CATEGORIES.forEach((cat) => {
      if (cat.id === 'recent') return;
      groups[cat.id] = EMOJI_LIST.filter((item) => item.category === cat.id);
    });
    return groups;
  }, []);

  const handleSelect = (emoji, itemObj = null) => {
    const updated = saveRecentEmoji(emoji);
    setRecentList(updated);
    if (onSelectEmoji) onSelectEmoji(emoji);
  };

  const handleTabClick = (catId) => {
    setActiveTab(catId);
    setSearchQuery('');
    if (bodyRef.current) {
      const sectionEl = bodyRef.current.querySelector(`[data-category-id="${catId}"]`);
      if (sectionEl && typeof sectionEl.scrollIntoView === 'function') {
        sectionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Preview ativo no rodapé
  const defaultPreview = EMOJI_LIST[0];
  const activePreview = hoveredItem || defaultPreview;

  return (
    <div
      ref={popoverRef}
      className={`discord-emoji-picker-popover placement-${placement}`}
      data-testid={testId}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Cabeçalho com Busca */}
      <div className="emoji-picker-header">
        <div className="emoji-search-box">
          <Search size={16} className="emoji-search-icon" />
          <input
            ref={searchInputRef}
            type="text"
            className="emoji-search-input"
            placeholder="Buscar emoji..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="emoji-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="emoji-search-clear"
              onClick={() => setSearchQuery('')}
              title="Limpar busca"
              data-testid="clear-emoji-search-btn"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Barra de Abas de Categorias */}
      {!searchQuery && (
        <div className="emoji-picker-tabs" data-testid="emoji-picker-tabs">
          {EMOJI_CATEGORIES.map((cat) => {
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                className={`emoji-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleTabClick(cat.id)}
                title={cat.name}
                data-testid={`emoji-tab-${cat.id}`}
              >
                {cat.id === 'recent' ? <Clock size={16} /> : <span>{cat.icon}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Lista e Grid de Emojis */}
      <div ref={bodyRef} className="emoji-picker-body" data-testid="emoji-picker-body">
        {searchResults !== null ? (
          /* Modo de Busca Ativo */
          <div>
            <div className="emoji-category-title">
              Resultados da busca ({searchResults.length})
            </div>
            {searchResults.length === 0 ? (
              <div className="emoji-picker-empty" data-testid="emoji-search-empty">
                <span>Nenhum emoji encontrado para "{searchQuery}"</span>
              </div>
            ) : (
              <div className="emoji-picker-grid">
                {searchResults.map((item) => (
                  <button
                    key={item.emoji}
                    type="button"
                    className="emoji-picker-item"
                    onClick={() => handleSelect(item.emoji, item)}
                    onMouseEnter={() => setHoveredItem(item)}
                    title={item.name}
                    data-testid={`${itemTestIdPrefix}-${item.emoji}`}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Modo Padrão por Categorias */
          <>
            {/* Seção de Recentes */}
            {recentList.length > 0 && (
              <div
                className="emoji-category-section"
                data-category-id="recent"
                data-testid="category-section-recent"
              >
                <div className="emoji-category-title">Frequentes / Recentes</div>
                <div className="emoji-picker-grid">
                  {recentList.map((emoji) => {
                    const found = EMOJI_LIST.find((e) => e.emoji === emoji);
                    const itemObj = found || { emoji, name: 'Emoji', keywords: [] };
                    return (
                      <button
                        key={`recent-${emoji}`}
                        type="button"
                        className="emoji-picker-item"
                        onClick={() => handleSelect(emoji, itemObj)}
                        onMouseEnter={() => setHoveredItem(itemObj)}
                        title={itemObj.name}
                        data-testid={`recent-emoji-${emoji}`}
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Categorias Principais */}
            {EMOJI_CATEGORIES.filter((c) => c.id !== 'recent').map((cat) => {
              const emojis = categoryGroups[cat.id] || [];
              if (emojis.length === 0) return null;
              return (
                <div
                  key={cat.id}
                  className="emoji-category-section"
                  data-category-id={cat.id}
                  data-testid={`category-section-${cat.id}`}
                >
                  <div className="emoji-category-title">{cat.name}</div>
                  <div className="emoji-picker-grid">
                    {emojis.map((item) => (
                      <button
                        key={item.emoji}
                        type="button"
                        className="emoji-picker-item"
                        onClick={() => handleSelect(item.emoji, item)}
                        onMouseEnter={() => setHoveredItem(item)}
                        title={item.name}
                        data-testid={`${itemTestIdPrefix}-${item.emoji}`}
                      >
                        {item.emoji}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* 4. Rodapé com Prévia do Emoji e Nome */}
      <div className="emoji-picker-footer" data-testid="emoji-picker-footer">
        <span className="emoji-preview-symbol" data-testid="emoji-preview-symbol">
          {activePreview?.emoji || '😀'}
        </span>
        <div className="emoji-preview-info">
          <span className="emoji-preview-name" data-testid="emoji-preview-name">
            {activePreview?.name || 'Emoji'}
          </span>
          <span className="emoji-preview-shortcode">
            :{activePreview?.name?.toLowerCase().replace(/\s+/g, '_') || 'emoji'}:
          </span>
        </div>
      </div>
    </div>
  );
}
