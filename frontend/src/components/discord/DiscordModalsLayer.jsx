import React, { useState } from 'react';
import CreateServerModal from './CreateServerModal';
import CreateChannelModal from './CreateChannelModal';
import ServerInviteModal from './ServerInviteModal';
import DeleteMessageModal from './DeleteMessageModal';
import DeleteServerModal from './DeleteServerModal';
import NewDMModal from './NewDMModal';
import ServerSettingsModal from './ServerSettingsModal';
import UserSettingsModal from './UserSettingsModal';
import EditChannelModal from './EditChannelModal';

/**
 * Hook dedicado para encapsular os estados de abertura/fechamento dos modais do Discord.
 */
export function useDiscordModalsState() {
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isNewDMOpen, setIsNewDMOpen] = useState(false);
  const [isServerSettingsOpen, setIsServerSettingsOpen] = useState(false);
  const [isUserSettingsOpen, setIsUserSettingsOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [serverToDelete, setServerToDelete] = useState(null);
  const [isDeleteServerOpen, setIsDeleteServerOpen] = useState(false);
  const [channelToEdit, setChannelToEdit] = useState(null);
  const [isEditChannelOpen, setIsEditChannelOpen] = useState(false);

  return {
    isCreateServerOpen,
    setIsCreateServerOpen,
    isCreateChannelOpen,
    setIsCreateChannelOpen,
    isInviteOpen,
    setIsInviteOpen,
    isNewDMOpen,
    setIsNewDMOpen,
    isServerSettingsOpen,
    setIsServerSettingsOpen,
    isUserSettingsOpen,
    setIsUserSettingsOpen,
    messageToDelete,
    setMessageToDelete,
    isDeleteModalOpen,
    setIsDeleteModalOpen,
    serverToDelete,
    setServerToDelete,
    isDeleteServerOpen,
    setIsDeleteServerOpen,
    channelToEdit,
    setChannelToEdit,
    isEditChannelOpen,
    setIsEditChannelOpen,
  };
}

/**
 * Camada centralizada de modais do módulo Discord (Criação, Convites,
 * Configurações de Servidor/Usuário, Nova DM e Confirmações de Deleção).
 */
export default function DiscordModalsLayer({
  modals,
  token,
  currentUser,
  activeServer,
  activeServerId,
  channels = [],
  members = [],
  setServers,
  setMembers,
  onUserUpdated,
  onLogout,
  handleCreateServer,
  handleCreateChannel,
  handleUpdateChannel,
  handleDeleteChannel,
  handleCreateInvite,
  handleOpenDeleteServer,
  handleGeneralConfirmDelete,
  onSelectDMUser,
  handleConfirmDeleteServer,
  ...legacyProps
}) {
  const state = modals || legacyProps;

  const closeDeleteMsg =
    legacyProps.onCloseDeleteMessageModal ||
    (() => {
      state.setIsDeleteModalOpen && state.setIsDeleteModalOpen(false);
      state.setMessageToDelete && state.setMessageToDelete(null);
    });

  const closeDeleteSrv =
    legacyProps.onCloseDeleteServerModal ||
    (() => {
      state.setIsDeleteServerOpen && state.setIsDeleteServerOpen(false);
      state.setServerToDelete && state.setServerToDelete(null);
    });

  return (
    <>
      <CreateServerModal
        isOpen={Boolean(state.isCreateServerOpen)}
        onClose={() => state.setIsCreateServerOpen(false)}
        onCreateServer={handleCreateServer}
      />
      <CreateChannelModal
        isOpen={Boolean(state.isCreateChannelOpen)}
        onClose={() => state.setIsCreateChannelOpen(false)}
        onCreateChannel={handleCreateChannel}
        serverId={activeServerId}
        token={token}
        existingChannels={channels}
      />
      <EditChannelModal
        isOpen={Boolean(state.isEditChannelOpen)}
        channel={state.channelToEdit}
        onClose={() => {
          state.setIsEditChannelOpen && state.setIsEditChannelOpen(false);
          state.setChannelToEdit && state.setChannelToEdit(null);
        }}
        onUpdateChannel={handleUpdateChannel}
        onDeleteChannel={handleDeleteChannel}
        serverId={activeServerId}
        token={token}
        existingChannels={channels}
      />
      <ServerInviteModal
        isOpen={Boolean(state.isInviteOpen)}
        onClose={() => state.setIsInviteOpen(false)}
        server={activeServer}
        onCreateInvite={handleCreateInvite}
      />
      <ServerSettingsModal
        isOpen={Boolean(state.isServerSettingsOpen)}
        onClose={() => state.setIsServerSettingsOpen(false)}
        server={activeServer}
        channels={channels}
        onServerUpdated={(upd) =>
          setServers((prev) => prev.map((s) => (s.id === upd.id ? { ...s, ...upd } : s)))
        }
        currentUser={currentUser}
        members={members}
        onMembersUpdated={(upd) => setMembers(upd)}
        onOpenDeleteServer={handleOpenDeleteServer}
      />
      <UserSettingsModal
        isOpen={Boolean(state.isUserSettingsOpen)}
        onClose={() => state.setIsUserSettingsOpen(false)}
        currentUser={currentUser}
        onUserUpdated={onUserUpdated}
        onLogout={() => {
          state.setIsUserSettingsOpen(false);
          onLogout && onLogout();
        }}
      />
      <DeleteMessageModal
        isOpen={Boolean(state.isDeleteModalOpen)}
        message={state.messageToDelete}
        onClose={closeDeleteMsg}
        onConfirmDelete={handleGeneralConfirmDelete}
      />
      <NewDMModal
        isOpen={Boolean(state.isNewDMOpen)}
        onClose={() => state.setIsNewDMOpen(false)}
        token={token}
        onSelectUser={onSelectDMUser}
      />
      <DeleteServerModal
        isOpen={Boolean(state.isDeleteServerOpen)}
        server={state.serverToDelete}
        onClose={closeDeleteSrv}
        onConfirmDelete={handleConfirmDeleteServer}
      />
    </>
  );
}
