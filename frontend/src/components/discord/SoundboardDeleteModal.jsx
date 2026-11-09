import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function SoundboardDeleteModal({
  soundToDelete,
  deleting,
  onClose,
  onConfirm,
}) {
  if (!soundToDelete) return null;

  return (
    <div
      className="server-sound-delete-backdrop"
      data-testid="soundboard-popover-delete-backdrop"
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
        className="server-sound-delete-modal"
        data-testid="soundboard-popover-delete-modal"
        style={{
          background: '#2b2d31',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '20px',
          width: '320px',
          maxWidth: '90vw',
          boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#f2f3f5' }}>
          <AlertTriangle size={20} color="#f23f43" />
          <h4 style={{ margin: 0, fontSize: '15px' }}>Excluir Som do Soundboard</h4>
        </div>
        <p style={{ fontSize: '13px', color: '#b5bac1', margin: '0 0 16px 0' }}>
          Tem certeza que deseja excluir o som <strong>{soundToDelete.emoji} {soundToDelete.name}</strong>?
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            data-testid="cancel-popover-delete-sound-btn"
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
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            data-testid="confirm-popover-delete-sound-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#da373a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '7px 14px',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: deleting ? 'not-allowed' : 'pointer',
            }}
          >
            {deleting ? <Loader2 size={13} className="spin" /> : null}
            <span>{deleting ? 'Excluindo...' : 'Excluir'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
