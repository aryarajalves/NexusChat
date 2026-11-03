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

