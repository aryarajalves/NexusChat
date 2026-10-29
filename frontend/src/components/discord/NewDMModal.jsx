import React, { useState, useEffect } from 'react';
import { MessageSquare, Search, X, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function NewDMModal({
  isOpen,
  onClose,
  token,
  onSelectUser,
}) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [startingUserId, setStartingUserId] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setUsers([]);
      setStartingUserId(null);
      return;
    }

    const fetchUsers = async () => {
      try {
        setLoading(true);
        const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
        const res = await fetch(`/api/v1/discord/dms/users${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        } else {
          addToast('Falha ao buscar usuários.', 'error');
        }
      } catch (err) {
        addToast('Erro de conexão ao buscar usuários.', 'error');
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchUsers, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [isOpen, search, token, addToast]);

  if (!isOpen) return null;

  const handleStartConversation = async (userId) => {
    try {
      setStartingUserId(userId);
      await onSelectUser(userId);
      onClose();
    } catch (err) {
      addToast(err.message || 'Erro ao iniciar conversa.', 'error');
    } finally {
      setStartingUserId(null);
    }
  };

  return (
    <div
      className="discord-modal-backdrop"
      data-testid="new-dm-modal-backdrop"
      role="dialog"
      aria-modal="true"
    >
      <div className="discord-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MessageSquare size={22} color="#5865f2" />
            <h3 className="discord-modal-title">Iniciar Conversa Privada</h3>
          </div>
        </div>

        <div className="modal-body">
          <p className="discord-modal-subtitle" style={{ margin: '0 0 12px 0' }}>
            Selecione ou busque um usuário para conversar no privado.
          </p>

          <div className="dm-search-bar" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#1e1f22', padding: '8px 12px', borderRadius: '6px', marginBottom: '14px' }}>
            <Search size={16} color="#949ba4" />
            <input
              type="text"
              className="form-input"
              style={{ background: 'transparent', border: 'none', padding: 0, color: '#f2f3f5' }}
              placeholder="Buscar por nome ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              data-testid="dm-user-search-input"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'transparent', border: 'none', color: '#949ba4', cursor: 'pointer' }}
                title="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="dm-user-list" style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }} data-testid="dm-user-list">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#949ba4' }}>
                <Loader2 size={24} className="spinner-icon" style={{ animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: '8px', fontSize: '13px' }}>Buscando usuários...</p>
              </div>
            ) : users.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#949ba4', fontSize: '13px' }}>
                Nenhum usuário encontrado.
              </div>
            ) : (
              users.map((u) => {
                const initial = (u.name || 'U').charAt(0).toUpperCase();
                const isStarting = startingUserId === u.id;

                return (
                  <div
                    key={u.id}
                    className="dm-user-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      background: '#2b2d31',
                      transition: 'background 0.15s ease',
                    }}
                    data-testid={`dm-user-row-${u.id}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="discord-avatar-wrapper" style={{ width: '32px', height: '32px', fontSize: '13px' }}>
                        {initial}
                        <span className="discord-online-badge" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ color: '#f2f3f5', fontWeight: 600, fontSize: '14px' }}>{u.name}</span>
                        <span style={{ color: '#949ba4', fontSize: '11px' }}>{u.email}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="discord-modal-btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                      onClick={() => handleStartConversation(u.id)}
                      disabled={isStarting}
                      data-testid={`start-dm-btn-${u.id}`}
                    >
                      {isStarting ? <Loader2 size={14} className="spinner-icon" /> : 'Conversar'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: '16px' }}>
          <button
            type="button"
            className="discord-modal-btn btn-secondary"
            onClick={onClose}
            data-testid="close-new-dm-modal-btn"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
