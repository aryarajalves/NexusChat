import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function MemberListSidebar({
  members = [],
  currentUserId,
  onStartDM,
}) {
  const ownersAndAdmins = members.filter((m) => m.role === 'OWNER' || m.role === 'ADMIN');
  const regularMembers = members.filter((m) => m.role !== 'OWNER' && m.role !== 'ADMIN');

  const renderMemberRow = (member) => {
    const initial = (member.name || 'U').charAt(0).toUpperCase();
    const isMe = member.user_id === currentUserId;

    return (
      <div key={member.id} className="member-row" data-testid={`member-row-${member.id}`}>
        <div className="discord-avatar-wrapper" style={{ width: '28px', height: '28px', fontSize: '12px', flexShrink: 0 }}>
          {initial}
          <span className="discord-online-badge" />
        </div>
        <span
          className="member-name"
          title={member.nickname || member.name}
          style={member.role_color ? { color: member.role_color, fontWeight: 600 } : {}}
          data-testid={`member-name-${member.id}`}
        >
          {member.nickname || member.name}
        </span>
        {member.role === 'OWNER' && (
          <span className="member-role-badge" title="Dono do Servidor">👑</span>
        )}
        {member.role_name ? (
          <span
            className="member-role-badge"
            style={{
              borderColor: member.role_color || '#5865f2',
              color: member.role_color || '#5865f2',
            }}
            data-testid={`member-custom-role-${member.id}`}
          >
            {member.role_name}
          </span>
        ) : (
          member.role && (member.role === 'OWNER' || member.role === 'ADMIN') && (
            <span className="member-role-badge">{member.role}</span>
          )
        )}
        {!isMe && onStartDM && (
          <button
            type="button"
            className="member-dm-action-btn"
            onClick={(e) => {
              e.stopPropagation();
              onStartDM(member.user_id);
            }}
            title={`Conversar com ${member.name}`}
            data-testid={`member-dm-btn-${member.user_id}`}
            style={{
              marginLeft: 'auto',
              background: 'transparent',
              border: 'none',
              color: '#949ba4',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
            }}
          >
            <MessageSquare size={14} />
          </button>
        )}
      </div>
    );
  };

  return (
    <aside className="discord-member-sidebar" aria-label="Membros do Servidor" data-testid="member-list-sidebar">
      {ownersAndAdmins.length > 0 && (
        <div>
          <div className="member-group-title">Administração — {ownersAndAdmins.length}</div>
          {ownersAndAdmins.map(renderMemberRow)}
        </div>
      )}

      {regularMembers.length > 0 && (
        <div>
          <div className="member-group-title">Membros — {regularMembers.length}</div>
          {regularMembers.map(renderMemberRow)}
        </div>
      )}
    </aside>
  );
}
