/**
 * Utilitários para Composição de Vídeo (Picture-in-Picture / Webcam Overlay)
 * Permite mesclar o compartilhamento de tela + webcam em tempo real em um único MediaStream.
 */

export const PIP_CORNERS = {
  BOTTOM_RIGHT: 'bottom-right',
  BOTTOM_LEFT: 'bottom-left',
  TOP_RIGHT: 'top-right',
  TOP_LEFT: 'top-left',
  CUSTOM: 'custom',
};

/**
 * Retorna as coordenadas normalizadas (0 a 1) para o quadro da webcam PiP.
 */
export function getNormalizedPipCoords(pipPosition, stageWidth = 1920, stageHeight = 1080) {
  const pipWidthRatio = 0.23; // 23% da largura
  const pipHeightRatio = 0.27; // 27% da altura
  const paddingX = 0.03;
  const paddingY = 0.04;

  const corner = pipPosition?.corner || PIP_CORNERS.BOTTOM_RIGHT;

  if (corner === PIP_CORNERS.CUSTOM && pipPosition?.customCoords) {
    const rawX = pipPosition.customCoords.x;
    const rawY = pipPosition.customCoords.y;
    const normX = Math.max(0, Math.min(1 - pipWidthRatio, rawX / stageWidth));
    const normY = Math.max(0, Math.min(1 - pipHeightRatio, rawY / stageHeight));
    return { x: normX, y: normY, width: pipWidthRatio, height: pipHeightRatio };
  }

  switch (corner) {
    case PIP_CORNERS.BOTTOM_LEFT:
      return { x: paddingX, y: 1 - pipHeightRatio - paddingY, width: pipWidthRatio, height: pipHeightRatio };
    case PIP_CORNERS.TOP_RIGHT:
      return { x: 1 - pipWidthRatio - paddingX, y: paddingY, width: pipWidthRatio, height: pipHeightRatio };
    case PIP_CORNERS.TOP_LEFT:
      return { x: paddingX, y: paddingY, width: pipWidthRatio, height: pipHeightRatio };
    case PIP_CORNERS.BOTTOM_RIGHT:
    default:
      return { x: 1 - pipWidthRatio - paddingX, y: 1 - pipHeightRatio - paddingY, width: pipWidthRatio, height: pipHeightRatio };
  }
}

/**
 * Cria um MediaStream composto por Tela + Webcam PiP + Áudio.
 */
export function createCompositeStream({
  screenStream,
  cameraStream,
  audioStream,
  getPipPosition,
}) {
  if (!cameraStream || cameraStream.getVideoTracks().length === 0) {
    // Sem câmera, retorna stream de tela padrão mesclado com microfone
    if (audioStream && audioStream.getAudioTracks().length > 0) {
      const track = audioStream.getAudioTracks()[0];
      if (!screenStream.getAudioTracks().some((t) => t.id === track.id)) {
        screenStream.addTrack(track);
      }
    }
    return {
      stream: screenStream,
      stop: () => {},
    };
  }

  // Verifica se o ambiente suporta captureStream em Canvas
  const testCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const hasCaptureStream = testCanvas && (typeof testCanvas.captureStream === 'function');

  if (!hasCaptureStream) {
    // Fallback gracioso para ambientes de teste sem canvas.captureStream
    if (audioStream && audioStream.getAudioTracks().length > 0) {
      const track = audioStream.getAudioTracks()[0];
      if (!screenStream.getAudioTracks().some((t) => t.id === track.id)) {
        screenStream.addTrack(track);
      }
    }
    return {
      stream: screenStream,
      stop: () => {},
    };
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  const screenVideo = document.createElement('video');
  screenVideo.muted = true;
  screenVideo.autoplay = true;
  screenVideo.playsInline = true;
  screenVideo.srcObject = screenStream;
  try {
    const p = screenVideo.play();
    if (p?.catch) p.catch(() => {});
  } catch {}

  const cameraVideo = document.createElement('video');
  cameraVideo.muted = true;
  cameraVideo.autoplay = true;
  cameraVideo.playsInline = true;
  cameraVideo.srcObject = cameraStream;
  try {
    const p = cameraVideo.play();
    if (p?.catch) p.catch(() => {});
  } catch {}

  let animationFrameId = null;
  let isRunning = true;

  const drawFrame = () => {
    if (!isRunning) return;

    // 1. Desenha o fundo com o compartilhamento de tela
    try {
      ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
    } catch {
      ctx.fillStyle = '#1e1f22';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // 2. Calcula posição da webcam e desenha overlay Picture-in-Picture
    const pos = getPipPosition
      ? getNormalizedPipCoords(getPipPosition(), canvas.width, canvas.height)
      : getNormalizedPipCoords({ corner: PIP_CORNERS.BOTTOM_RIGHT });

    const pipX = canvas.width * pos.x;
    const pipY = canvas.height * pos.y;
    const pipW = canvas.width * pos.width;
    const pipH = canvas.height * pos.height;

    // Desenha borda arredondada e vídeo da câmera
    ctx.save();
    ctx.beginPath();
    const r = 10;
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(pipX, pipY, pipW, pipH, r);
    } else {
      ctx.rect(pipX, pipY, pipW, pipH);
    }
    ctx.clip();

    try {
      ctx.drawImage(cameraVideo, pipX, pipY, pipW, pipH);
    } catch {}
    ctx.restore();

    // Borda neon Discord Blurple
    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(pipX, pipY, pipW, pipH, r);
    } else {
      ctx.rect(pipX, pipY, pipW, pipH);
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#5865f2';
    ctx.stroke();
    ctx.restore();

    animationFrameId = requestAnimationFrame(drawFrame);
  };

  animationFrameId = requestAnimationFrame(drawFrame);

  const compositeStream = canvas.captureStream(30);

  // Adiciona áudios do screenStream e microfone
  screenStream.getAudioTracks().forEach((track) => compositeStream.addTrack(track));
  if (audioStream && audioStream.getAudioTracks().length > 0) {
    const audioTrack = audioStream.getAudioTracks()[0];
    if (!compositeStream.getAudioTracks().some((t) => t.id === audioTrack.id)) {
      compositeStream.addTrack(audioTrack);
    }
  }

  const stop = () => {
    isRunning = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    try {
      screenVideo.pause();
      screenVideo.srcObject = null;
      cameraVideo.pause();
      cameraVideo.srcObject = null;
    } catch {}
  };

  return {
    stream: compositeStream,
    stop,
  };
}
