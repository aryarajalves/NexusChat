import React from 'react';
import { Upload, Loader2 } from 'lucide-react';

export default function SoundboardImportForm({
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
    <form
      onSubmit={handleImportSubmit}
      data-testid="soundboard-import-form"
      style={{
        background: '#1e1f22',
        border: '1px solid rgba(88, 101, 242, 0.35)',
        borderRadius: '8px',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.ogg,.webm,.m4a"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        data-testid="soundboard-import-file-input"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        data-testid="soundboard-select-file-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '8px',
          borderRadius: '6px',
          border: '1px dashed rgba(88, 101, 242, 0.6)',
          background: 'rgba(88, 101, 242, 0.08)',
          color: selectedFile ? '#57f287' : '#dbdee1',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <Upload size={14} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedFile
            ? `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(0)} KB)`
            : 'Escolher Arquivo de Áudio (MP3, WAV, OGG - máx 2MB)'}
        </span>
      </button>

      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          type="text"
          value={soundEmoji}
          onChange={(e) => setSoundEmoji(e.target.value.slice(0, 4))}
          placeholder="🔊"
          title="Emoji do Som"
          maxLength={4}
          data-testid="soundboard-import-emoji-input"
          style={{
            width: '42px',
            textAlign: 'center',
            background: '#2b2d31',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            color: '#f2f3f5',
            fontSize: '15px',
            padding: '5px',
            outline: 'none',
          }}
        />
        <input
          type="text"
          value={soundName}
          onChange={(e) => setSoundName(e.target.value.slice(0, 32))}
          placeholder="Nome do som (ex: Vitória, Grito)"
          maxLength={32}
          data-testid="soundboard-import-name-input"
          style={{
            flex: 1,
            background: '#2b2d31',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            color: '#f2f3f5',
            fontSize: '12px',
            padding: '6px 10px',
            outline: 'none',
          }}
        />
      </div>

      <button
        type="submit"
        disabled={uploading || !selectedFile || !soundName.trim()}
        data-testid="soundboard-submit-import-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          background: uploading || !selectedFile || !soundName.trim() ? '#3f4248' : '#23a55a',
          color: '#ffffff',
          border: 'none',
          borderRadius: '6px',
          padding: '7px 10px',
          fontSize: '12px',
          fontWeight: 700,
          cursor: uploading || !selectedFile || !soundName.trim() ? 'not-allowed' : 'pointer',
        }}
      >
        {uploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
        <span>{uploading ? 'Importando...' : 'Salvar no Soundboard'}</span>
      </button>
    </form>
  );
}
