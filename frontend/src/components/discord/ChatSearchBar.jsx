import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import ChatSearchResultsPanel from './ChatSearchResultsPanel';

export default function ChatSearchBar({
  channel,
  onScrollToMessage,
}) {
  const [query, setQuery] = useState('');
  const [filterAttachment, setFilterAttachment] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);

  const containerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const fetchSearchResults = useCallback(
    async (searchTerm, onlyAttachments) => {
      if (!channel?.id) return;
      if (!searchTerm.trim() && !onlyAttachments) {
        setResults([]);
        setTotal(0);
        return;
      }

      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        const baseUrl = channel.is_dm
          ? `/api/v1/discord/dms/${channel.id}/search`
          : `/api/v1/discord/channels/${channel.id}/search`;

        const params = new URLSearchParams();
        if (searchTerm.trim()) {
          params.append('q', searchTerm.trim());
        }
        if (onlyAttachments) {
          params.append('has_attachment', 'true');
        }

        const res = await fetch(`${baseUrl}?${params.toString()}`, { headers });
        if (res.ok) {
          const data = await res.json();
          setResults(data.messages || []);
          setTotal(data.total || 0);
        } else {
          setResults([]);
          setTotal(0);
        }
      } catch (err) {
        setResults([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [channel?.id, channel?.is_dm]
  );

  // Debounced search on query or filter change
  useEffect(() => {
    if (!isOpen) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchSearchResults(query, filterAttachment);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query, filterAttachment, isOpen, fetchSearchResults]);

  // Fecha popover ao clicar fora ou pressionar ESC
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleClear = () => {
    setQuery('');
    setFilterAttachment(false);
    setResults([]);
    setTotal(0);
  };

  const handleFocus = () => {
    setIsOpen(true);
    if (query.trim() || filterAttachment) {
      fetchSearchResults(query, filterAttachment);
    }
  };

  const handleSelectMessage = (messageId) => {
    if (onScrollToMessage) {
      onScrollToMessage(messageId);
    }
  };

  if (!channel || channel.type === 'VOICE') {
    return null;
  }

  const placeholderText = channel.is_dm
    ? `Buscar em @${channel.name}`
    : `Buscar em #${channel.name}`;

  return (
    <div className="chat-search-container" ref={containerRef} data-testid="chat-search-container">
      <div className={`chat-search-bar ${isOpen ? 'active' : ''}`} data-testid="chat-search-bar">
        <input
          type="text"
          className="chat-search-input"
          placeholder={placeholderText}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          data-testid="chat-search-input"
          aria-label={placeholderText}
        />

        {query ? (
          <button
            type="button"
            className="chat-search-clear-btn"
            onClick={handleClear}
            title="Limpar busca"
            data-testid="chat-search-clear-btn"
          >
            <X size={14} />
          </button>
        ) : (
          <button
            type="button"
            className="chat-search-icon-btn"
            onClick={() => setIsOpen(true)}
            title="Buscar mensagens"
            data-testid="chat-search-icon-btn"
          >
            <Search size={14} />
          </button>
        )}
      </div>

      <ChatSearchResultsPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        results={results}
        total={total}
        loading={loading}
        query={query}
        filterAttachment={filterAttachment}
        onToggleFilterAttachment={(val) => setFilterAttachment(val)}
        onSelectResult={handleSelectMessage}
      />
    </div>
  );
}
