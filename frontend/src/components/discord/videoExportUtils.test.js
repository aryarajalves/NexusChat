import { describe, it, expect, vi } from 'vitest';
import { isMp4Supported, getOptimalMimeType, processVideoExport } from './videoExportUtils';

describe('videoExportUtils Module', () => {
  it('identifica se MP4 é suportado sem lançar erros', () => {
    const supported = isMp4Supported();
    expect(typeof supported).toBe('boolean');
  });

  it('retorna o MIME type apropriado para MP4 e WebM', () => {
    const mp4Mime = getOptimalMimeType('mp4');
    expect(typeof mp4Mime).toBe('string');
    expect(mp4Mime.includes('video/')).toBe(true);

    const webmMime = getOptimalMimeType('webm');
    expect(typeof webmMime).toBe('string');
    expect(webmMime.includes('video/')).toBe(true);
  });

  it('lança erro ao tentar exportar sem blob', async () => {
    await expect(processVideoExport({ blob: null })).rejects.toThrow();
  });

  it('exporta o blob sem compressão mantendo integridade', async () => {
    const mockBlob = new Blob(['sample-video-content'], { type: 'video/webm' });
    const result = await processVideoExport({
      blob: mockBlob,
      targetFormat: 'mp4',
      compress: false,
    });

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('video/mp4');
  });

  it('executa pipeline de compressão com fallback gracioso em ambiente de teste', async () => {
    const mockBlob = new Blob(['sample-video-content'], { type: 'video/webm' });
    const progressFn = vi.fn();

    const result = await processVideoExport({
      blob: mockBlob,
      targetFormat: 'mp4',
      compress: true,
      onProgress: progressFn,
    });

    expect(result).toBeInstanceOf(Blob);
    expect(progressFn).toHaveBeenCalled();
  });
});
