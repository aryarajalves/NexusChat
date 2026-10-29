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
 */
export const renderContentWithMentions = (content, currentUserName = '') => {
  if (!content) return content;
  const parts = content.split(/(@[a-zA-Z0-9_\-\u00C0-\u017F]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const target = part.slice(1).toLowerCase();
      const isMe =
        target === 'everyone' ||
        target === 'here' ||
        (currentUserName && target === String(currentUserName).toLowerCase());
      return React.createElement(
        'span',
        {
          key: i,
          className: `chat-mention-pill ${isMe ? 'is-me' : ''}`,
          'data-testid': 'mention-pill',
        },
        part
      );
    }
    return part;
  });
};
