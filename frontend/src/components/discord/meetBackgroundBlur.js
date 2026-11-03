/**
 * Utilitário de Desfoque de Fundo Inteligente (Estilo Google Meet)
 * Utiliza o MediaPipe Selfie Segmentation para recortar a silhueta da pessoa
 * e aplicar o desfoque gaussiano exclusivamente no fundo, preservando a
 * nitidez, iluminação e cores naturais da pessoa e do ambiente (sem vinheta escura).
 */

let selfieSegmentationInstance = null;
let isInitializing = false;

export async function getSelfieSegmentation() {
  if (selfieSegmentationInstance) return selfieSegmentationInstance;
  if (typeof window === 'undefined') return null;

  try {
    const mp = await import('@mediapipe/selfie_segmentation');
    const SelfieSegmentationClass = mp.SelfieSegmentation || mp.default?.SelfieSegmentation || window.SelfieSegmentation;

    if (!SelfieSegmentationClass) return null;

    const segmenter = new SelfieSegmentationClass({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });

    segmenter.setOptions({
      modelSelection: 1, // 1 = modo paisagem / alta precisão estilo Google Meet
      selfieMode: false,
    });

    selfieSegmentationInstance = segmenter;
    return segmenter;
  } catch (err) {
    console.warn('[MeetBlur] Não foi possível carregar MediaPipe SelfieSegmentation:', err);
    return null;
  }
}

/**
 * Renderiza o quadro da câmera no Canvas com desfoque de fundo idêntico ao Google Meet.
 */
export function renderMeetBlurFrame(canvas, imageSource, segmentationMask, blurMode = 'intense') {
  if (!canvas || !imageSource) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width || 640;
  const height = canvas.height || 360;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  if (segmentationMask) {
    // 1. Desenha a máscara da pessoa
    ctx.drawImage(segmentationMask, 0, 0, width, height);

    // 2. Mantém apenas a pessoa com nitidez máxima e cores 100% naturais
    ctx.globalCompositeOperation = 'source-in';
    ctx.drawImage(imageSource, 0, 0, width, height);

    // 3. Desenha o fundo desfocado atrás da pessoa (sem alterar brilho ou cor)
    ctx.globalCompositeOperation = 'destination-over';
    const blurPx = blurMode === 'intense' ? 16 : 8;
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(imageSource, 0, 0, width, height);
  } else {
    // Fallback: desenha o vídeo com nitidez normal
    ctx.filter = 'none';
    ctx.drawImage(imageSource, 0, 0, width, height);
  }

  ctx.restore();
}
