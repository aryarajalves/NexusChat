import React, { useState } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Modal de confirmação para exclusão de servidores no Discord.
 * Conformidade estrita com as regras de UX e Popups do projeto:
 * - 100% centralizado com painel preto translúcido (backdrop cobrindo a viewport)
 * - NÃO fecha ao clicar no fundo translúcido (fechamento apenas via botão)
 * - Possui exatamente 1 botão de Cancelar + 1 botão de confirmação alinhados horizontalmente
 * - Estado visual de loading com spinner
 */
export default function DeleteServerModal({ isOpen, server, onClose, onConfirmDelete }) {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !server) return null;

  const handleDelete = async () => {
    if (loading) return;
    try {
      setLoading(true);
      await onConfirmDelete(server.id);
      onClose();
    } catch {
      // Erros tratados e notificados via toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="discord-modal-backdrop"
      data-testid="delete-server-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-server-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="discord-modal-card"
        data-testid="delete-server-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#313338',
          borderRadius: '14px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          margin: 'auto',
          animation: 'modal-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Cabeçalho */}
        <div
          className="discord-modal-header"
          style={{
            padding: '22px 24px 16px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'rgba(237, 66, 69, 0.12)',
              border: '1px solid rgba(237, 66, 69, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ed4245',
              flexShrink: 0,
            }}
          >
            <Trash2 size={22} />
          </div>
          <div>
            <h2
              id="delete-server-modal-title"
              style={{ fontSize: '18px', fontWeight: 700, color: '#f2f3f5', margin: 0 }}
            >
              Excluir Servidor
            </h2>
            <p style={{ fontSize: '13px', color: '#949ba4', margin: '4px 0 0 0' }}>
              Esta ação é permanente e irreversível.
            </p>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div
          className="discord-modal-body"
          style={{
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Card de Pré-visualização do Servidor */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 14px',
              backgroundColor: '#2b2d31',
              borderRadius: '8px',
              borderLeft: '4px solid #ed4245',
              borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              borderRight: '1px solid rgba(255, 255, 255, 0.05)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: '#5865f2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 'bold',
                fontSize: '18px',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {server.icon_url ? (
                <img
                  src={server.icon_url}
                  alt={server.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                (server.name || 'S').charAt(0).toUpperCase()
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontWeight: 600,
                  color: '#f2f3f5',
                  fontSize: '15px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {server.name}
              </div>
              <div style={{ fontSize: '12px', color: '#949ba4', marginTop: '2px' }}>
                Todos os canais, mensagens e membros serão excluídos permanentemente.
              </div>
            </div>
          </div>

          {/* Alerta de Confirmação */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              backgroundColor: 'rgba(237, 66, 69, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(237, 66, 69, 0.25)',
              color: '#f87171',
              fontSize: '13px',
              lineHeight: '1.4',
            }}
          >
            <AlertTriangle size={18} style={{ flexShrink: 0, color: '#ed4245' }} />
            <span>
              Tem certeza de que deseja excluir <strong>{server.name}</strong>? Você não poderá recuperá-lo.
            </span>
          </div>
        </div>

        {/* Rodapé: Apenas 1 botão Cancelar + 1 botão Ação Principal (alinhados horizontalmente) */}
        <div
          className="modal-footer"
          style={{
            backgroundColor: '#2b2d31',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          }}
        >
          <button
            type="button"
            className="discord-modal-btn btn-secondary"
            onClick={onClose}
            disabled={loading}
            data-testid="cancel-delete-server-btn"
            style={{
              padding: '10px 18px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: '#f2f3f5',
              transition: 'background 0.15s',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="discord-modal-btn btn-danger"
            onClick={handleDelete}
            disabled={loading}
            data-testid="confirm-delete-server-btn"
            style={{
              padding: '10px 18px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: '#da373c',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'background 0.15s',
            }}
          >
            {loading ? <Loader2 size={16} className="spinner" /> : <Trash2 size={16} />}
            {loading ? 'Excluindo...' : 'Excluir Servidor'}
          </button>
        </div>
      </div>
    </div>
  );
}
