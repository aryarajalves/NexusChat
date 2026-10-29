import { describe, it, expect } from 'vitest';
import { formatBrasiliaDateTime, formatFileSize } from './chatUtils';

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
