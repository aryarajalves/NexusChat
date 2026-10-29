import React, { useState } from 'react';
import { Plus, Trash2, Shield, Save, Loader2, Check } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const PRESET_COLORS = [
  { name: 'Blurple', hex: '#5865f2' },
  { name: 'Verde', hex: '#57f287' },
  { name: 'Amarelo', hex: '#fee75c' },
  { name: 'Fúcsia', hex: '#eb459e' },
  { name: 'Vermelho', hex: '#ed4245' },
  { name: 'Roxo', hex: '#9b59b6' },
  { name: 'Laranja', hex: '#e67e22' },
  { name: 'Turquesa', hex: '#1abc9c' },
  { name: 'Cinza', hex: '#99aab5' },
];

export default function ServerRolesTab({
  server,
  roles = [],
  onRolesUpdated,
  token,
}) {
  const [selectedRoleId, setSelectedRoleId] = useState(roles[0]?.id || null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [roleForm, setRoleForm] = useState({
    name: '',
    color: '#5865f2',
    is_admin: false,
    hoist: true,
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [roleToDelete, setRoleToDelete] = useState(null);

  const { addToast } = useToast();

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

  const handleSelectRole = (role) => {
    setIsCreatingNew(false);
    setSelectedRoleId(role.id);
    setRoleForm({
      name: role.name,
      color: role.color,
      is_admin: role.is_admin,
      hoist: role.hoist,
    });
  };

  const handleStartCreateRole = () => {
    setIsCreatingNew(true);
    setSelectedRoleId(null);
    setRoleForm({
      name: 'Novo Cargo',
      color: '#5865f2',
      is_admin: false,
      hoist: true,
    });
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      addToast('O nome do cargo é obrigatório.', 'error');
      return;
    }

    try {
      setSaving(true);
      const isEdit = !isCreatingNew && selectedRoleId;
      const url = isEdit
        ? `/api/v1/discord/servers/${server.id}/roles/${selectedRoleId}`
        : `/api/v1/discord/servers/${server.id}/roles`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(roleForm),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao salvar cargo');
      }

      const savedRole = await res.json();
      if (isEdit) {
        onRolesUpdated(roles.map((r) => (r.id === savedRole.id ? savedRole : r)));
        addToast(`Cargo '${savedRole.name}' atualizado!`, 'success');
      } else {
        onRolesUpdated([...roles, savedRole]);
        setIsCreatingNew(false);
        setSelectedRoleId(savedRole.id);
        addToast(`Cargo '${savedRole.name}' criado com sucesso!`, 'success');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete) return;

    try {
      setDeletingId(roleToDelete.id);
      const res = await fetch(
        `/api/v1/discord/servers/${server.id}/roles/${roleToDelete.id}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao excluir cargo');
      }

      const remaining = roles.filter((r) => r.id !== roleToDelete.id);
      onRolesUpdated(remaining);
      setSelectedRoleId(remaining[0]?.id || null);
      setIsCreatingNew(false);
      setRoleToDelete(null);
      addToast('Cargo excluído com sucesso.', 'info');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="server-tab-content" data-testid="server-roles-tab">
      <div className="server-roles-container">
        {/* Coluna Esquerda: Lista de Cargos */}
        <div className="server-roles-sidebar">
          <div className="server-roles-sidebar-header">
            <span>Cargos ({roles.length})</span>
            <button
              type="button"
              className="server-create-role-btn"
              onClick={handleStartCreateRole}
              data-testid="create-role-btn"
            >
              <Plus size={14} /> Criar Cargo
            </button>
          </div>

          <div className="server-roles-list" data-testid="roles-list">
            {roles.length === 0 && !isCreatingNew ? (
              <div className="server-roles-empty">Nenhum cargo criado ainda.</div>
            ) : (
              roles.map((role) => {
                const isSelected = !isCreatingNew && role.id === selectedRoleId;
                return (
                  <button
                    key={role.id}
                    type="button"
                    className={`server-role-item ${isSelected ? 'active' : ''}`}
                    onClick={() => handleSelectRole(role)}
                    data-testid={`role-item-${role.id}`}
                  >
                    <span
                      className="role-color-dot"
                      style={{ backgroundColor: role.color }}
                    />
                    <span className="role-item-name">{role.name}</span>
                    {role.is_admin && <Shield size={12} title="Administrador" color="#faa61a" />}
                  </button>
                );
              })
            )}

            {isCreatingNew && (
              <button
                type="button"
                className="server-role-item active"
                style={{ borderLeft: '3px solid #5865f2' }}
              >
                <span
                  className="role-color-dot"
                  style={{ backgroundColor: roleForm.color }}
                />
                <span className="role-item-name">{roleForm.name || 'Novo Cargo'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Coluna Direita: Editor de Cargo */}
        <div className="server-roles-editor">
          {selectedRole || isCreatingNew ? (
            <form onSubmit={handleSaveRole} className="server-settings-form">
              <h4 className="server-editor-title">
                {isCreatingNew ? 'Criando Novo Cargo' : `Editando: ${roleForm.name}`}
              </h4>

              {/* Nome do Cargo */}
              <div className="server-input-group">
                <label className="server-field-label" htmlFor="role-name-input">Nome do Cargo *</label>
                <input
                  id="role-name-input"
                  type="text"
                  className="discord-input"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  maxLength={100}
                  required
                  data-testid="role-name-input"
                />
              </div>

              {/* Seletor de Cores */}
              <div className="server-input-group">
                <label className="server-field-label">Cor do Cargo</label>
                <p className="server-field-help">Os membros usarão a cor deste cargo no chat e na lista lateral.</p>
                <div className="role-color-palette" data-testid="role-color-palette">
                  {PRESET_COLORS.map((preset) => {
                    const isPicked = roleForm.color.toLowerCase() === preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.hex}
                        type="button"
                        className={`role-color-swatch ${isPicked ? 'selected' : ''}`}
                        style={{ backgroundColor: preset.hex }}
                        onClick={() => setRoleForm({ ...roleForm, color: preset.hex })}
                        title={preset.name}
                        data-testid={`role-color-${preset.name.toLowerCase()}`}
                      >
                        {isPicked && <Check size={14} color="#ffffff" />}
                      </button>
                    );
                  })}
                  {/* Color Picker Nativo */}
                  <div className="role-custom-color-wrap" title="Cor personalizada">
                    <input
                      type="color"
                      className="role-custom-color-input"
                      value={roleForm.color.startsWith('#') ? roleForm.color : '#5865f2'}
                      onChange={(e) => setRoleForm({ ...roleForm, color: e.target.value })}
                      data-testid="role-custom-color-picker"
                    />
                  </div>
                </div>
              </div>

              {/* Permissões / Switches */}
              <div className="role-toggles-section">
                <label className="role-toggle-item">
                  <input
                    type="checkbox"
                    checked={roleForm.hoist}
                    onChange={(e) => setRoleForm({ ...roleForm, hoist: e.target.checked })}
                    data-testid="role-hoist-checkbox"
                  />
                  <div>
                    <span className="role-toggle-label">Exibir membros separadamente</span>
                    <span className="role-toggle-desc">Destaca membros deste cargo em uma categoria própria na lista lateral.</span>
                  </div>
                </label>

                <label className="role-toggle-item">
                  <input
                    type="checkbox"
                    checked={roleForm.is_admin}
                    onChange={(e) => setRoleForm({ ...roleForm, is_admin: e.target.checked })}
                    data-testid="role-admin-checkbox"
                  />
                  <div>
                    <span className="role-toggle-label">Permissão de Administrador</span>
                    <span className="role-toggle-desc">Concede controle de canais e configurações do servidor.</span>
                  </div>
                </label>
              </div>

              {/* Botões de Ação */}
              <div className="server-form-footer" style={{ justifyContent: 'space-between' }}>
                {!isCreatingNew && selectedRoleId && (
                  <button
                    type="button"
                    className="discord-btn discord-btn-danger"
                    onClick={() => setRoleToDelete(selectedRole)}
                    data-testid="delete-role-btn"
                  >
                    <Trash2 size={16} /> Excluir Cargo
                  </button>
                )}
                <button
                  type="submit"
                  className="discord-btn discord-btn-primary"
                  disabled={saving}
                  style={{ marginLeft: 'auto' }}
                  data-testid="save-role-btn"
                >
                  {saving ? <Loader2 size={16} className="spin-icon" /> : <Save size={16} />}
                  {saving ? 'Salvando...' : 'Salvar Cargo'}
                </button>
              </div>
            </form>
          ) : (
            <div className="server-roles-empty-hint">
              Selecione um cargo à esquerda ou clique em <strong>+ Criar Cargo</strong> para começar.
            </div>
          )}
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão (Regra de UX: centralizado, backdrop preto, não fecha ao clicar fora) */}
      {roleToDelete && (
        <div className="modal-backdrop" data-testid="delete-role-modal-backdrop">
          <div className="discord-modal-card" style={{ maxWidth: '420px' }} data-testid="delete-role-modal">
            <div className="discord-modal-header">
              <h3 className="discord-modal-title">Excluir Cargo</h3>
            </div>
            <div className="discord-modal-body">
              <p style={{ color: '#dbdee1', fontSize: '14px', lineHeight: 1.5 }}>
                Tem certeza que deseja excluir o cargo <strong>{roleToDelete.name}</strong>? Os membros que possuem este cargo não serão removidos do servidor, mas perderão a cor e as permissões atribuídas.
              </p>
            </div>
            <div className="discord-modal-footer">
              <button
                type="button"
                className="discord-btn discord-btn-secondary"
                onClick={() => setRoleToDelete(null)}
                data-testid="cancel-delete-role-btn"
              >
                Cancelar
              </button>
              <button
                type="button"
                className="discord-btn discord-btn-danger"
                onClick={handleConfirmDelete}
                disabled={deletingId !== null}
                data-testid="confirm-delete-role-btn"
              >
                {deletingId ? <Loader2 size={14} className="spin-icon" /> : <Trash2 size={14} />}
                {deletingId ? 'Excluindo...' : 'Sim, Excluir Cargo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
