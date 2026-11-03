import React, { useState, useEffect } from 'react';
import { Hash, Volume2, Lock, Loader2, Check, Trash2, AlertTriangle, X } from 'lucide-react';

const DEFAULT_ROLES = [];

export default function EditChannelModal({
  isOpen,
  onClose,
  channel,
  onUpdateChannel,
  onDeleteChannel,
  roles = DEFAULT_ROLES,
  serverId,
  token,
  existingChannels = [],
}) {
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState([]);
  const [serverRoles, setServerRoles] = useState(roles || []);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !channel) {
      setShowDeleteConfirm(false);
      setError('');
      return;
    }

    setName(channel.name || '');
    setIsPrivate(Boolean(channel.is_private));
    setSelectedRoleIds(Array.isArray(channel.allowed_role_ids) ? channel.allowed_role_ids : []);
    setShowDeleteConfirm(false);
    setError('');

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
          if (isMounted) setServerRoles(Array.isArray(data) ? data : []);
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
  }, [isOpen, channel, serverId, token, roles?.length]);

  if (!isOpen || !channel) return null;

  const handleToggleRole = (roleId) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Por favor, informe o nome do canal.');
      return;
    }

    const formattedName =
      channel?.type === 'TEXT'
        ? trimmedName.toLowerCase().replace(/\s+/g, '-')
        : trimmedName;

    const cleanLower = formattedName.toLowerCase();
    const isDuplicate = existingChannels.some(
      (c) => c.id !== channel?.id && (c.name || '').toLowerCase() === cleanLower
    );
    if (isDuplicate) {
      setError('Já existe um canal com este nome neste servidor (canais de texto e voz não podem ter o mesmo nome).');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onUpdateChannel(channel.id, {
        name: formattedName,
        is_private: isPrivate,
        allowed_role_ids: isPrivate ? selectedRoleIds : [],
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Falha ao atualizar canal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    try {
      setIsDeleting(true);
      setError('');
      await onDeleteChannel(channel.id);
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      setError(err.message || 'Falha ao excluir canal.');
    } finally {
      setIsDeleting(false);
    }
  };

  const isVoice = channel.type === 'VOICE';

  return (
    <div
      className="discord-modal-backdrop"
      data-testid="edit-channel-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) e.stopPropagation();
      }}
    >
      <div
        className="discord-modal-card edit-channel-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: 'min(640px, calc(100vh - 48px))',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Cabeçalho */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isVoice ? <Volume2 size={22} color="#5865f2" /> : <Hash size={22} color="#5865f2" />}
            <div>
              <h3 className="modal-title" style={{ margin: 0 }}>Configurações do Canal</h3>
              <div style={{ fontSize: '12px', color: '#949ba4', marginTop: '2px' }}>
                {isVoice ? 'Canal de Voz' : 'Canal de Texto'} • #{channel.name}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            data-testid="edit-channel-close-btn"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="form-error-banner" data-testid="edit-channel-error" style={{ margin: '12px 16px 0' }}>
            {error}
          </div>
        )}

        {/* Modal de confirmação de exclusão secundário (popup centralizado) */}
        {showDeleteConfirm ? (
          <div className="modal-body" style={{ flex: 1, padding: '20px 24px' }}>
            <div className="channel-delete-confirm-panel" data-testid="delete-channel-confirm-panel">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f87171', marginBottom: '12px' }}>
                <AlertTriangle size={24} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>Excluir Canal</h3>
              </div>
              <p style={{ fontSize: '13.5px', color: '#dbdee1', lineHeight: '1.5', margin: '0 0 16px' }}>
                Tem certeza de que deseja excluir o canal <strong>#{channel.name}</strong>? Esta ação é irreversível e todas as mensagens deste canal serão apagadas permanentemente.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="discord-modal-btn btn-secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  data-testid="cancel-delete-channel-btn"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="discord-modal-btn btn-danger"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  data-testid="confirm-delete-channel-btn"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {isDeleting ? <Loader2 size={16} className="spinner" /> : <Trash2 size={16} />}
                  {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSave}
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
              {/* Nome do Canal */}
              <div className="form-group">
                <label htmlFor="edit-channel-name" className="form-label">
                  NOME DO CANAL *
                </label>
                <div className="channel-name-input-wrapper">
                  <span className="channel-name-prefix">
                    {isVoice ? '🔊' : '#'}
                  </span>
                  <input
                    id="edit-channel-name"
                    type="text"
                    className="form-input channel-input-with-prefix"
                    placeholder="novo-nome"
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                    maxLength={100}
                    required
                    disabled={isSubmitting}
                    data-testid="edit-channel-name-input"
                    autoFocus
                  />
                </div>
              </div>

              {/* Toggle Canal Privado */}
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
                      Apenas membros e cargos selecionados poderão visualizar e participar deste canal.
                    </span>
                  </div>
                  <label className="visually-hidden" data-testid="edit-channel-private-switch">
                    <input
                      type="checkbox"
                      checked={isPrivate}
                      onChange={(e) => setIsPrivate(e.target.checked)}
                    />
                  </label>
                  <div className={`channel-toggle-switch ${isPrivate ? 'active' : ''}`}>
                    <div className="channel-toggle-handle" />
                  </div>
                </div>

                {/* Checklist de Cargos (se privado) */}
                {isPrivate && (
                  <div className="channel-roles-permission-box" data-testid="edit-channel-roles-list">
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
                      <div className="channel-roles-empty">
                        <span>Nenhum cargo personalizado criado neste servidor. O dono e administradores sempre têm acesso.</span>
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
                              data-testid={`role-checkbox-${role.id}`}
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

            {/* Ações do Rodapé */}
            <div className="modal-footer" style={{ flexShrink: 0, justifyContent: 'space-between' }}>
              <button
                type="button"
                className="discord-modal-btn btn-danger"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(237, 66, 69, 0.15)',
                  border: '1px solid rgba(237, 66, 69, 0.6)',
                  color: '#ed4245',
                }}
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isSubmitting}
                data-testid="open-delete-channel-btn"
              >
                <Trash2 size={16} />
                <span>Excluir Canal</span>
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="discord-modal-btn btn-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                  data-testid="edit-channel-cancel-btn"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="discord-modal-btn btn-primary"
                  disabled={isSubmitting || !name.trim()}
                  data-testid="edit-channel-save-btn"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="spinner" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Alterações</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
