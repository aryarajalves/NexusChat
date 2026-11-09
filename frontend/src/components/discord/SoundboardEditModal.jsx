import React, { useState, useEffect } from 'react';
import { Pencil, Loader2 } from 'lucide-react';

export default function SoundboardEditModal({
  soundToEdit,
  saving,
  onClose,
  onSave,
}) {
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('🔊');

  useEffect(() => {
    if (soundToEdit) {
      setEditName(soundToEdit.name || '');
      setEditEmoji(soundToEdit.emoji || '🔊');
    }
  }, [soundToEdit]);

  if (!soundToEdit) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!editName.trim() || saving) return;
    onSave({
      id: soundToEdit.id,
      name: editName.trim(),
      emoji: (editEmoji || '🔊').trim(),
    });
  };

  return (
    <div
      className="server-sound-edit-backdrop"
      data-testid="soundboard-popover-edit-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
      }}
    >
      <div
        className="server-sound-edit-modal"
        data-testid="soundboard-popover-edit-modal"
        style={{
          background: '#2b2d31',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '20px',
          width: '340px',
          maxWidth: '92vw',
          boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', color: '#f2f3f5' }}>
          <Pencil size={18} color="#5865f2" />
          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>Editar Som do Soundboard</h4>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#b5bac1', textTransform: 'uppercase', marginBottom: '6px' }}>
              Emoji e Nome do Som
            </label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={editEmoji}
                onChange={(e) => setEditEmoji(e.target.value.slice(0, 4))}
                title="Emoji"
                maxLength={4}
                data-testid="edit-sound-emoji-input"
                style={{
                  width: '44px',
                  textAlign: 'center',
                  background: '#1e1f22',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: '#f2f3f5',
                  fontSize: '16px',
                  padding: '6px',
                  outline: 'none',
                }}
              />
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value.slice(0, 32))}
                placeholder="Nome do som (2-32 caracteres)"
                maxLength={32}
                required
                data-testid="edit-sound-name-input"
                style={{
                  flex: 1,
                  background: '#1e1f22',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  color: '#f2f3f5',
                  fontSize: '13px',
                  padding: '6px 10px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              data-testid="cancel-edit-sound-btn"
              style={{
                background: '#383a40',
                color: '#dbdee1',
                border: 'none',
                borderRadius: '6px',
                padding: '7px 12px',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !editName.trim()}
              data-testid="confirm-edit-sound-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: saving || !editName.trim() ? '#3f4248' : '#5865f2',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                padding: '7px 14px',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: saving || !editName.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {saving && <Loader2 size={13} className="spin" />}
              <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
