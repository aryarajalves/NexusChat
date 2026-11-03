import React, { useState } from 'react';
import { Search, Loader2, UserMinus } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ServerMembersTab({
  server,
  members = [],
  roles = [],
  onMembersUpdated,
  token,
  currentUserId,
}) {
  const [filterText, setFilterText] = useState('');
  const [updatingMemberId, setUpdatingMemberId] = useState(null);
  const [memberToKick, setMemberToKick] = useState(null);
  const [isKicking, setIsKicking] = useState(false);
  const { addToast } = useToast();

  const filteredMembers = members.filter((m) => {
    const term = filterText.toLowerCase().trim();
    const name = (m.nickname || m.name || '').toLowerCase();
    const email = (m.email || '').toLowerCase();
    return name.includes(term) || email.includes(term);
  });

  const handleRoleChange = async (member, newRoleId) => {
    const roleIdVal = newRoleId === '' ? null : parseInt(newRoleId, 10);

    try {
      setUpdatingMemberId(member.id);
      const res = await fetch(
        `/api/v1/discord/servers/${server.id}/members/${member.id}/role`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role_id: roleIdVal }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao atualizar cargo do membro');
      }

      const updatedMember = await res.json();
      onMembersUpdated(
        members.map((m) => (m.id === updatedMember.id ? updatedMember : m))
      );

      const targetRole = roles.find((r) => r.id === roleIdVal);
      if (targetRole) {
        addToast(`Cargo '${targetRole.name}' atribuído a ${member.name}!`, 'success');
      } else {
        addToast(`Cargo removido de ${member.name}.`, 'info');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleConfirmKick = async () => {
    if (!memberToKick || !server?.id) return;
    setIsKicking(true);

    try {
      const targetId = memberToKick.user_id || memberToKick.id;
      const res = await fetch(
        `/api/v1/discord/servers/${server.id}/members/${targetId}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Falha ao remover membro do servidor');
      }

      const targetName = memberToKick.nickname || memberToKick.name;
      addToast(`Membro '${targetName}' removido com sucesso.`, 'success');

      if (onMembersUpdated) {
        onMembersUpdated(members.filter((m) => m.id !== memberToKick.id && m.user_id !== memberToKick.user_id));
      }
      setMemberToKick(null);
    } catch (err) {
      addToast(err.message || 'Erro ao remover membro', 'error');
    } finally {
      setIsKicking(false);
    }
  };

  return (
    <div className="server-tab-content" data-testid="server-members-tab">
      <div className="server-members-tab-header">
        <div>
          <h3 className="server-tab-title">Gerenciar Membros ({members.length})</h3>
          <p className="server-tab-desc">Atribua cargos ou remova membros deste servidor.</p>
        </div>

        {/* Campo de Busca */}
        <div className="server-search-input-wrap">
          <Search size={16} color="#949ba4" />
          <input
            type="text"
            className="discord-search-input"
            placeholder="Buscar por nome ou e-mail..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            data-testid="search-members-input"
          />
        </div>
      </div>

      <div className="server-members-list" data-testid="server-members-list">
        {filteredMembers.length === 0 ? (
          <div className="server-roles-empty">Nenhum membro encontrado.</div>
        ) : (
          filteredMembers.map((member) => {
            const initial = (member.name || 'U').charAt(0).toUpperCase();
            const isOwner = member.role === 'OWNER' || member.user_id === server?.owner_id;
            const isMe = member.user_id === currentUserId;
            const isUpdating = updatingMemberId === member.id;

            return (
              <div
                key={member.id}
                className="server-member-row"
                data-testid={`server-member-row-${member.id}`}
              >
                <div className="server-member-avatar-box">
                  <div className="discord-avatar-wrapper" style={{ width: '36px', height: '36px' }}>
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.name}
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      initial
                    )}
                    <span className="discord-online-badge" />
                  </div>
                </div>

                <div className="server-member-info">
                  <div className="server-member-title-row">
                    <span
                      className="server-member-name"
                      style={member.role_color ? { color: member.role_color, fontWeight: 600 } : {}}
                      data-testid={`member-name-${member.id}`}
                    >
                      {member.nickname || member.name}
                    </span>
                    {isOwner && (
                      <span className="server-role-badge owner" title="Dono do Servidor">
                        👑 DONO
                      </span>
                    )}
                    {member.role_name && (
                      <span
                        className="server-role-badge"
                        style={{
                          borderColor: member.role_color || '#5865f2',
                          color: member.role_color || '#5865f2',
                        }}
                        data-testid={`member-role-badge-${member.id}`}
                      >
                        {member.role_name}
                      </span>
                    )}
                  </div>
                  <span className="server-member-email">{member.email}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {/* Dropdown de Atribuição de Cargo */}
                  <div className="server-member-role-select-box">
                    {isUpdating ? (
                      <div className="server-member-role-loading">
                        <Loader2 size={16} className="spin-icon" />
                      </div>
                    ) : (
                      <select
                        className="discord-role-select"
                        value={member.role_id || ''}
                        onChange={(e) => handleRoleChange(member, e.target.value)}
                        disabled={isUpdating}
                        data-testid={`member-role-select-${member.id}`}
                      >
                        <option value="">Nenhum Cargo</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} {r.is_admin ? '(Admin)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Botão de Remover Membro */}
                  {!isOwner && !isMe && (
                    <button
                      type="button"
                      className="server-member-kick-btn"
                      onClick={() => setMemberToKick(member)}
                      title={`Remover ${member.nickname || member.name} do servidor`}
                      data-testid={`server-tab-kick-btn-${member.id}`}
                      style={{
                        background: 'transparent',
                        border: '1px solid rgba(237, 66, 69, 0.4)',
                        color: '#ed4245',
                        borderRadius: '4px',
                        padding: '6px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 500,
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(237, 66, 69, 0.15)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <UserMinus size={14} />
                      Remover
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Popup Centralizado de Confirmação para Remover Membro */}
      {memberToKick && (
        <div
          className="discord-modal-backdrop"
          data-testid="kick-member-modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="discord-modal-card"
            data-testid="kick-member-modal"
            style={{
              background: '#313338',
              color: '#dbdee1',
              borderRadius: '8px',
              padding: '24px',
              maxWidth: '440px',
              width: '90%',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.65)',
              border: '1px solid rgba(237, 66, 69, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  background: 'rgba(237, 66, 69, 0.15)',
                  padding: '8px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ed4245',
                }}
              >
                <UserMinus size={22} />
              </div>
              <h3 style={{ margin: 0, color: '#f2f3f5', fontSize: '18px', fontWeight: 600 }}>
                Remover Membro
              </h3>
            </div>

            <p style={{ fontSize: '14px', lineHeight: 1.5, color: '#b5bac1', marginBottom: '22px' }}>
              Tem certeza que deseja remover <strong style={{ color: '#fff' }}>{memberToKick.nickname || memberToKick.name}</strong> do servidor <strong style={{ color: '#fff' }}>{server?.name || 'este servidor'}</strong>? O usuário perderá o acesso imediato aos canais até ser convidado novamente.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => !isKicking && setMemberToKick(null)}
                disabled={isKicking}
                data-testid="cancel-kick-member-btn"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#dbdee1',
                  padding: '9px 16px',
                  borderRadius: '4px',
                  cursor: isKicking ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmKick}
                disabled={isKicking}
                data-testid="confirm-kick-member-btn"
                style={{
                  background: '#ed4245',
                  border: 'none',
                  color: '#fff',
                  padding: '9px 18px',
                  borderRadius: '4px',
                  cursor: isKicking ? 'not-allowed' : 'pointer',
                  fontWeight: 500,
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 2px 8px rgba(237, 66, 69, 0.35)',
                }}
              >
                {isKicking && <Loader2 size={16} className="spin-icon" />}
                {isKicking ? 'Removendo...' : 'Remover Membro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
