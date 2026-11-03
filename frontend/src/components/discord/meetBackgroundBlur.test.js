import { describe, it, expect, vi } from 'vitest';
import { renderMeetBlurFrame, getSelfieSegmentation } from './meetBackgroundBlur';

describe('meetBackgroundBlur Module', () => {
  it('retorna com segurança se canvas ou imageSource forem nulos', () => {
    expect(() => renderMeetBlurFrame(null, null)).not.toThrow();
    expect(() => renderMeetBlurFrame({}, null)).not.toThrow();
  });

  it('renderiza o frame no modo Meet com recorte nítido da pessoa e fundo desfocado', () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      filter: 'none',
      globalCompositeOperation: 'source-over',
    };

    const mockCanvas = {
      width: 640,
      height: 360,
      getContext: vi.fn(() => mockCtx),
    };

    const mockImage = { width: 640, height: 360 };
    const mockMask = { width: 640, height: 360 };

    renderMeetBlurFrame(mockCanvas, mockImage, mockMask, 'intense');

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 640, 360);
    // 1. Desenha a máscara
    expect(mockCtx.drawImage).toHaveBeenCalledWith(mockMask, 0, 0, 640, 360);
    // 2. Recorta a pessoa mantendo nitidez máxima
    expect(mockCtx.globalCompositeOperation).toBe('destination-over');
    expect(mockCtx.filter).toBe('blur(16px)');
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('aplica desfoque leve de 8px quando blurMode for light', () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      filter: 'none',
      globalCompositeOperation: 'source-over',
    };

    const mockCanvas = {
      width: 640,
      height: 360,
      getContext: vi.fn(() => mockCtx),
    };

    const mockImage = { width: 640, height: 360 };
    const mockMask = { width: 640, height: 360 };

    renderMeetBlurFrame(mockCanvas, mockImage, mockMask, 'light');

    expect(mockCtx.filter).toBe('blur(8px)');
  });

  it('aplica fallback limpo sem desfoque quando segmentationMask for nulo', () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      filter: 'blur(10px)',
      globalCompositeOperation: 'source-over',
    };

    const mockCanvas = {
      width: 640,
      height: 360,
      getContext: vi.fn(() => mockCtx),
    };

    const mockImage = { width: 640, height: 360 };

    renderMeetBlurFrame(mockCanvas, mockImage, null, 'intense');

    expect(mockCtx.filter).toBe('none');
    expect(mockCtx.drawImage).toHaveBeenCalledWith(mockImage, 0, 0, 640, 360);
  });

  it('chama getSelfieSegmentation com tratamento de exceção seguro', async () => {
    const segmenter = await getSelfieSegmentation();
    // Em ambiente de teste Node/jsdom, carrega a classe ou trata o fallback
    expect(segmenter === null || typeof segmenter === 'object').toBe(true);
  });
});
