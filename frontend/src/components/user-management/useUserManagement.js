import { useState, useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  deleteUserApi,
  bulkDeleteUsersApi,
  deleteInviteApi,
  bulkDeleteInvitesApi,
} from './userManagementApi';

export function useUserManagement(currentUser) {
  const [activeSubTab, setActiveSubTab] = useState(() => {
    return localStorage.getItem('active_subtab_usermanagement') || 'users';
  });

  const handleSelectSubTab = (subTab) => {
    setActiveSubTab(subTab);
    localStorage.setItem('active_subtab_usermanagement', subTab);
  };

  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState('user');
  const [expireHours, setExpireHours] = useState(24);
  const [generatedInvite, setGeneratedInvite] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Edição de Usuário
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('user');

  // Redefinição de Senha
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetData, setResetData] = useState(null);
  const [resetCopied, setResetCopied] = useState(false);

  // Seleção Múltipla
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [selectedInviteIds, setSelectedInviteIds] = useState([]);

  // Filtros
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [inviteStatusFilter, setInviteStatusFilter] = useState('all');

  // Paginação (20 por página)
  const [usersPage, setUsersPage] = useState(1);
  const [invitesPage, setInvitesPage] = useState(1);
  const PAGE_SIZE = 20;

  // Modal de Confirmação de Exclusão
  const [confirmDeleteModal, setConfirmDeleteModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmAction: null,
    loading: false,
  });

  const { addToast } = useToast();

  const fetchUsers = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/v1/auth/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchInvites = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/v1/auth/invites', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInvites(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers();
    if (currentUser?.role === 'superadmin' || currentUser?.role === 'admin') {
      fetchInvites();
    }
  }, [currentUser]);

  const handleCreateInvite = async (e) => {
    e.preventDefault();
    setError('');
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/v1/auth/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: inviteRole,
          duration_hours: Number(expireHours),
        }),
      });

      let data = {};
      const responseText = await res.text();
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        data = { detail: 'Erro interno no servidor ao processar o convite.' };
      }

      if (!res.ok) {
        const errorMsg = data.detail || 'Erro ao gerar convite.';
        addToast(errorMsg, 'error');
        throw new Error(errorMsg);
      }

      const fullUrl = `${window.location.origin}/register?token=${data.token}`;
      setGeneratedInvite({ ...data, fullUrl });
      addToast('Convite gerado com sucesso!', 'success');
      fetchInvites();
    } catch (err) {
      setError(err.message || 'Erro ao criar convite.');
    }
  };

  const copyToClipboard = (textToCopy) => {
    const url = textToCopy || generatedInvite?.fullUrl;
    if (url) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      addToast('Link copiado!', 'success');
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleOpenEdit = (user) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setEditModalOpen(true);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`/api/v1/auth/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: selectedRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao atualizar perfil.');

      addToast(`Perfil de ${editingUser.name} alterado com sucesso!`, 'success');
      setEditModalOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      addToast(err.message || 'Erro ao atualizar perfil.', 'error');
    }
  };

  const handleRequestPasswordReset = async (user) => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`/api/v1/auth/users/${user.id}/reset-password-request`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Erro ao solicitar redefinição.');

      const fullUrl = `${window.location.origin}${data.reset_url}`;
      setResetData({ ...data, fullUrl });
      setResetModalOpen(true);
      addToast('Link de redefinição gerado!', 'success');
    } catch (err) {
      addToast(err.message || 'Erro ao gerar link de redefinição.', 'error');
    }
  };

  const copyResetLink = () => {
    if (resetData?.fullUrl) {
      navigator.clipboard.writeText(resetData.fullUrl);
      setResetCopied(true);
      addToast('Link de redefinição copiado!', 'success');
      setTimeout(() => setResetCopied(false), 2500);
    }
  };

  const closeConfirmDeleteModal = () => {
    setConfirmDeleteModal({
      isOpen: false,
      title: '',
      message: '',
      confirmAction: null,
      loading: false,
    });
  };

  const handleDeleteUser = (userId, userName) => {
    setConfirmDeleteModal({
      isOpen: true,
      title: 'Excluir Usuário',
      message: `Tem certeza que deseja excluir o usuário "${userName}"? Esta ação é irreversível.`,
      confirmAction: async () => {
        setConfirmDeleteModal((prev) => ({ ...prev, loading: true }));
        const token = localStorage.getItem('auth_token');
        try {
          await deleteUserApi(userId, token);
          addToast('Usuário excluído com sucesso!', 'success');
          setSelectedUserIds((prev) => prev.filter((id) => id !== userId));
          closeConfirmDeleteModal();
          fetchUsers();
        } catch (err) {
          addToast(err.message || 'Erro ao excluir usuário.', 'error');
          setConfirmDeleteModal((prev) => ({ ...prev, loading: false }));
        }
      },
      loading: false,
    });
  };

  const handleBulkDeleteUsers = () => {
    if (selectedUserIds.length === 0) return;
    setConfirmDeleteModal({
      isOpen: true,
      title: 'Excluir Usuários Selecionados',
      message: `Tem certeza que deseja excluir os ${selectedUserIds.length} usuário(s) selecionado(s)? Esta ação é irreversível.`,
      confirmAction: async () => {
        setConfirmDeleteModal((prev) => ({ ...prev, loading: true }));
        const token = localStorage.getItem('auth_token');
        try {
          const data = await bulkDeleteUsersApi(selectedUserIds, token);
          addToast(data.message || 'Usuários excluídos com sucesso!', 'success');
          setSelectedUserIds([]);
          closeConfirmDeleteModal();
          fetchUsers();
        } catch (err) {
          addToast(err.message || 'Erro ao excluir usuários.', 'error');
          setConfirmDeleteModal((prev) => ({ ...prev, loading: false }));
        }
      },
      loading: false,
    });
  };

  const handleDeleteInvite = (inviteId) => {
    setConfirmDeleteModal({
      isOpen: true,
      title: 'Excluir Convite',
      message: 'Tem certeza que deseja excluir este convite? Ele não poderá mais ser utilizado.',
      confirmAction: async () => {
        setConfirmDeleteModal((prev) => ({ ...prev, loading: true }));
        const token = localStorage.getItem('auth_token');
        try {
          await deleteInviteApi(inviteId, token);
          addToast('Convite excluído com sucesso!', 'success');
          setSelectedInviteIds((prev) => prev.filter((id) => id !== inviteId));
          closeConfirmDeleteModal();
          fetchInvites();
        } catch (err) {
          addToast(err.message || 'Erro ao excluir convite.', 'error');
          setConfirmDeleteModal((prev) => ({ ...prev, loading: false }));
        }
      },
      loading: false,
    });
  };

  const handleBulkDeleteInvites = () => {
    if (selectedInviteIds.length === 0) return;
    setConfirmDeleteModal({
      isOpen: true,
      title: 'Excluir Convites Selecionados',
      message: `Tem certeza que deseja excluir os ${selectedInviteIds.length} convite(s) selecionado(s)? Esta ação é irreversível.`,
      confirmAction: async () => {
        setConfirmDeleteModal((prev) => ({ ...prev, loading: true }));
        const token = localStorage.getItem('auth_token');
        try {
          const data = await bulkDeleteInvitesApi(selectedInviteIds, token);
          addToast(data.message || 'Convites excluídos com sucesso!', 'success');
          setSelectedInviteIds([]);
          closeConfirmDeleteModal();
          fetchInvites();
        } catch (err) {
          addToast(err.message || 'Erro ao excluir convites.', 'error');
          setConfirmDeleteModal((prev) => ({ ...prev, loading: false }));
        }
      },
      loading: false,
    });
  };

  // Filtros
  const filteredUsers = users.filter((u) => userRoleFilter === 'all' || u.role === userRoleFilter);
  const filteredInvites = invites.filter((inv) => {
    if (inviteStatusFilter === 'all') return true;
    if (inviteStatusFilter === 'used') return inv.is_used;
    if (inviteStatusFilter === 'expired') return !inv.is_used && inv.is_expired;
    if (inviteStatusFilter === 'pending') return !inv.is_used && !inv.is_expired;
    return true;
  });

  // Paginação
  const totalUserPages = Math.ceil(filteredUsers.length / PAGE_SIZE) || 1;
  const paginatedUsers = filteredUsers.slice((usersPage - 1) * PAGE_SIZE, usersPage * PAGE_SIZE);

  const totalInvitePages = Math.ceil(filteredInvites.length / PAGE_SIZE) || 1;
  const paginatedInvites = filteredInvites.slice((invitesPage - 1) * PAGE_SIZE, invitesPage * PAGE_SIZE);

  const selectableUserIds = paginatedUsers.filter((u) => u.role !== 'superadmin').map((u) => u.id);
  const isAllUsersSelected = selectableUserIds.length > 0 && selectableUserIds.every((id) => selectedUserIds.includes(id));

  const toggleSelectAllUsers = () => {
    if (isAllUsersSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !selectableUserIds.includes(id)));
    } else {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...selectableUserIds])));
    }
  };

  const toggleSelectUser = (id) => {
    setSelectedUserIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const paginatedInviteIds = paginatedInvites.map((i) => i.id);
  const isAllInvitesSelected = paginatedInviteIds.length > 0 && paginatedInviteIds.every((id) => selectedInviteIds.includes(id));

  const toggleSelectAllInvites = () => {
    if (isAllInvitesSelected) {
      setSelectedInviteIds((prev) => prev.filter((id) => !paginatedInviteIds.includes(id)));
    } else {
      setSelectedInviteIds((prev) => Array.from(new Set([...prev, ...paginatedInviteIds])));
    }
  };

  const toggleSelectInvite = (id) => {
    setSelectedInviteIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const canCreate = currentUser?.role === 'superadmin' || currentUser?.role === 'admin';

  return {
    activeSubTab,
    handleSelectSubTab,
    users,
    invites,
    fetchUsers,
    fetchInvites,
    modalOpen,
    setModalOpen,
    createUserModalOpen,
    setCreateUserModalOpen,
    inviteRole,
    setInviteRole,
    expireHours,
    setExpireHours,
    generatedInvite,
    setGeneratedInvite,
    copied,
    error,
    setError,
    handleCreateInvite,
    copyToClipboard,
    editModalOpen,
    setEditModalOpen,
    editingUser,
    selectedRole,
    setSelectedRole,
    handleOpenEdit,
    handleSaveRole,
    resetModalOpen,
    setResetModalOpen,
    resetData,
    resetCopied,
    handleRequestPasswordReset,
    copyResetLink,
    confirmDeleteModal,
    closeConfirmDeleteModal,
    handleDeleteUser,
    handleBulkDeleteUsers,
    handleDeleteInvite,
    handleBulkDeleteInvites,
    userRoleFilter,
    setUserRoleFilter,
    inviteStatusFilter,
    setInviteStatusFilter,
    usersPage,
    setUsersPage,
    totalUserPages,
    filteredUsers,
    paginatedUsers,
    invitesPage,
    setInvitesPage,
    totalInvitePages,
    filteredInvites,
    paginatedInvites,
    PAGE_SIZE,
    selectedUserIds,
    setSelectedUserIds,
    selectableUserIds,
    isAllUsersSelected,
    toggleSelectAllUsers,
    toggleSelectUser,
    selectedInviteIds,
    setSelectedInviteIds,
    paginatedInviteIds,
    isAllInvitesSelected,
    toggleSelectAllInvites,
    toggleSelectInvite,
    canCreate,
    addToast,
  };
}
