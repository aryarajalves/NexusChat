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

describe('chatUtils - Formatação Rica de Texto (Markdown, WhatsApp style e Parágrafos)', () => {
  it('formata texto em negrito no estilo WhatsApp (*texto*)', () => {
    const text = 'Aqui é o *Crassus Gobbi* 🧭';
    const result = renderContentWithMentions(text);

    expect(Array.isArray(result)).toBe(true);
    const boldNode = result.find(
      (node) => node && node.props && node.props['data-testid'] === 'chat-format-bold'
    );
    expect(boldNode).toBeDefined();
    expect(boldNode.type).toBe('strong');
    expect(boldNode.props.className).toBe('chat-format-bold');
    expect(boldNode.props.children).toBe('Crassus Gobbi');
  });

  it('formata texto em negrito estilo markdown duplo (**texto**)', () => {
    const text = 'Mensagem com **destaque importante** aqui';
    const result = renderContentWithMentions(text);

    const boldNode = result.find(
      (node) => node && node.props && node.props['data-testid'] === 'chat-format-bold'
    );
    expect(boldNode).toBeDefined();
    expect(boldNode.props.children).toBe('destaque importante');
  });

  it('formata parâmetros e variáveis estilo {{1}} ou {{nome}}', () => {
    const text = 'Olá, {{1}}! Seja bem-vindo {{nome}}';
    const result = renderContentWithMentions(text);

    const varNodes = result.filter(
      (node) => node && node.props && node.props['data-testid'] === 'chat-variable-badge'
    );
    expect(varNodes.length).toBe(2);
    expect(varNodes[0].props.children).toBe('{{1}}');
    expect(varNodes[1].props.children).toBe('{{nome}}');
  });

  it('formata itálico (_texto_), tachado (~texto~) e código inline (`código`)', () => {
    const text = 'Teste _italico_ e ~tachado~ e `codigo` inline';
    const result = renderContentWithMentions(text);

    const italicNode = result.find(
      (node) => node && node.props && node.props['data-testid'] === 'chat-format-italic'
    );
    const strikeNode = result.find(
      (node) => node && node.props && node.props['data-testid'] === 'chat-format-strike'
    );
    const codeNode = result.find(
      (node) => node && node.props && node.props['data-testid'] === 'chat-format-code'
    );

    expect(italicNode?.props?.children).toBe('italico');
    expect(strikeNode?.props?.children).toBe('tachado');
    expect(codeNode?.props?.children).toBe('codigo');
  });

  it('formata bloco de código cercado por três crases (```)', () => {
    const text = 'Código:\n```const x = 10;```\nFim';
    const result = renderContentWithMentions(text);

    const codeBlock = result.find(
      (node) => node && node.props && node.props['data-testid'] === 'chat-format-codeblock'
    );
    expect(codeBlock).toBeDefined();
    expect(codeBlock.type).toBe('pre');
  });

  it('preserva parágrafos, quebras de linha e formatações completas do exemplo do usuário', () => {
    const fullText = `Olá, {{1}}! Aqui é o *Crassus Gobbi* 🧭

Durante todo esse ano, muita gente tentou mudar de vida no escuro, na tentativa e erro — jogando no verdadeiro *Modo Difícil*.

Neste *domingo, dia 15, às 18h*, faremos um encontro ao vivo para você virar essa chave antes de 2027 e revelar a *condição única de Black Friday (Embaixador)* da *Comunidade Astrowake*.

📄 *Anexei acima o dossiê oficial* para você ler com calma tudo o que preparamos para os próximos 12 meses:

✨ Método dos 8 Passos
📱 Software Bússola Astrológica
📖 Guia Visual
🤝 24 encontros ao vivo comigo durante 12 meses

Essa condição de fundação NÃO será aberta ao público geral. Toque no botão abaixo para entrar no *Grupo VIP* e receber o link da aula 👇`;

    const result = renderContentWithMentions(fullText);
    expect(Array.isArray(result)).toBe(true);

    // Deve encontrar a variável {{1}}
    const hasVar = result.some(
      (n) => n && n.props && n.props['data-testid'] === 'chat-variable-badge' && n.props.children === '{{1}}'
    );
    expect(hasVar).toBe(true);

    // Deve encontrar os 7 blocos em negrito
    const boldNodes = result.filter(
      (n) => n && n.props && n.props['data-testid'] === 'chat-format-bold'
    );
    expect(boldNodes.length).toBe(7);

    const boldTexts = boldNodes.map((n) => n.props.children);
    expect(boldTexts).toContain('Crassus Gobbi');
    expect(boldTexts).toContain('Modo Difícil');
    expect(boldTexts).toContain('domingo, dia 15, às 18h');
    expect(boldTexts).toContain('condição única de Black Friday (Embaixador)');
    expect(boldTexts).toContain('Comunidade Astrowake');
    expect(boldTexts).toContain('Anexei acima o dossiê oficial');
    expect(boldTexts).toContain('Grupo VIP');

    // As quebras de linha de parágrafo devem estar intactas nos fragmentos de texto
    const textPieces = result.filter((n) => typeof n === 'string').join('');
    expect(textPieces).toContain('\n\nDurante todo esse ano');
    expect(textPieces).toContain('\n\nNeste ');
    expect(textPieces).toContain('✨ Método dos 8 Passos\n📱 Software Bússola Astrológica\n');
  });
});
