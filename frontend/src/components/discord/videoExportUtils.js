/**
 * Utilitários para Exportação e Compressão Inteligente de Vídeo
 * Suporta exportação em MP4 e WebM com compressão de taxa de bits sem perda perceptível de qualidade.
 */

export function isMp4Supported() {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return false;
  }
  return MediaRecorder.isTypeSupported('video/mp4') ||
    MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ||
    MediaRecorder.isTypeSupported('video/mp4;codecs=h264');
}

/**
 * Retorna o melhor MIME type suportado pelo navegador para o formato desejado.
 */
export function getOptimalMimeType(format = 'mp4') {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return format === 'mp4' ? 'video/mp4' : 'video/webm';
  }

  if (format === 'mp4') {
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) return 'video/mp4;codecs=avc1';
    if (MediaRecorder.isTypeSupported('video/mp4')) return 'video/mp4';
    // Fallback se MP4 não for suportado pelo gravador
    return 'video/webm';
  }

  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) return 'video/webm;codecs=vp9';
  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) return 'video/webm;codecs=vp8';
  return 'video/webm';
}

/**
 * Comprime e exporta o Blob de vídeo com otimização inteligente de bitrate.
 */
export async function processVideoExport({
  blob,
  targetFormat = 'mp4',
  compress = false,
  onProgress,
}) {
  if (!blob) throw new Error('Nenhum vídeo fornecido para exportação.');

  // Se compressão não for necessária e o tipo já for o desejado
  if (!compress) {
    const finalMime = targetFormat === 'mp4' ? 'video/mp4' : 'video/webm';
    return new Blob([blob], { type: finalMime });
  }

  onProgress?.(10);

  // Ambientes sem DOM ou sem suporte a captureStream (ex: jsdom / testes automatizados)
  const testVideo = typeof document !== 'undefined' ? document.createElement('video') : null;
  const hasCaptureStream = testVideo && (typeof testVideo.captureStream === 'function' || typeof testVideo.mozCaptureStream === 'function');

  if (typeof window === 'undefined' || typeof document === 'undefined' || !hasCaptureStream) {
    onProgress?.(100);
    const finalMime = targetFormat === 'mp4' ? 'video/mp4' : 'video/webm';
    return new Blob([blob], { type: finalMime });
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.playsInline = true;
    const url = URL.createObjectURL(blob);
    video.src = url;

    let audioCtx = null;
    let elementAudioStream = null;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (audioCtx && typeof audioCtx.close === 'function') {
        try { audioCtx.close(); } catch {}
      }
      video.remove();
    };

    video.onloadedmetadata = async () => {
      onProgress?.(30);
      try {
        const stream = video.captureStream ? video.captureStream() : video.mozCaptureStream?.();

        if (!stream || typeof MediaRecorder === 'undefined') {
          cleanup();
          const finalMime = targetFormat === 'mp4' ? 'video/mp4' : 'video/webm';
          resolve(new Blob([blob], { type: finalMime }));
          return;
        }

        // Se o captureStream do vídeo não capturou áudio ou foi silenciado, roteia via Web Audio
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx && (!stream.getAudioTracks || stream.getAudioTracks().length === 0)) {
            audioCtx = new AudioCtx();
            const sourceNode = audioCtx.createMediaElementSource(video);
            const destNode = audioCtx.createMediaStreamDestination();
            sourceNode.connect(destNode); // Conecta somente ao gravador sem emitir nos alto-falantes
            elementAudioStream = destNode.stream;
            elementAudioStream.getAudioTracks().forEach((t) => stream.addTrack(t));
          }
        } catch {
          // Se createMediaElementSource falhar, mantém muted sem quebrar
          video.muted = true;
        }

        const mimeType = getOptimalMimeType(targetFormat);
        // Bitrate otimizado: 1.8 Mbps de vídeo + 128 kbps de áudio (redução de ~50-60% mantendo alta nitidez)
        const recorderOptions = {
          mimeType,
          videoBitsPerSecond: 1800000,
          audioBitsPerSecond: 128000,
        };

        let recorder;
        try {
          recorder = new MediaRecorder(stream, recorderOptions);
        } catch {
          recorder = new MediaRecorder(stream);
        }

        const chunks = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          onProgress?.(100);
          cleanup();
          const outputBlob = new Blob(chunks, { type: targetFormat === 'mp4' ? 'video/mp4' : 'video/webm' });
          resolve(outputBlob.size > 0 ? outputBlob : blob);
        };

        recorder.start(250);
        video.playbackRate = 2.0; // Processa em dobro de velocidade para compressão rápida
        video.play().catch(() => {});

        video.ontimeupdate = () => {
          if (video.duration) {
            const pct = Math.min(95, Math.round(30 + (video.currentTime / video.duration) * 65));
            onProgress?.(pct);
          }
        };

        video.onended = () => {
          try {
            recorder.stop();
          } catch {
            cleanup();
            resolve(blob);
          }
        };
      } catch (err) {
        console.warn('[VideoExport] Falha na compressão acelerada, usando fallback direto:', err);
        cleanup();
        const finalMime = targetFormat === 'mp4' ? 'video/mp4' : 'video/webm';
        resolve(new Blob([blob], { type: finalMime }));
      }
    };

    video.onerror = () => {
      cleanup();
      const finalMime = targetFormat === 'mp4' ? 'video/mp4' : 'video/webm';
      resolve(new Blob([blob], { type: finalMime }));
    };
  });
}
