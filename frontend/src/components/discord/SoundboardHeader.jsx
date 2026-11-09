import React from 'react';
import { Music, Plus, X, Search, Volume2 } from 'lucide-react';
import SoundboardImportForm from './SoundboardImportForm';

export default function SoundboardHeader({
  serverId,
  canManage,
  showImportForm,
  setShowImportForm,
  onClose,
  searchQuery,
  setSearchQuery,
  searchInputRef,
  volume,
  handleVolumeChange,
  soundName,
  setSoundName,
  soundEmoji,
  setSoundEmoji,
  selectedFile,
  uploading,
  fileInputRef,
  handleFileChange,
  handleImportSubmit,
}) {
  return (
    <div className="soundboard-popover-header">
      <div className="soundboard-popover-title-row">
        <div className="soundboard-popover-title">
          <Music size={18} color="#5865f2" />
          <span>Soundboard</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {serverId && canManage && (
            <button
              type="button"
              onClick={() => setShowImportForm((prev) => !prev)}
              data-testid="toggle-import-sound-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: showImportForm ? 'rgba(88, 101, 242, 0.25)' : '#5865f2',
                border: '1px solid rgba(88, 101, 242, 0.6)',
                color: '#ffffff',
                borderRadius: '6px',
                padding: '4px 9px',
                fontSize: '11.5px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Importar novo efeito sonoro (MP3, WAV, OGG)"
            >
              <Plus size={13} />
              <span>{showImportForm ? 'Cancelar' : 'Importar Som'}</span>
            </button>
          )}
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
      </div>

      {/* Formulário Rápido de Importação de Som (Exclusivo Administradores) */}
      {showImportForm && canManage && (
        <SoundboardImportForm
          soundName={soundName}
          setSoundName={setSoundName}
          soundEmoji={soundEmoji}
          setSoundEmoji={setSoundEmoji}
          selectedFile={selectedFile}
          uploading={uploading}
          fileInputRef={fileInputRef}
          handleFileChange={handleFileChange}
          handleImportSubmit={handleImportSubmit}
        />
      )}

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
  );
}
