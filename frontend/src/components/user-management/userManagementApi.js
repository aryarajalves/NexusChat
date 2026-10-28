export const deleteUserApi = async (userId, token) => {
  const res = await fetch(`/api/v1/auth/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Erro ao excluir usuário.');
  return data;
};

export const bulkDeleteUsersApi = async (selectedUserIds, token) => {
  const res = await fetch('/api/v1/auth/users/bulk-delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ids: selectedUserIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Erro ao excluir usuários.');
  return data;
};

export const deleteInviteApi = async (inviteId, token) => {
  const res = await fetch(`/api/v1/auth/invites/${inviteId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Erro ao excluir convite.');
  return data;
};

export const bulkDeleteInvitesApi = async (selectedInviteIds, token) => {
  const res = await fetch('/api/v1/auth/invites/bulk-delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ ids: selectedInviteIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Erro ao excluir convites.');
  return data;
};

export const createUserManualApi = async (userData, token) => {
  const res = await fetch('/api/v1/auth/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(userData),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Erro ao criar conta de usuário.');
  return data;
};
