import React, { useState, useEffect, useRef } from 'react';
import { UserPlus, Copy, Check, RotateCw } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ServerInviteModal({ isOpen, onClose, server, onCreateInvite }) {
  const [inviteCode, setInviteCode] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const { addToast } = useToast();
  const hasAttemptedRef = useRef(false);

  const generateInvite = async () => {
    if (!onCreateInvite) return;
    try {
      setLoading(true);
      setError(false);
      const invite = await onCreateInvite();
      if (invite?.code) {
        setInviteCode(invite.code);
      }
    } catch {
      setError(true);
      addToast('Falha ao gerar link de convite.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && server) {
      if (!inviteCode && !hasAttemptedRef.current) {
        hasAttemptedRef.current = true;
        generateInvite();
      }
    } else {
      hasAttemptedRef.current = false;
      setInviteCode('');
      setError(false);
    }
  }, [isOpen, server]);

  if (!isOpen || !server) return null;

  const inviteLink = inviteCode ? `${window.location.origin}/invite/${inviteCode}` : '';

  const handleCopy = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setIsCopied(true);
    addToast('Link de convite copiado para a área de transferência!', 'success');
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div
      className="discord-modal-backdrop"
      data-testid="server-invite-modal"
      role="dialog"
      aria-modal="true"
    >
      <div className="discord-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserPlus size={22} color="#5865f2" />
            <h3 className="discord-modal-title">Convidar amigos para {server.name}</h3>
          </div>
        </div>

        <div className="modal-body">
          <p className="discord-modal-subtitle" style={{ margin: 0 }}>
            Envie este link para amigos para que eles entrem no servidor.
          </p>

          <div className="form-group">
            <label className="form-label">Link de Convite</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                readOnly
                value={
                  loading
                    ? 'Gerando link seguro...'
                    : error
                    ? 'Não foi possível gerar o link'
                    : inviteLink
                }
                data-testid="invite-link-input"
              />
              {error ? (
                <button
                  type="button"
                  className="discord-modal-btn btn-secondary"
                  onClick={generateInvite}
                  disabled={loading}
                  title="Tentar Novamente"
                  data-testid="retry-invite-btn"
                  style={{ flexShrink: 0 }}
                >
                  <RotateCw size={16} />
                  <span>Tentar novamente</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="discord-modal-btn btn-primary"
                  onClick={handleCopy}
                  disabled={loading || !inviteCode}
                  title="Copiar Link"
                  data-testid="copy-invite-btn"
                  style={{ flexShrink: 0 }}
                >
                  {isCopied ? <Check size={16} /> : <Copy size={16} />}
                  <span>{isCopied ? 'Copiado!' : 'Copiar'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="discord-modal-btn btn-secondary"
            onClick={onClose}
            data-testid="invite-close-btn"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
