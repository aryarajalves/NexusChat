import React from 'react';

/**
 * Utilitários para formatação e manipulação no Chat do Discord Clone
 */

/**
 * Formata data e horário no fuso Horário de Brasília (America/Sao_Paulo)
 * Exemplo de retorno: "28/10/2026, 13:42"
 */
export const formatBrasiliaDateTime = (dateStr) => {
  if (!dateStr) return '';
  try {
    let raw = String(dateStr).trim();
    // Se a data for ISO sem indicação de fuso (sem 'Z' ou offset +/-HH:MM), adiciona 'Z' para interpretação UTC
    if (raw.includes('T') && !raw.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(raw)) {
      raw += 'Z';
    } else if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(raw)) {
      raw = raw.replace(' ', 'T') + 'Z';
    }

    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';

    const parts = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);

    const get = (type) => parts.find((p) => p.type === type)?.value || '';
    return `${get('day')}/${get('month')}/${get('year')}, ${get('hour')}:${get('minute')}`;
  } catch {
    return '';
  }
};

/**
 * Formata tamanho de arquivo em bytes para formato legível (B, KB, MB, GB)
 */
export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Renderiza o texto de mensagens formatando menções com @ (@nome, @everyone, @here)
 * em pílulas visuais elegantes, marcando com .is-me caso mencione o usuário atual.
 * Quando onMentionClick é fornecido, torna a pílula interativa para abrir diretamente
 * a conversa privada (DM) com o contato mencionado.
 */
export const renderContentWithMentions = (
  content,
  currentUserName = '',
  onMentionClick = null,
  members = []
) => {
  if (!content) return content;
  const parts = content.split(/(@[a-zA-Z0-9_\-\u00C0-\u017F]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const rawTarget = part.slice(1);
      const target = rawTarget.toLowerCase();
      const isEveryoneOrHere = target === 'everyone' || target === 'here';
      const isMe =
        isEveryoneOrHere ||
        (currentUserName && target === String(currentUserName).toLowerCase());

      // Busca membro correspondente pelo nome, username ou e-mail
      let matchedMember = null;
      if (!isEveryoneOrHere && Array.isArray(members) && members.length > 0) {
        matchedMember = members.find((m) => {
          const mName = String(m?.user_name || m?.name || '').toLowerCase();
          const mEmail = String(m?.email || '').toLowerCase();
          return (
            mName === target ||
            mName.startsWith(target) ||
            mEmail.startsWith(target)
          );
        });
      }

      const canClick = Boolean(onMentionClick && !isEveryoneOrHere);

      const handleClick = (e) => {
        if (!canClick) return;
        e.stopPropagation();
        e.preventDefault();
        const targetUserId = matchedMember ? (matchedMember.user_id || matchedMember.id) : null;
        if (targetUserId) {
          onMentionClick(targetUserId);
        } else {
          onMentionClick(rawTarget);
        }
      };

      const pillClasses = [
        'chat-mention-pill',
        isMe ? 'is-me' : '',
        canClick ? 'is-clickable' : '',
      ]
        .filter(Boolean)
        .join(' ');

      return React.createElement(
        'span',
        {
          key: i,
          className: pillClasses,
          'data-testid': 'mention-pill',
          onClick: canClick ? handleClick : undefined,
          title: canClick ? `Conversar com @${rawTarget} na DM` : undefined,
          role: canClick ? 'button' : undefined,
          tabIndex: canClick ? 0 : undefined,
        },
        part
      );
    }
    return part;
  });
};
