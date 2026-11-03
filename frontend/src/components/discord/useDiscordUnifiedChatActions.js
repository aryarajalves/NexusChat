/**
 * Unifica as ações de chat (envio, upload, edição, reação, exclusão e fixação)
 * roteando automaticamente entre Canais de Servidor e Mensagens Diretas (DMs).
 */
export default function useDiscordUnifiedChatActions({
  token,
  activeServerId,
  activeChannelId,
  activeDMId,
  setMessages,
  loadConversations,
  addToast,
  handleUploadAttachment,
  handleSendMessage,
  handleEditMessage,
  handleToggleReaction,
  handleConfirmDeleteMessage,
  handleTogglePin,
  handlePinUpdate,
}) {
  const handleGeneralUploadAttachment = async (file) => {
    if (activeServerId !== null) return await handleUploadAttachment(file);
    if (!activeDMId) throw new Error('Nenhuma DM ativa');
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/v1/discord/dms/conversations/${activeDMId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Falha ao fazer upload na conversa privada.');
    }
    return await res.json();
  };

  const handleGeneralSendMessage = async (msgPayload) => {
    if (activeServerId !== null) return handleSendMessage(msgPayload);
    if (!activeDMId) return;
    const attachmentData = msgPayload.attachment_file
      ? await handleGeneralUploadAttachment(msgPayload.attachment_file)
      : null;
    const res = await fetch(`/api/v1/discord/dms/conversations/${activeDMId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        content: msgPayload.content,
        attachment_url: attachmentData?.attachment_url || msgPayload.attachment_url,
        attachment_type: attachmentData?.attachment_type || msgPayload.attachment_type,
        attachment_size: attachmentData?.attachment_size || msgPayload.attachment_size,
        reply_to_id: msgPayload.reply_to_id,
      }),
    });
    if (res.ok) {
      const newMsg = await res.json();
      setMessages((prev) => (prev.some((m) => m.id === newMsg.id) ? prev : [...prev, newMsg]));
      loadConversations && loadConversations();
    } else {
      const err = await res.json();
      throw new Error(err.detail || 'Falha ao enviar mensagem direta.');
    }
  };

  const handleGeneralEditMessage = async (arg1, arg2, arg3) => {
    const isThreeArgs = arg3 !== undefined;
    const chId = isThreeArgs ? arg1 : activeChannelId;
    const msgId = isThreeArgs ? arg2 : arg1;
    const newContent = isThreeArgs ? arg3 : arg2;
    if (activeServerId !== null) return handleEditMessage(chId, msgId, newContent);
    const res = await fetch(`/api/v1/discord/dms/messages/${msgId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: newContent }),
    });
    if (res.ok) {
      const updated = await res.json();
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } else {
      const err = await res.json();
      throw new Error(err.detail || 'Falha ao editar mensagem.');
    }
  };

  const handleGeneralToggleReaction = async (arg1, arg2, arg3) => {
    const isThreeArgs = arg3 !== undefined;
    const chId = isThreeArgs ? arg1 : activeChannelId;
    const msgId = isThreeArgs ? arg2 : arg1;
    const emoji = isThreeArgs ? arg3 : arg2;
    if (activeServerId !== null) return handleToggleReaction(chId, msgId, emoji);
    const res = await fetch(`/api/v1/discord/dms/messages/${msgId}/reactions`, {
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
        prev.map((m) => (m.id === msgId ? { ...m, reactions: data.reactions } : m))
      );
    }
  };

  const handleGeneralConfirmDelete = async (msgId) => {
    if (activeServerId !== null) return handleConfirmDeleteMessage(msgId);
    const res = await fetch(`/api/v1/discord/dms/messages/${msgId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      addToast && addToast('Mensagem excluída com sucesso.', 'info');
    } else {
      const err = await res.json();
      throw new Error(err.detail || 'Falha ao excluir mensagem.');
    }
  };

  const handleGeneralTogglePin = async (msg) => {
    const isDM = activeServerId === null;
    const targetId = isDM ? activeDMId : activeChannelId;
    if (!targetId) return;
    const updated = await handleTogglePin(msg, isDM, targetId);
    if (updated && handlePinUpdate) handlePinUpdate(updated);
  };

  return {
    handleGeneralUploadAttachment,
    handleGeneralSendMessage,
    handleGeneralEditMessage,
    handleGeneralToggleReaction,
    handleGeneralConfirmDelete,
    handleGeneralTogglePin,
  };
}
