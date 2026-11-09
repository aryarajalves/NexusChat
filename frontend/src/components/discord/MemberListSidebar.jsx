import React, { useState } from 'react';
import { MessageSquare, UserMinus, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function MemberListSidebar({
  members = [],
  currentUserId,
  currentUserRole,
  activeServer,
  token,
  onStartDM,
  onMemberRemoved,
  onKickMember,
  currentUser,
}) {
  const [memberToKick, setMemberToKick] = useState(null);
  const [isKicking, setIsKicking] = useState(false);

  let addToast = () => {};
  try {
    const toastContext = useToast();
    if (toastContext?.addToast) addToast = toastContext.addToast;
  } catch {
    // fallback para testes unitários isolados sem provider
  }

  const isServerOwner = activeServer?.owner_id === currentUserId || currentUserRole === 'superadmin';
  const currentMember = members.find((m) => m.user_id === currentUserId);
  const isServerAdmin =
    isServerOwner ||
    currentMember?.role === 'ADMIN' ||
    currentMember?.role === 'OWNER' ||
    Boolean(currentMember?.role_name?.toLowerCase().includes('admin'));

  const isMemberOnline = (m) => {
    if (m.user_id === currentUserId) return true;
    return m.is_online !== false;
  };

  const onlineMembers = members.filter(isMemberOnline);
  const offlineMembers = members.filter((m) => !isMemberOnline(m));

  const onlineOwnersAndAdmins = onlineMembers.filter(
    (m) => m.role === 'OWNER' || m.role === 'ADMIN' || Boolean(m.role_name?.toLowerCase().includes('admin'))
  );
  const onlineRegularMembers = onlineMembers.filter((m) => !onlineOwnersAndAdmins.includes(m));

  const handleConfirmKick = async () => {
    if (!memberToKick || !activeServer?.id) return;
    setIsKicking(true);

    try {
      if (onKickMember) {
        await onKickMember(memberToKick);
      } else {
        const authToken = token || localStorage.getItem('token') || '';
        const targetId = memberToKick.user_id || memberToKick.id;
        const res = await fetch(`/api/v1/discord/servers/${activeServer.id}/members/${targetId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || 'Falha ao remover membro do servidor');
        }
      }

      const targetName = memberToKick.nickname || memberToKick.name;
      addToast(`Membro '${targetName}' removido com sucesso.`, 'success');

      if (onMemberRemoved) {
        onMemberRemoved(memberToKick.user_id || memberToKick.id);
      }
      setMemberToKick(null);
    } catch (err) {
      addToast(err.message || 'Erro ao remover membro', 'error');
    } finally {
      setIsKicking(false);
    }
  };

  const renderMemberRow = (member) => {
    const initial = (member.name || 'U').charAt(0).toUpperCase();
    const isMe = member.user_id === currentUserId || member.id === currentUserId;
    const isOnline = isMe || member.is_online !== false;
    const isTargetOwner = member.user_id === activeServer?.owner_id || member.role === 'OWNER';
    const isTargetAdmin = member.role === 'ADMIN' || Boolean(member.role_name?.toLowerCase().includes('admin'));
    const canKickThisMember =
      isServerAdmin &&
      !isMe &&
      !isTargetOwner &&
      (isServerOwner || !isTargetAdmin);
    const avatarUrl = isMe ? (currentUser?.avatar_url || member.avatar_url) : member.avatar_url;

    return (
      <div
        key={member.id}
        className={`member-row ${isOnline ? 'is-online' : 'is-offline'}`}
        data-testid={`member-row-${member.id}`}
        style={!isOnline ? { opacity: 0.65 } : undefined}
      >
        <div
          className={`discord-avatar-wrapper ${isOnline ? 'has-online-ring' : 'is-offline-avatar'}`}
          style={{ width: '32px', height: '32px', fontSize: '13px', flexShrink: 0 }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={member.name}
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              data-testid={`member-avatar-img-${member.id}`}
            />
          ) : (
            initial
          )}
          <span
            className={`discord-online-badge ${isOnline ? 'online-glow' : 'offline-dot'}`}
            data-testid={`member-presence-${member.user_id}`}
            title={isOnline ? 'Online' : 'Offline'}
            style={!isOnline ? { backgroundColor: '#80848e' } : undefined}
          />
        </div>

        <div className="member-info-col">
          <div className="member-name-row">
            <span
              className="member-name"
              title={member.nickname || member.name}
              style={member.role_color ? { color: member.role_color, fontWeight: 600 } : {}}
              data-testid={`member-name-${member.id}`}
            >
              {member.nickname || member.name}
            </span>
            {member.role === 'OWNER' && (
              <span className="member-role-badge owner-crown" title="Dono do Servidor">👑</span>
            )}
            {member.role_name ? (
              <span
                className="member-role-badge custom-role-badge"
                style={{
                  borderColor: member.role_color || '#5865f2',
                  backgroundColor: member.role_color ? `${member.role_color}33` : 'rgba(88, 101, 242, 0.3)',
                  color: '#ffffff',
                }}
                data-testid={`member-custom-role-${member.id}`}
              >
                {member.role_name}
              </span>
            ) : (
              member.role && (member.role === 'OWNER' || member.role === 'ADMIN') && (
                <span
                  className="member-role-badge default-role-badge"
                  style={{ backgroundColor: '#5865f2', color: '#ffffff' }}
                  data-testid={`member-role-badge-${member.id}`}
                >
                  {member.role}
                </span>
              )
            )}
          </div>
          <div className={`member-status-subtext ${isOnline ? 'online' : 'offline'}`} data-testid={`member-status-text-${member.user_id}`}>
            {isOnline ? '● Online' : 'Offline'}
          </div>
        </div>

        <div className="member-actions-wrapper" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
          {!isMe && onStartDM && (
            <button
              type="button"
              className="member-dm-action-btn member-action-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onStartDM(member.user_id);
              }}
              title={`Conversar com ${member.name}`}
              data-testid={`member-dm-btn-${member.user_id}`}
            >
              <MessageSquare size={14} />
            </button>
          )}

          {canKickThisMember && (
            <button
              type="button"
              className="member-kick-action-btn member-action-icon-btn kick"
              onClick={(e) => {
                e.stopPropagation();
                setMemberToKick(member);
              }}
              title={`Remover ${member.nickname || member.name} do servidor`}
              data-testid={`member-kick-btn-${member.user_id}`}
            >
              <UserMinus size={14} />
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <aside className="discord-member-sidebar" aria-label="Membros do Servidor" data-testid="member-list-sidebar">
      {onlineOwnersAndAdmins.length > 0 && (
        <div>
          <div className="member-group-header">
            <div className="member-group-title">Administração — {onlineOwnersAndAdmins.length}</div>
          </div>
          {onlineOwnersAndAdmins.map(renderMemberRow)}
        </div>
      )}

      {onlineRegularMembers.length > 0 && (
        <div>
          <div className="member-group-header">
            <div className="member-group-title">Membros — {onlineRegularMembers.length}</div>
          </div>
          {onlineRegularMembers.map(renderMemberRow)}
        </div>
      )}

      {offlineMembers.length > 0 && (
        <div>
          <div className="member-group-header offline">
            <div className="member-group-title" data-testid="offline-group-title">
              Offline — {offlineMembers.length}
            </div>
          </div>
          {offlineMembers.map(renderMemberRow)}
        </div>
      )}

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
              Tem certeza que deseja remover <strong style={{ color: '#fff' }}>{memberToKick.nickname || memberToKick.name}</strong> do servidor <strong style={{ color: '#fff' }}>{activeServer?.name || 'este servidor'}</strong>? O usuário perderá o acesso imediato aos canais até ser convidado novamente.
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
    </aside>
  );
}
