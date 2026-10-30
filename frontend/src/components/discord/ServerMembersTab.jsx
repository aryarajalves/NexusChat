import React, { useState } from 'react';
import { Search, Shield, User, Loader2, Check } from 'lucide-react';
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

  return (
    <div className="server-tab-content" data-testid="server-members-tab">
      <div className="server-members-tab-header">
        <div>
          <h3 className="server-tab-title">Gerenciar Membros ({members.length})</h3>
          <p className="server-tab-desc">Atribua ou remova cargos dos membros deste servidor.</p>
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
            const isOwner = member.role === 'OWNER';
            const isUpdating = updatingMemberId === member.id;

            return (
              <div
                key={member.id}
                className="server-member-row"
                data-testid={`server-member-row-${member.id}`}
              >
                <div className="server-member-avatar-box">
                  <div className="discord-avatar-wrapper" style={{ width: '36px', height: '36px' }}>
                    {member.avatar_url ? <img src={member.avatar_url} alt={member.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : initial}
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
