import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Volume2, Search, X, Music, Sparkles } from 'lucide-react';
import { DEFAULT_SOUNDBOARD_SOUNDS, playSoundboardAudio } from './soundboardSynth';
import '../../styles/discord-soundboard.css';

export default function SoundboardPopover({
  isOpen,
  onClose,
  channelId,
  serverId,
  serverSounds = [],
  onTriggerSound,
  isDeafened = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('discord_soundboard_volume');
    return saved !== null ? parseFloat(saved) : 0.8;
  });
  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    localStorage.setItem('discord_soundboard_volume', String(newVol));
  };

  const filteredDefaults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return DEFAULT_SOUNDBOARD_SOUNDS;
    return DEFAULT_SOUNDBOARD_SOUNDS.filter((s) => s.name.toLowerCase().includes(q));
  }, [searchQuery]);

  const filteredServerSounds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!Array.isArray(serverSounds)) return [];
    if (!q) return serverSounds;
    return serverSounds.filter((s) => s.name.toLowerCase().includes(q));
  }, [searchQuery, serverSounds]);

  const handleSoundClick = (sound) => {
    if (!isDeafened) {
      playSoundboardAudio(sound, volume);
    }
    if (typeof onTriggerSound === 'function') {
      onTriggerSound(sound, volume);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="discord-soundboard-popover"
      data-testid="discord-soundboard-popover"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Cabeçalho */}
      <div className="soundboard-popover-header">
        <div className="soundboard-popover-title-row">
          <div className="soundboard-popover-title">
            <Music size={18} color="#5865f2" />
            <span>Soundboard</span>
          </div>
          <button
            type="button"
            className="soundboard-popover-close-btn"
            onClick={onClose}
            title="Fechar (ESC)"
            data-testid="close-soundboard-btn"
          >
            <X size={16} />
          </button>
        </div>

        {/* Busca e Volume */}
        <div className="soundboard-search-and-vol">
          <div className="soundboard-search-box">
            <Search size={14} className="soundboard-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="soundboard-search-input"
              placeholder="Buscar som..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="soundboard-search-input"
            />
          </div>

          <div className="soundboard-vol-wrapper" title={`Volume: ${Math.round(volume * 100)}%`}>
            <Volume2 size={15} color="#949ba4" />
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="soundboard-vol-slider"
              data-testid="soundboard-volume-slider"
            />
          </div>
        </div>
      </div>

      {/* Conteúdo com Grid de Sons */}
      <div className="soundboard-popover-body" data-testid="soundboard-popover-body">
        {/* Sons do Servidor */}
        {filteredServerSounds.length > 0 && (
          <div className="soundboard-section" data-testid="soundboard-server-section">
            <div className="soundboard-section-title">
              <Sparkles size={14} color="#f0b232" />
              <span>Sons do Servidor ({filteredServerSounds.length})</span>
            </div>
            <div className="soundboard-grid">
              {filteredServerSounds.map((sound) => (
                <button
                  key={sound.id}
                  type="button"
                  className="soundboard-card"
                  onClick={() => handleSoundClick(sound)}
                  title={`Tocar ${sound.name}`}
                  data-testid={`soundboard-play-server-${sound.id}`}
                >
                  <span className="soundboard-card-emoji">{sound.emoji || '🔊'}</span>
                  <span className="soundboard-card-name">{sound.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sons Padrão do Discord */}
        <div className="soundboard-section" data-testid="soundboard-default-section">
          <div className="soundboard-section-title">
            <span>Sons Padrão</span>
          </div>
          <div className="soundboard-grid">
            {filteredDefaults.map((sound) => (
              <button
                key={sound.id}
                type="button"
                className="soundboard-card"
                onClick={() => handleSoundClick(sound)}
                title={`Tocar ${sound.name}`}
                data-testid={`soundboard-play-default-${sound.id}`}
              >
                <span className="soundboard-card-emoji">{sound.emoji}</span>
                <span className="soundboard-card-name">{sound.name}</span>
              </button>
            ))}
          </div>
        </div>

        {filteredDefaults.length === 0 && filteredServerSounds.length === 0 && (
          <div className="soundboard-empty" data-testid="soundboard-empty">
            <span>Nenhum som encontrado para "{searchQuery}"</span>
          </div>
        )}
      </div>
    </div>
  );
}
