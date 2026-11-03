import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageAttachmentPreview } from './ChatMessageExtras';
import fs from 'fs';
import path from 'path';

describe('Chat Media & Message Rendering Optimizations', () => {
  it('renders image attachment with responsive contain styling and loading lazy', () => {
    const mockMsg = {
      id: 101,
      attachment_url: '/api/v1/discord/attachments/screenshot_test.png',
      attachment_type: 'image/png',
      attachment_size: 1024 * 1024,
    };

    render(<MessageAttachmentPreview msg={mockMsg} formatFileSize={(s) => `${s} bytes`} />);

    const img = screen.getByRole('img');
    expect(img).toBeDefined();
    expect(img.getAttribute('src')).toBe('/api/v1/discord/attachments/screenshot_test.png');
    expect(img.getAttribute('loading')).toBe('lazy');

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/api/v1/discord/attachments/screenshot_test.png');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('css file discord-chat.css contains optimized object-fit contain and natural proportions', () => {
    const cssPath = path.resolve(__dirname, '../../styles/discord-chat.css');
    expect(fs.existsSync(cssPath)).toBe(true);
    const cssContent = fs.readFileSync(cssPath, 'utf-8');

    expect(cssContent).toContain('.chat-attachment-img-link');
    expect(cssContent).toContain('object-fit: contain');
    expect(cssContent).toContain('max-height: 380px');
  });
});
