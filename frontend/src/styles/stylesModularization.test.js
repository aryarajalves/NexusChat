import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('CSS Modularization and Line Limits', () => {
  const stylesDir = path.resolve(__dirname);
  const appCssPath = path.resolve(__dirname, '../App.css');

  const expectedFiles = [
    'global.css',
    'sidebar.css',
    'auth.css',
    'user-management.css',
    'modals.css',
    'welcome.css',
    'backup.css',
    'discord.css',
    'discord-chat.css',
    'discord-voice.css',
    'discord-messages.css',
    'discord-modals.css',
    'discord-search.css',
    'discord-audio.css',
    'discord-pins.css',
    'discord-unreads.css',
    'discord-emojis.css',
    'discord-mentions.css',
    'discord-user-settings.css',
    'discord-voice-recording.css',
  ];

  it('App.css aggregator imports all modular style files', () => {
    expect(fs.existsSync(appCssPath)).toBe(true);
    const content = fs.readFileSync(appCssPath, 'utf-8');
    const lines = content.split('\n');

    expect(lines.length).toBeLessThan(500);

    expectedFiles.forEach((file) => {
      expect(content).toContain(`@import './styles/${file}';`);
    });
  });

  it('all modular stylesheets exist and comply strictly with the < 500 line limit', () => {
    expectedFiles.forEach((file) => {
      const filePath = path.join(stylesDir, file);
      expect(fs.existsSync(filePath)).toBe(true);

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      expect(lines.length).toBeGreaterThan(10);
      expect(lines.length).toBeLessThan(500);
    });
  });
});
