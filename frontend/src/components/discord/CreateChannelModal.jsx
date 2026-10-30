import React, { useState, useEffect } from 'react';
import { Hash, Volume2, Lock, Loader2, Check } from 'lucide-react';

const DEFAULT_ROLES = [];

export default function CreateChannelModal({
  isOpen,
  onClose,
  onCreateChannel,
  roles = DEFAULT_ROLES,
  serverId,
  token,
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('TEXT');
  const [category, setCategory] = useState('Canais de Texto');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [serverRoles, setServerRoles] = useState(roles || []);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (roles && roles.length > 0) {
      setServerRoles(roles);
      setLoadingRoles(false);
      return;
    }

    if (serverId && token) {
      let isMounted = true;
      setLoadingRoles(true);
      fetch(`/api/v1/discord/servers/${serverId}/roles`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (isMounted) {
            setServerRoles(Array.isArray(data) ? data : []);
          }
        })
        .catch(() => {
          if (isMounted) setServerRoles([]);
        })
        .finally(() => {
          if (isMounted) setLoadingRoles(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, serverId, token, roles?.length]);

  if (!isOpen) return null;

  const handleToggleRole = (roleId) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor, informe o nome do canal.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onCreateChannel({
        name: name.trim(),
        type,
        category: category.trim() || (type === 'TEXT' ? 'Canais de Texto' : 'Canais de Voz'),
        is_private: isPrivate,
        allowed_role_ids: isPrivate ? selectedRoleIds : [],
      });
      setName('');
      setType('TEXT');
      setIsPrivate(false);
      setSelectedRoleIds([]);
      onClose();
    } catch (err) {
      setError(err.message || 'Falha ao criar canal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="discord-modal-backdrop"
      data-testid="create-channel-modal"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="discord-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: 'min(640px, calc(100vh - 48px))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Hash size={22} color="#5865f2" />
            <h3 className="discord-modal-title">Criar Canal</h3>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="discord-modal-form"
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <div className="modal-body" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {error && <div className="form-error-banner">{error}</div>}

            <div className="form-group">
              <label className="form-label">Tipo de Canal</label>
              <div className="channel-type-selector">
                {/* Opção 1: Canal de Texto */}
                <div
                  className={`channel-type-card ${type === 'TEXT' ? 'selected' : ''}`}
                  onClick={() => {
                    setType('TEXT');
                    setCategory('Canais de Texto');
                  }}
                  data-testid="channel-type-text"
                  role="button"
                  tabIndex={0}
                >
                  <div className="channel-type-card-left">
                    <Hash size={24} className="channel-type-icon" />
                    <div className="channel-type-card-info">
                      <span className="channel-type-title">Texto</span>
                      <span className="channel-type-desc">Poste mensagens, imagens e anexos</span>
                    </div>
                  </div>
                  <div className="channel-type-radio-outer">
                    {type === 'TEXT' && <div className="channel-type-radio-inner" />}
                  </div>
                  <input
                    type="radio"
                    name="channelType"
                    value="TEXT"
                    checked={type === 'TEXT'}
                    onChange={() => {
                      setType('TEXT');
                      setCategory('Canais de Texto');
                    }}
                    className="visually-hidden"
                  />
                </div>

                {/* Opção 2: Canal de Voz */}
                <div
                  className={`channel-type-card ${type === 'VOICE' ? 'selected' : ''}`}
                  onClick={() => {
                    setType('VOICE');
                    setCategory('Canais de Voz');
                  }}
                  data-testid="channel-type-voice"
                  role="button"
                  tabIndex={0}
                >
                  <div className="channel-type-card-left">
                    <Volume2 size={24} className="channel-type-icon" />
                    <div className="channel-type-card-info">
                      <span className="channel-type-title">Voz</span>
                      <span className="channel-type-desc">Converse por áudio, microfone e tela</span>
                    </div>
                  </div>
                  <div className="channel-type-radio-outer">
                    {type === 'VOICE' && <div className="channel-type-radio-inner" />}
                  </div>
                  <input
                    type="radio"
                    name="channelType"
                    value="VOICE"
                    checked={type === 'VOICE'}
                    onChange={() => {
                      setType('VOICE');
                      setCategory('Canais de Voz');
                    }}
                    className="visually-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Nome do Canal *</label>
              <div className="channel-name-input-wrapper">
                <span className="channel-name-prefix">
                  {type === 'TEXT' ? '#' : '🔊'}
                </span>
                <input
                  type="text"
                  className="form-input channel-input-with-prefix"
                  placeholder="novo-canal"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                  maxLength={100}
                  required
                  disabled={isSubmitting}
                  data-testid="channel-name-input"
                  autoFocus
                />
              </div>
            </div>

            {/* Toggle de Canal Privado */}
            <div className="form-group" style={{ marginTop: '14px' }}>
              <div
                className="channel-private-toggle-box"
                onClick={() => setIsPrivate(!isPrivate)}
                data-testid="channel-private-toggle"
                role="button"
                tabIndex={0}
              >
                <div className="channel-private-toggle-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Lock size={16} color="#f2f3f5" />
                    <span className="channel-private-toggle-title">Canal Privado</span>
                  </div>
                  <span className="channel-private-toggle-desc">
                    Apenas membros com cargos específicos poderão ver e acessar este canal.
                  </span>
                </div>
                <div className={`channel-toggle-switch ${isPrivate ? 'active' : ''}`}>
                  <div className="channel-toggle-handle" />
                </div>
              </div>

              {/* Lista de Cargos Permitidos (quando privado) */}
              {isPrivate && (
                <div className="channel-roles-permission-box" data-testid="channel-roles-permission-box">
                  <div className="channel-roles-header">
                    <span className="channel-roles-title">QUEM PODE ACESSAR ESTE CANAL?</span>
                    <span className="channel-roles-subtitle">
                      Dono e administradores do servidor sempre têm acesso total garantido.
                    </span>
                  </div>

                  {loadingRoles ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#949ba4', fontSize: '13px', padding: '12px 0' }}>
                      <Loader2 size={16} className="spinner" />
                      <span>Carregando cargos do servidor...</span>
                    </div>
                  ) : serverRoles.length === 0 ? (
                    <div className="channel-roles-empty" data-testid="channel-roles-empty">
                      <span>Nenhum cargo configurado. Apenas o Dono e Administradores poderão acessar.</span>
                    </div>
                  ) : (
                    <div className="channel-roles-list">
                      {serverRoles.map((role) => {
                        const isSelected = selectedRoleIds.includes(role.id);
                        return (
                          <div
                            key={role.id}
                            className={`channel-role-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => handleToggleRole(role.id)}
                            data-testid={`channel-role-item-${role.id}`}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="channel-role-item-left">
                              <div
                                className="channel-role-color-dot"
                                style={{ backgroundColor: role.color || '#99aab5' }}
                              />
                              <span className="channel-role-name" style={{ color: role.color || '#f2f3f5' }}>
                                {role.name}
                              </span>
                              {role.is_admin && (
                                <span className="channel-role-admin-badge">Admin</span>
                              )}
                            </div>
                            <div className={`channel-role-checkbox ${isSelected ? 'checked' : ''}`}>
                              {isSelected && <Check size={14} color="#ffffff" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer" style={{ flexShrink: 0 }}>
            <button
              type="button"
              className="discord-modal-btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
              data-testid="channel-cancel-btn"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="discord-modal-btn btn-primary"
              disabled={isSubmitting || !name.trim()}
              data-testid="channel-submit-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="spinner" />
                  <span>Criando...</span>
                </>
              ) : (
                <span>Criar Canal</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
