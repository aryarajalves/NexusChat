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
 * Expressão regular para detecção de URLs seguras (http, https ou www.)
 */
const URL_REGEX = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;

/**
 * Converte URLs dentro de um texto em links âncora <a> clicáveis, seguros e estilizados.
 * Abre em nova aba (target="_blank" rel="noopener noreferrer") e isola pontuações no final da frase.
 */
export const renderTextWithLinks = (text, keyPrefix = 'link') => {
  if (!text || typeof text !== 'string') return text;

  // Se não contiver padrão de URL, retorna o texto original imediatamente
  if (!/(https?:\/\/|www\.)/i.test(text)) {
    return text;
  }

  const result = [];
  let lastIndex = 0;
  let match;
  let counter = 0;

  // Nova instância regex para garantir lastIndex zerado
  const regex = new RegExp(URL_REGEX.source, 'gi');

  while ((match = regex.exec(text)) !== null) {
    const matchStart = match.index;
    let rawUrl = match[0];

    // Texto antes do link
    if (matchStart > lastIndex) {
      result.push(text.slice(lastIndex, matchStart));
    }

    // Isola pontuações finais comuns (.,;:!?) para não quebrar a URL
    let trailingPunctuation = '';
    const punctMatch = rawUrl.match(/[.,;:!?]+$/);
    if (punctMatch) {
      trailingPunctuation = punctMatch[0];
      rawUrl = rawUrl.slice(0, -trailingPunctuation.length);
    }

    // Trata parênteses de fechamento não balanceados no final da URL (ex: "(https://example.com)")
    const openParens = (rawUrl.match(/\(/g) || []).length;
    const closeParens = (rawUrl.match(/\)/g) || []).length;
    if (closeParens > openParens) {
      const diff = closeParens - openParens;
      let removed = 0;
      while (rawUrl.endsWith(')') && removed < diff) {
        rawUrl = rawUrl.slice(0, -1);
        trailingPunctuation = ')' + trailingPunctuation;
        removed++;
      }
    }

    // Define o protocolo se a URL começar com 'www.'
    const href = rawUrl.startsWith('http://') || rawUrl.startsWith('https://')
      ? rawUrl
      : `https://${rawUrl}`;

    result.push(
      React.createElement(
        'a',
        {
          key: `${keyPrefix}-${counter++}`,
          href,
          target: '_blank',
          rel: 'noopener noreferrer',
          className: 'chat-message-link',
          'data-testid': 'chat-message-link',
          onClick: (e) => e.stopPropagation(),
        },
        rawUrl
      )
    );

    if (trailingPunctuation) {
      result.push(trailingPunctuation);
    }

    lastIndex = matchStart + match[0].length;
  }

  // Texto restante após a última URL encontrada
  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result.length === 1 && typeof result[0] === 'string' ? result[0] : result;
};

/**
 * Renderiza o texto de mensagens formatando menções com @ (@nome, @everyone, @here),
 * emojis de servidor (:emoji:) e links web navegáveis em pílulas ou links clicáveis.
 * Quando onMentionClick é fornecido, torna a pílula de menção interativa para abrir diretamente
 * a conversa privada (DM) com o contato mencionado.
 */
export const renderContentWithMentions = (
  content,
  currentUserName = '',
  onMentionClick = null,
  members = [],
  customEmojis = null
) => {
  if (!content) return content;

  // Mapa de emojis customizados para consulta rápida
  let emojiMap = null;
  if (customEmojis) {
    if (Array.isArray(customEmojis)) {
      emojiMap = {};
      customEmojis.forEach((e) => {
        if (e && e.name) emojiMap[e.name.toLowerCase()] = e;
      });
    } else if (typeof customEmojis === 'object') {
      emojiMap = customEmojis;
    }
  }

  const parts = content.split(/(@[a-zA-Z0-9_\-\u00C0-\u017F]+|:[a-zA-Z0-9_]{2,32}:)/g);
  return parts.flatMap((part, i) => {
    if (!part) return [];

    if (part.startsWith(':') && part.endsWith(':')) {
      const emojiName = part.slice(1, -1).toLowerCase();
      const matchedEmoji = emojiMap ? emojiMap[emojiName] : null;
      if (matchedEmoji && matchedEmoji.image_url) {
        return [
          React.createElement('img', {
            key: `emoji-${i}`,
            src: matchedEmoji.image_url,
            alt: part,
            title: part,
            className: 'discord-custom-emoji-inline',
            'data-testid': 'custom-emoji-inline',
          }),
        ];
      }
      return [part];
    }

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

      return [
        React.createElement(
          'span',
          {
            key: `mention-${i}`,
            className: pillClasses,
            'data-testid': 'mention-pill',
            onClick: canClick ? handleClick : undefined,
            title: canClick ? `Conversar com @${rawTarget} na DM` : undefined,
            role: canClick ? 'button' : undefined,
            tabIndex: canClick ? 0 : undefined,
          },
          part
        ),
      ];
    }

    const linkified = renderTextWithLinks(part, `txt-${i}`);
    const linkNodes = Array.isArray(linkified) ? linkified : [linkified];
    return linkNodes.flatMap((node, nodeIdx) => {
      if (typeof node === 'string') {
        const formatted = renderFormattedText(node, `fmt-${i}-${nodeIdx}`);
        return Array.isArray(formatted) ? formatted : [formatted];
      }
      return [node];
    });
  });
};

/**
 * Renderiza textos aplicando estilos de formatação (Markdown & WhatsApp style):
 * - Negrito: *texto* (estilo WhatsApp) ou **texto** (estilo Discord)
 * - Itálico: _texto_
 * - Tachado: ~texto~ ou ~~texto~~
 * - Código inline: `código`
 * - Bloco de código: ```bloco```
 * - Variáveis / Parâmetros: {{1}}, {{nome}}, etc.
 */
export const renderFormattedText = (text, keyPrefix = 'fmt') => {
  if (!text || typeof text !== 'string') return text;

  const TOKEN_REGEX = /(```[\s\S]*?```|`[^`\n]+`|\*\*(?!\s)[^*\n]+?(?<!\s)\*\*|\*(?!\s)[^*\n]+?(?<!\s)\*|_(?!\s)[^_\n]+?(?<!\s)_|~{1,2}(?!\s)[^~\n]+?(?<!\s)~{1,2}|\{\{[^{}\n]+?\}\})/g;

  if (!TOKEN_REGEX.test(text)) {
    return text;
  }

  const parts = text.split(TOKEN_REGEX);
  let counter = 0;

  const nodes = parts.flatMap((part) => {
    if (!part) return [];

    // Bloco de código ```...```
    if (part.startsWith('```') && part.endsWith('```') && part.length >= 6) {
      const codeContent = part.slice(3, -3).replace(/^\n/, '');
      return [
        React.createElement(
          'pre',
          {
            key: `${keyPrefix}-codeblock-${counter++}`,
            className: 'chat-format-codeblock',
            'data-testid': 'chat-format-codeblock',
          },
          React.createElement('code', null, codeContent)
        ),
      ];
    }

    // Código inline `...`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return [
        React.createElement(
          'code',
          {
            key: `${keyPrefix}-code-${counter++}`,
            className: 'chat-format-code',
            'data-testid': 'chat-format-code',
          },
          part.slice(1, -1)
        ),
      ];
    }

    // Negrito duplo **...**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return [
        React.createElement(
          'strong',
          {
            key: `${keyPrefix}-bold-${counter++}`,
            className: 'chat-format-bold',
            'data-testid': 'chat-format-bold',
          },
          part.slice(2, -2)
        ),
      ];
    }

    // Negrito simples estilo WhatsApp *...*
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return [
        React.createElement(
          'strong',
          {
            key: `${keyPrefix}-bold-${counter++}`,
            className: 'chat-format-bold',
            'data-testid': 'chat-format-bold',
          },
          part.slice(1, -1)
        ),
      ];
    }

    // Itálico _..._
    if (part.startsWith('_') && part.endsWith('_') && part.length >= 2) {
      return [
        React.createElement(
          'em',
          {
            key: `${keyPrefix}-italic-${counter++}`,
            className: 'chat-format-italic',
            'data-testid': 'chat-format-italic',
          },
          part.slice(1, -1)
        ),
      ];
    }

    // Tachado ~...~ ou ~~...~~
    if (part.startsWith('~') && part.endsWith('~') && part.length >= 2) {
      const stripped = part.startsWith('~~') && part.endsWith('~~') ? part.slice(2, -2) : part.slice(1, -1);
      return [
        React.createElement(
          's',
          {
            key: `${keyPrefix}-strike-${counter++}`,
            className: 'chat-format-strikethrough',
            'data-testid': 'chat-format-strike',
          },
          stripped
        ),
      ];
    }

    // Parâmetro / Variável {{...}}
    if (part.startsWith('{{') && part.endsWith('}}') && part.length >= 4) {
      return [
        React.createElement(
          'span',
          {
            key: `${keyPrefix}-var-${counter++}`,
            className: 'chat-variable-badge',
            'data-testid': 'chat-variable-badge',
          },
          part
        ),
      ];
    }

    return [part];
  });

  return nodes.length === 1 && typeof nodes[0] === 'string' ? nodes[0] : nodes;
};
