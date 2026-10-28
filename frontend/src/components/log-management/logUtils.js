/**
 * Utilitários para parsing, classificação por tipo, cores e horário de Brasília para logs.
 */

const MONTH_MAP = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
};

/**
 * Converte timestamps nos formatos comuns (Docker RFC3339 / Nginx / ISO 8601 UTC) para o Horário de Brasília (UTC-3).
 */
export function formatToBrasiliaTime(line) {
  if (!line || typeof line !== 'string') return line;

  let result = line;

  // 1. Padrão Docker RFC3339 no início da linha: 2026-09-29T18:04:29.123456789Z
  const dockerTsRegex = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s*/;
  const dockerMatch = result.match(dockerTsRegex);
  if (dockerMatch) {
    try {
      const dt = new Date(dockerMatch[1]);
      if (!isNaN(dt.getTime())) {
        const brTimeStr = dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false });
        result = `[${brTimeStr}] ` + result.slice(dockerMatch[0].length);
      }
    } catch {
      // Ignora e continua
    }
  }

  // 2. Padrão Nginx: [29/Sep/2026:17:59:35 +0000]
  const nginxRegex = /\[(\d{2})\/([A-Za-z]{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s*([+-]\d{4})?\]/g;
  result = result.replace(nginxRegex, (match, day, monStr, year, hour, min, sec) => {
    const mon = MONTH_MAP[monStr];
    if (mon === undefined) return match;
    const utcDate = new Date(Date.UTC(parseInt(year, 10), mon, parseInt(day, 10), parseInt(hour, 10), parseInt(min, 10), parseInt(sec, 10)));
    return `[${utcDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false })}]`;
  });

  // 3. Padrão ISO 8601 UTC avulso: 2026-09-29T17:59:35.123Z
  const isoRegex = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?)(?:Z|([+-]\d{2}:?\d{2}))?/g;
  result = result.replace(isoRegex, (match, baseIso) => {
    try {
      const dt = new Date(baseIso.endsWith('Z') ? baseIso : baseIso + 'Z');
      if (isNaN(dt.getTime())) return match;
      return `[${dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour12: false })}]`;
    } catch {
      return match;
    }
  });

  return result;
}

/**
 * Classifica a linha de log por tipo e retorna metadados visuais de cores e badges.
 * Suporta tema claro nativo do sistema e tema escuro opcional.
 */
export function classifyLogLine(rawLine, isDarkMode = false) {
  const line = formatToBrasiliaTime(rawLine || '');
  const lower = line.toLowerCase();

  // 1. Erros e Falhas Críticas
  if (
    lower.includes('[error]') ||
    lower.includes('error:') ||
    lower.includes('erro:') ||
    lower.includes('failed') ||
    lower.includes('falha') ||
    lower.includes('exception') ||
    lower.includes('traceback') ||
    /\s5\d{2}\s/.test(line)
  ) {
    return {
      type: 'error',
      badge: 'ERRO',
      badgeColor: '#ef4444',
      badgeBg: isDarkMode ? 'rgba(239, 68, 68, 0.16)' : '#fee2e2',
      badgeBorder: isDarkMode ? 'rgba(239, 68, 68, 0.35)' : '#fecaca',
      textColor: isDarkMode ? '#fca5a5' : '#b91c1c',
      lineBg: isDarkMode ? 'rgba(239, 68, 68, 0.08)' : '#fef2f2',
      formattedLine: line,
    };
  }

  // 2. Avisos e Atenção
  if (
    lower.includes('[warn]') ||
    lower.includes('[warning]') ||
    lower.includes('warning:') ||
    lower.includes('aviso:') ||
    /\s4\d{2}\s/.test(line)
  ) {
    return {
      type: 'warning',
      badge: 'AVISO',
      badgeColor: '#f59e0b',
      badgeBg: isDarkMode ? 'rgba(245, 158, 11, 0.16)' : '#fef3c7',
      badgeBorder: isDarkMode ? 'rgba(245, 158, 11, 0.35)' : '#fde68a',
      textColor: isDarkMode ? '#fde047' : '#92400e',
      lineBg: isDarkMode ? 'rgba(245, 158, 11, 0.05)' : '#fffbeb',
      formattedLine: line,
    };
  }

  // 3. Requisições HTTP
  const httpMatch = line.match(/"(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+([^\s]+)\s+HTTP\/[\d.]+"\s+(\d{3})/i);
  if (httpMatch) {
    const [, method, path, statusCode] = httpMatch;
    const codeNum = parseInt(statusCode, 10);
    const is2xx = codeNum >= 200 && codeNum < 300;
    const is3xx = codeNum >= 300 && codeNum < 400;

    const badgeColor = is2xx ? '#10b981' : is3xx ? '#06b6d4' : '#f97316';
    const badgeBg = isDarkMode
      ? (is2xx ? 'rgba(16, 185, 129, 0.16)' : 'rgba(6, 182, 212, 0.16)')
      : (is2xx ? '#dcfce7' : '#e0f2fe');
    const badgeBorder = isDarkMode
      ? (is2xx ? 'rgba(16, 185, 129, 0.35)' : 'rgba(6, 182, 212, 0.35)')
      : (is2xx ? '#bbf7d0' : '#bae6fd');

    const textColor = isDarkMode
      ? '#cbd5e1'
      : (is2xx ? '#15803d' : is3xx ? '#0284c7' : '#c2410c');

    return {
      type: 'http',
      badge: `HTTP ${statusCode}`,
      badgeColor,
      badgeBg,
      badgeBorder,
      textColor,
      lineBg: 'transparent',
      formattedLine: line,
      httpMeta: { method, path, statusCode },
    };
  }

  // 4. Informativo padrão (INFO)
  return {
    type: 'info',
    badge: 'INFO',
    badgeColor: '#38bdf8',
    badgeBg: isDarkMode ? 'rgba(56, 189, 248, 0.16)' : '#e0f2fe',
    badgeBorder: isDarkMode ? 'rgba(56, 189, 248, 0.35)' : '#bae6fd',
    textColor: isDarkMode ? '#cbd5e1' : '#334155',
    lineBg: 'transparent',
    formattedLine: line,
  };
}
