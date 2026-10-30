import React, { useState } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Modal de confirmação para exclusão de servidores no Discord.
 * Conformidade com as regras de UX e Popups do projeto:
 * - Centralizado com painel preto translúcido (backdrop)
 * - NÃO fecha ao clicar no fundo translúcido (fechamento forçado apenas via botão)
 * - Possui apenas 1 botão para cancelar além do botão de ação principal
 * - Estado de carregamento visual durante a requisição
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
      // Notificação de erro é tratada no chamador via toast
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
    >
      <div
        className="discord-modal-card"
        data-testid="delete-server-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="discord-modal-header delete-header">
          <div className="delete-icon-wrapper">
            <Trash2 size={24} className="delete-icon" />
          </div>
          <div>
            <h2 id="delete-server-modal-title" className="discord-modal-title">
              Excluir Servidor
            </h2>
            <p className="discord-modal-subtitle">
              Esta ação é permanente e irreversível.
            </p>
          </div>
        </div>

        {/* Pré-visualização do Servidor a ser apagado */}
        <div className="delete-message-preview" style={{ marginTop: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            <div>
              <div style={{ fontWeight: 600, color: '#f2f3f5', fontSize: '15px' }}>
                {server.name}
              </div>
              <div style={{ fontSize: '12px', color: '#949ba4' }}>
                Todos os canais, mensagens e membros serão excluídos permanentemente.
              </div>
            </div>
          </div>
        </div>

        {/* Alerta de confirmação */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            backgroundColor: 'rgba(237, 66, 69, 0.12)',
            borderRadius: '8px',
            border: '1px solid rgba(237, 66, 69, 0.3)',
            marginBottom: '20px',
            color: '#f87171',
            fontSize: '13px',
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>
            Tem certeza de que deseja excluir <strong>{server.name}</strong>? Você não poderá recuperá-lo.
          </span>
        </div>

        {/* Rodapé: Apenas 1 botão Cancelar + 1 botão Ação Principal */}
        <div className="discord-modal-actions" style={{ justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="button"
            className="discord-btn discord-btn-secondary"
            onClick={onClose}
            disabled={loading}
            data-testid="cancel-delete-server-btn"
          >
            Cancelar
          </button>
          <button
            type="button"
            className="discord-btn discord-btn-danger"
            onClick={handleDelete}
            disabled={loading}
            data-testid="confirm-delete-server-btn"
            style={{
              backgroundColor: '#da373c',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {loading ? <Loader2 size={16} className="spin-icon" /> : <Trash2 size={16} />}
            {loading ? 'Excluindo...' : 'Excluir Servidor'}
          </button>
        </div>
      </div>
    </div>
  );
}
