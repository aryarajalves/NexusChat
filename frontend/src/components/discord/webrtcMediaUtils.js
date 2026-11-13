export const DEFAULT_ICE_SERVERS = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
      'stun:stun.cloudflare.com:3478',
    ],
  },
];

export function getTracksByKind(stream, kind) {
  if (!stream) return [];
  if (kind === 'audio' && typeof stream.getAudioTracks === 'function') {
    return stream.getAudioTracks();
  }
  if (kind === 'video' && typeof stream.getVideoTracks === 'function') {
    return stream.getVideoTracks();
  }
  return typeof stream.getTracks === 'function'
    ? stream.getTracks().filter((t) => !kind || t.kind === kind)
    : [];
}

export function classifyPeerMediaEntry(peer) {
  let peerCam = null;
  let peerScreen = null;
  const ms = peer.mediaState || {};
  const liveVideos = Array.from(peer.videoEntries.values()).filter(
    (entry) => entry.track?.readyState !== 'ended'
  );

  for (const { stream } of liveVideos) {
    if (ms.screenStreamId && stream.id === ms.screenStreamId) {
      if (ms.isScreenSharing !== false) peerScreen = stream;
    } else if (ms.cameraStreamId && stream.id === ms.cameraStreamId) {
      if (ms.isCameraOn !== false) peerCam = stream;
    } else if (ms.isScreenSharing && !ms.isCameraOn) {
      peerScreen = stream;
    } else if (ms.isCameraOn && !ms.isScreenSharing) {
      peerCam = stream;
    } else if (!peerCam && ms.isCameraOn !== false) {
      peerCam = stream;
    } else if (!peerScreen && ms.isScreenSharing !== false) {
      peerScreen = stream;
    }
  }

  if (ms.isCameraOn === false) peerCam = null;
  if (ms.isScreenSharing === false) peerScreen = null;

  return {
    userId: peer.peerId,
    userName: peer.userName,
    audioStreams: Array.from(peer.audioStreams.values()),
    cameraStream: peerCam,
    screenStream: peerScreen,
    isScreenSharing: Boolean(ms.isScreenSharing || peerScreen),
    isCameraOn: Boolean(ms.isCameraOn || peerCam),
    cameraEffect: ms.cameraEffect || 'none',
  };
}

export function syncPeerLocalTracks(peer, { micStream, cameraStream, screenStream, isCameraOn, isScreenSharing }) {
  if (!peer?.pc) return false;
  const desired = [];

  if (micStream) {
    getTracksByKind(micStream, 'audio').forEach((track) => {
      if (track.readyState !== 'ended') desired.push({ track, stream: micStream });
    });
  }
  if (isCameraOn && cameraStream) {
    getTracksByKind(cameraStream, 'video').forEach((track) => {
      if (track.readyState !== 'ended') desired.push({ track, stream: cameraStream });
    });
  }
  if (isScreenSharing && screenStream) {
    getTracksByKind(screenStream, null).forEach((track) => {
      if (track.readyState !== 'ended') desired.push({ track, stream: screenStream });
    });
  }

  const senders = typeof peer.pc.getSenders === 'function' ? peer.pc.getSenders() : [];
  const desiredTracks = new Set(desired.map((d) => d.track));
  let changed = false;

  for (const sender of senders) {
    if (sender.track && !desiredTracks.has(sender.track)) {
      try {
        peer.pc.removeTrack?.(sender);
        changed = true;
      } catch {
        // Ignora falha ao remover track antiga
      }
    }
  }

  const activeSenders = typeof peer.pc.getSenders === 'function' ? peer.pc.getSenders() : [];
  const existingTracks = new Set(activeSenders.map((s) => s.track).filter(Boolean));

  for (const { track, stream } of desired) {
    if (!existingTracks.has(track)) {
      try {
        peer.pc.addTrack(track, stream);
        changed = true;
      } catch {
        // Ignora caso já tenha sido adicionada
      }
    }
  }

  return changed;
}

/**
 * Cria um MediaStream mixando o microfone local e todos os fluxos de áudio remotos dos participantes da call,
 * permitindo que a gravação capture a conversa completa de todos na sala.
 */
export function createMixedCallAudioStream(localMicStream, remotePeersMedia) {
  const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  if (!AudioCtx) {
    return localMicStream || null;
  }
  try {
    const ctx = new AudioCtx();
    const dest = ctx.createMediaStreamDestination ? ctx.createMediaStreamDestination() : null;
    if (!dest) return localMicStream || null;

    if (localMicStream && typeof ctx.createMediaStreamSource === 'function') {
      try {
        const localSource = ctx.createMediaStreamSource(localMicStream);
        localSource.connect(dest);
      } catch {}
    }

    if (remotePeersMedia && typeof ctx.createMediaStreamSource === 'function') {
      Object.values(remotePeersMedia).forEach((peer) => {
        (peer?.audioStreams || []).forEach((st) => {
          if (st) {
            try {
              const remoteSource = ctx.createMediaStreamSource(st);
              remoteSource.connect(dest);
            } catch {}
          }
        });
      });
    }

    const mixedStream = dest.stream || localMicStream;
    if (mixedStream) {
      mixedStream._mixedAudioCtx = ctx;
    }
    return mixedStream;
  } catch {
    return localMicStream || null;
  }
}

/**
 * Cria um MediaStream com UMA ÚNICA FAIXA MASTER DE ÁUDIO combinando:
 * 1. O som da tela compartilhada / sistema operacional / aba (se houver)
 * 2. O microfone e voz dos participantes da call (audioStream / micStream)
 * 
 * Ativa o AudioContext de forma garantida no clique do usuário (user gesture)
 * e evita o descarte da segunda faixa de áudio pelo MediaRecorder do navegador.
 */
export async function createRecordingMasterAudioStream({ screenStream, audioStream, micStream, remotePeersMedia }) {
  const sourcesToMix = [];

  // 1. Áudio da tela compartilhada (se o usuário marcou transmitir áudio da aba/sistema)
  if (screenStream && screenStream.getAudioTracks && screenStream.getAudioTracks().length > 0) {
    sourcesToMix.push(screenStream);
  }

  // 2. Fluxo da call de voz
  if (audioStream && audioStream.getAudioTracks && audioStream.getAudioTracks().length > 0) {
    // Se houver um AudioContext associado suspenso, retoma imediatamente
    if (audioStream._mixedAudioCtx && audioStream._mixedAudioCtx.state === 'suspended') {
      try {
        await audioStream._mixedAudioCtx.resume();
      } catch {}
    }
    sourcesToMix.push(audioStream);
  } else if (micStream && micStream.getAudioTracks && micStream.getAudioTracks().length > 0) {
    // Fallback: microfone local direto
    sourcesToMix.push(micStream);
  }

  // Se não temos nenhuma fonte de áudio disponível
  if (sourcesToMix.length === 0) {
    if (micStream && micStream.getAudioTracks && micStream.getAudioTracks().length > 0) {
      return { stream: micStream, cleanup: () => {} };
    }
    return { stream: null, cleanup: () => {} };
  }

  // Se temos apenas 1 fonte de áudio e não há áudio da tela para mesclar
  const hasScreenAudio = Boolean(screenStream && screenStream.getAudioTracks && screenStream.getAudioTracks().length > 0);
  if (sourcesToMix.length === 1 && !hasScreenAudio) {
    const single = sourcesToMix[0];
    if (single._mixedAudioCtx && single._mixedAudioCtx.state === 'suspended') {
      try {
        await single._mixedAudioCtx.resume();
      } catch {}
    }
    return { stream: single, cleanup: () => {} };
  }

  // Mixagem master via Web Audio API
  const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
  if (!AudioCtx) {
    return { stream: sourcesToMix[0], cleanup: () => {} };
  }

  try {
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }

    const dest = ctx.createMediaStreamDestination ? ctx.createMediaStreamDestination() : null;
    if (!dest) {
      return { stream: sourcesToMix[0], cleanup: () => {} };
    }

    const connectedNodes = [];
    sourcesToMix.forEach((st) => {
      try {
        if (typeof ctx.createMediaStreamSource === 'function') {
          const node = ctx.createMediaStreamSource(st);
          node.connect(dest);
          connectedNodes.push(node);
        }
      } catch {}
    });

    const masterStream = dest.stream;
    const cleanup = () => {
      try {
        connectedNodes.forEach((node) => {
          try { node.disconnect(); } catch {}
        });
        if (ctx.state !== 'closed' && typeof ctx.close === 'function') {
          ctx.close().catch(() => {});
        }
      } catch {}
    };

    return {
      stream: (masterStream && masterStream.getAudioTracks && masterStream.getAudioTracks().length > 0) ? masterStream : sourcesToMix[0],
      cleanup,
    };
  } catch {
    return { stream: sourcesToMix[0], cleanup: () => {} };
  }
}


