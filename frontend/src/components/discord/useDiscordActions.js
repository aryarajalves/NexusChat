import { useCallback } from 'react';
import { useToast } from '../../context/ToastContext';

export function useDiscordActions({
  token,
  activeServerId,
  activeChannelId,
  setMessages,
  setServers,
  setActiveServerId,
  setChannels,
  setActiveChannelId,
  sendMessage,
}) {
  const { addToast } = useToast();

  const handleSendMessage = async (msgPayload) => {
    if (!activeChannelId) return;

    const sentViaWs = sendMessage(msgPayload);
    if (!sentViaWs) {
      const res = await fetch(`/api/v1/discord/channels/${activeChannelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(msgPayload),
      });

      if (res.ok) {
        const newMsg = await res.json();
        setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
      } else {
        const err = await res.json();
        throw new Error(err.detail || 'Falha ao enviar mensagem.');
      }
    }
  };

  const handleEditMessage = async (channelId, messageId, content) => {
    const res = await fetch(`/api/v1/discord/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content }),
    });

    if (res.ok) {
      const updated = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === messageId ? updated : m)));
      addToast('Mensagem editada com sucesso.', 'success');
      return updated;
    } else {
      const err = await res.json();
      addToast(err.detail || 'Erro ao editar mensagem.', 'error');
      throw new Error(err.detail || 'Erro ao editar mensagem.');
    }
  };

  const handleToggleReaction = async (channelId, messageId, emoji) => {
    const res = await fetch(`/api/v1/discord/channels/${channelId}/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ emoji }),
    });

    if (res.ok) {
      const data = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions: data.reactions } : m))
      );
    } else {
      const err = await res.json();
      addToast(err.detail || 'Erro ao reagir.', 'error');
    }
  };

  const handleForwardMessage = async (messageId, targetChannelId) => {
    if (!activeChannelId) return;
    const res = await fetch(`/api/v1/discord/channels/${activeChannelId}/messages/${messageId}/forward`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ target_channel_id: targetChannelId }),
    });

    if (res.ok) {
      const forwarded = await res.json();
      if (targetChannelId === activeChannelId) {
        setMessages((prev) => [...prev, forwarded]);
      }
      addToast('Mensagem encaminhada com sucesso!', 'success');
      return forwarded;
    } else {
      const err = await res.json();
      addToast(err.detail || 'Erro ao encaminhar mensagem.', 'error');
      throw new Error(err.detail || 'Erro ao encaminhar mensagem.');
    }
  };

  const handleUploadAttachment = async (file) => {
    if (!activeChannelId) throw new Error('Nenhum canal ativo');

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`/api/v1/discord/channels/${activeChannelId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Falha ao fazer upload do anexo.');
    }

    return await res.json();
  };

  const handleConfirmDeleteMessage = async (msgId) => {
    if (!activeChannelId) return;

    const res = await fetch(`/api/v1/discord/channels/${activeChannelId}/messages/${msgId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      addToast('Mensagem apagada com sucesso.', 'success');
    } else {
      const err = await res.json();
      addToast(err.detail || 'Erro ao apagar mensagem.', 'error');
      throw new Error(err.detail || 'Erro ao apagar mensagem.');
    }
  };

  const handleCreateServer = async (payload, iconFile = null) => {
    const file = iconFile || payload?.icon_file;
    const bodyPayload = {
      name: payload?.name,
      description: payload?.description,
      icon_url: payload?.icon_url,
    };

    const res = await fetch('/api/v1/discord/servers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bodyPayload),
    });

    if (res.ok) {
      let newServer = await res.json();

      // Faz upload do ícone caso o usuário tenha selecionado uma imagem
      if (file) {
        try {
          const formData = new FormData();
          formData.append('file', file);
          const iconRes = await fetch(`/api/v1/discord/servers/${newServer.id}/icon`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });
          if (iconRes.ok) {
            const iconData = await iconRes.json();
            newServer = { ...newServer, icon_url: iconData.icon_url };
          }
        } catch (e) {
          console.error('Erro ao enviar ícone do novo servidor:', e);
        }
      }

      setServers((prev) => [...prev, newServer]);
      setActiveServerId(newServer.id);
      addToast(`Servidor "${newServer.name}" criado com sucesso!`, 'success');
      return newServer;
    } else {
      const err = await res.json();
      throw new Error(err.detail || 'Falha ao criar servidor.');
    }
  };

  const handleCreateChannel = async (payload) => {
    if (!activeServerId) return;

    const res = await fetch(`/api/v1/discord/servers/${activeServerId}/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const newChannel = await res.json();
      setChannels((prev) => [...prev, newChannel]);
      setActiveChannelId(newChannel.id);
      addToast(`Canal "${newChannel.name}" criado com sucesso!`, 'success');
    } else {
      const err = await res.json();
      throw new Error(err.detail || 'Falha ao criar canal.');
    }
  };

  const handleCreateInvite = useCallback(async (payload) => {
    if (!activeServerId) return;

    const res = await fetch(`/api/v1/discord/servers/${activeServerId}/invites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload || {}),
    });

    if (res.ok) {
      return await res.json();
    } else {
      const err = await res.json();
      throw new Error(err.detail || 'Falha ao gerar convite.');
    }
  }, [activeServerId, token]);

  const handleTogglePin = async (msg, isDM, targetId) => {
    try {
      const endpoint = isDM
        ? `/api/v1/discord/dms/conversations/${targetId}/messages/${msg.id}/pin`
        : `/api/v1/discord/channels/${targetId}/messages/${msg.id}/pin`;
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const pinMsg = data.message || data;
        addToast(pinMsg.is_pinned ? 'Mensagem fixada com sucesso!' : 'Mensagem desafixada.', 'success');
        return pinMsg;
      }
      const err = await res.json().catch(() => ({}));
      addToast(err.detail || 'Erro ao alterar fixação.', 'error');
      return null;
    } catch (err) {
      console.error('Erro ao alterar fixação da mensagem:', err);
      addToast('Erro ao alterar fixação da mensagem.', 'error');
      return null;
    }
  };

  const handleDeleteServer = async (serverId) => {
    const sId = serverId || activeServerId;
    if (!sId) return false;

    try {
      const res = await fetch(`/api/v1/discord/servers/${sId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        setServers((prev) => prev.filter((s) => s.id !== sId));
        if (activeServerId === sId) {
          setActiveServerId(null);
          localStorage.setItem('discord_active_server_id', 'dms');
        }
        addToast('Servidor excluído com sucesso!', 'success');
        return true;
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = err.detail || 'Falha ao excluir servidor.';
        addToast(msg, 'error');
        throw new Error(msg);
      }
    } catch (err) {
      addToast(err.message || 'Falha ao excluir servidor.', 'error');
      throw err;
    }
  };

  return {
    handleSendMessage,
    handleEditMessage,
    handleToggleReaction,
    handleForwardMessage,
    handleUploadAttachment,
    handleConfirmDeleteMessage,
    handleCreateServer,
    handleCreateChannel,
    handleCreateInvite,
    handleTogglePin,
    handleDeleteServer,
  };
}
