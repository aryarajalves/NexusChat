import React from 'react';
import { UserPlus, Users, Mail } from 'lucide-react';
import {
  ConfirmDeleteModal,
  UserTableTab,
  InviteTableTab,
  CreateInviteModal,
  CreateUserModal,
  EditUserRoleModal,
  ResetPasswordModal,
  useUserManagement,
} from './user-management';

export default function UserManagement({ currentUser }) {
  const {
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
  } = useUserManagement(currentUser);

  return (
    <div className="users-page">
      <div className="page-header">
        <div>
          <h2>Gestão de Usuários</h2>
          <p>Gerencie o acesso da equipe e acompanhe os convites gerados.</p>
        </div>
        {canCreate && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setCreateUserModalOpen(true)}
              className="primary-btn"
              data-testid="open-create-user-modal-btn"
            >
              <UserPlus size={18} />
              <span>Criar Conta</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setModalOpen(true);
                setGeneratedInvite(null);
                setError('');
              }}
              className="pagination-btn"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                fontSize: '14px',
                fontWeight: 600,
              }}
              data-testid="open-invite-modal-btn"
            >
              <Mail size={16} />
              <span>Convidar Usuário</span>
            </button>
          </div>
        )}
      </div>

      {/* Navegação entre as 2 Abas */}
      <div className="sub-tabs-container">
        <button
          type="button"
          className={`sub-tab-btn ${activeSubTab === 'users' ? 'active' : ''}`}
          onClick={() => handleSelectSubTab('users')}
          data-testid="tab-users-btn"
        >
          <Users size={16} />
          <span>Usuários Criados ({users.length})</span>
        </button>
        <button
          type="button"
          className={`sub-tab-btn ${activeSubTab === 'invites' ? 'active' : ''}`}
          onClick={() => {
            handleSelectSubTab('invites');
            fetchInvites();
          }}
          data-testid="tab-invites-btn"
        >
          <Mail size={16} />
          <span>Convites Gerados ({invites.length})</span>
        </button>
      </div>

      {/* ABA 1: Usuários Criados */}
      {activeSubTab === 'users' && (
        <UserTableTab
          currentUser={currentUser}
          filteredUsers={filteredUsers}
          paginatedUsers={paginatedUsers}
          userRoleFilter={userRoleFilter}
          setUserRoleFilter={setUserRoleFilter}
          selectedUserIds={selectedUserIds}
          setSelectedUserIds={setSelectedUserIds}
          selectableUserIds={selectableUserIds}
          isAllUsersSelected={isAllUsersSelected}
          toggleSelectAllUsers={toggleSelectAllUsers}
          toggleSelectUser={toggleSelectUser}
          handleBulkDeleteUsers={handleBulkDeleteUsers}
          handleOpenEdit={handleOpenEdit}
          handleRequestPasswordReset={handleRequestPasswordReset}
          handleDeleteUser={handleDeleteUser}
          usersPage={usersPage}
          setUsersPage={setUsersPage}
          totalUserPages={totalUserPages}
          pageSize={PAGE_SIZE}
        />
      )}

      {/* ABA 2: Convites Gerados */}
      {activeSubTab === 'invites' && (
        <InviteTableTab
          filteredInvites={filteredInvites}
          paginatedInvites={paginatedInvites}
          inviteStatusFilter={inviteStatusFilter}
          setInviteStatusFilter={setInviteStatusFilter}
          selectedInviteIds={selectedInviteIds}
          setSelectedInviteIds={setSelectedInviteIds}
          paginatedInviteIds={paginatedInviteIds}
          isAllInvitesSelected={isAllInvitesSelected}
          toggleSelectAllInvites={toggleSelectAllInvites}
          toggleSelectInvite={toggleSelectInvite}
          handleBulkDeleteInvites={handleBulkDeleteInvites}
          handleDeleteInvite={handleDeleteInvite}
          copyToClipboard={copyToClipboard}
          invitesPage={invitesPage}
          setInvitesPage={setInvitesPage}
          totalInvitePages={totalInvitePages}
          pageSize={PAGE_SIZE}
        />
      )}

      {/* Modais */}
      <CreateUserModal
        isOpen={createUserModalOpen}
        onClose={() => setCreateUserModalOpen(false)}
        onSuccess={() => {
          fetchUsers();
        }}
      />

      <CreateInviteModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreateInvite}
        error={error}
        inviteRole={inviteRole}
        setInviteRole={setInviteRole}
        expireHours={expireHours}
        setExpireHours={setExpireHours}
        generatedInvite={generatedInvite}
        copied={copied}
        onCopy={() => copyToClipboard()}
        onFinish={() => {
          setGeneratedInvite(null);
          setModalOpen(false);
          fetchUsers();
          fetchInvites();
        }}
        onRedirect={() => addToast('Redirecionando para tela de cadastro...', 'info')}
      />

      <EditUserRoleModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        editingUser={editingUser}
        selectedRole={selectedRole}
        setSelectedRole={setSelectedRole}
        onSave={handleSaveRole}
      />

      <ResetPasswordModal
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        resetData={resetData}
        resetCopied={resetCopied}
        onCopyResetLink={copyResetLink}
        onRedirect={() => addToast('Abrindo tela de redefinição de senha...', 'info')}
      />

      <ConfirmDeleteModal
        isOpen={confirmDeleteModal.isOpen}
        title={confirmDeleteModal.title}
        message={confirmDeleteModal.message}
        loading={confirmDeleteModal.loading}
        onConfirm={confirmDeleteModal.confirmAction}
        onClose={closeConfirmDeleteModal}
      />
    </div>
  );
}
