import { describe, it, expect } from 'vitest';
import {
  formatBrasiliaDateTime,
  formatFileSize,
  renderTextWithLinks,
  renderContentWithMentions,
} from './chatUtils';

describe('chatUtils - Formatação de Data, Horário de Brasília e Arquivos', () => {
  it('converts UTC ISO string with Z to Brasília Time (UTC-3)', () => {
    // 17:50 UTC deve ser 14:50 em Brasília
    const formatted = formatBrasiliaDateTime('2026-10-28T17:50:00Z');
    expect(formatted).toBe('28/10/2026, 14:50');
  });

  it('converts naive UTC ISO string without Z to Brasília Time (UTC-3)', () => {
    // Mesmo sem a letra Z vinda do banco, deve tratar como UTC e converter para Brasília
    const formatted = formatBrasiliaDateTime('2026-10-28T17:50:00');
    expect(formatted).toBe('28/10/2026, 14:50');
  });

  it('converts space-separated datetime string to Brasília Time', () => {
    const formatted = formatBrasiliaDateTime('2026-10-28 17:50:00');
    expect(formatted).toBe('28/10/2026, 14:50');
  });

  it('handles timestamps with microseconds or milliseconds', () => {
    const formatted = formatBrasiliaDateTime('2026-10-28T17:50:00.654321');
    expect(formatted).toBe('28/10/2026, 14:50');
  });

  it('respects explicit timezone offset in input', () => {
    const formatted = formatBrasiliaDateTime('2026-10-28T14:50:00-03:00');
    expect(formatted).toBe('28/10/2026, 14:50');
  });

  it('returns empty string for null, undefined or invalid dates', () => {
    expect(formatBrasiliaDateTime(null)).toBe('');
    expect(formatBrasiliaDateTime(undefined)).toBe('');
    expect(formatBrasiliaDateTime('')).toBe('');
    expect(formatBrasiliaDateTime('data_invalida')).toBe('');
  });

  it('formats file sizes accurately', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(null)).toBe('0 B');
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1048576)).toBe('1 MB');
    expect(formatFileSize(52428800)).toBe('50 MB');
    expect(formatFileSize(1073741824)).toBe('1 GB');
  });
});

describe('chatUtils - renderTextWithLinks e renderContentWithMentions (Links Clicáveis)', () => {
  it('returns raw text unchanged if no URL exists', () => {
    const text = 'Olá pessoal, tudo bem por aqui?';
    expect(renderTextWithLinks(text)).toBe(text);
  });

  it('converts https URL into clickable link with security attributes', () => {
    const text = 'Acesse https://google.com para pesquisar';
    const result = renderTextWithLinks(text);

    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toBe('Acesse ');
    expect(result[1].type).toBe('a');
    expect(result[1].props.href).toBe('https://google.com');
    expect(result[1].props.target).toBe('_blank');
    expect(result[1].props.rel).toBe('noopener noreferrer');
    expect(result[1].props.className).toBe('chat-message-link');
    expect(result[1].props.children).toBe('https://google.com');
    expect(result[2]).toBe(' para pesquisar');
  });

  it('prepends https:// when URL begins with www.', () => {
    const text = 'Visite www.github.com agora';
    const result = renderTextWithLinks(text);

    expect(Array.isArray(result)).toBe(true);
    expect(result[1].props.href).toBe('https://www.github.com');
    expect(result[1].props.children).toBe('www.github.com');
  });

  it('strips trailing punctuation like periods or exclamation marks from URL', () => {
    const text = 'Confira https://discord.com! E também https://react.dev.';
    const result = renderTextWithLinks(text);

    expect(result[1].props.href).toBe('https://discord.com');
    expect(result[2]).toBe('!');
    expect(result[4].props.href).toBe('https://react.dev');
    expect(result[5]).toBe('.');
  });

  it('handles URLs wrapped in parentheses correctly', () => {
    const text = 'Veja a documentação (https://vitejs.dev)';
    const result = renderTextWithLinks(text);

    expect(result[0]).toBe('Veja a documentação (');
    expect(result[1].props.href).toBe('https://vitejs.dev');
    expect(result[2]).toBe(')');
  });

  it('keeps balanced parentheses in Wikipedia URLs', () => {
    const text = 'Leia https://pt.wikipedia.org/wiki/React_(software) para aprender';
    const result = renderTextWithLinks(text);

    expect(result[1].props.href).toBe('https://pt.wikipedia.org/wiki/React_(software)');
  });

  it('renders content with both mentions and clickable links', () => {
    const content = 'Fala @Carlos, veja o site https://youtube.com';
    const result = renderContentWithMentions(content, 'Aryaraj');

    expect(Array.isArray(result)).toBe(true);
    // Deve conter pílula de menção e link âncora
    const hasMention = result.some(
      (node) => node && node.props && node.props['data-testid'] === 'mention-pill'
    );
    const hasLink = result.some(
      (node) => node && node.props && node.props['data-testid'] === 'chat-message-link'
    );

    expect(hasMention).toBe(true);
    expect(hasLink).toBe(true);
  });
});
