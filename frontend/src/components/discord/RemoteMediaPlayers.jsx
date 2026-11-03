import React, { useEffect, useRef } from 'react';

function attachPlayWithUnlock(el, shouldPlay = true) {
  if (!el || !shouldPlay) return () => {};
  let unlockCleanup = null;

  const tryPlay = () => {
    if (!el) return;
    try {
      const promise = el.play?.();
      if (promise && typeof promise.catch === 'function') {
        promise.catch(() => {
          const resume = () => {
            try {
              el.play?.()?.catch?.(() => {});
            } catch {}
          };
          window.addEventListener('click', resume, { once: true });
          window.addEventListener('keydown', resume, { once: true });
          unlockCleanup = () => {
            window.removeEventListener('click', resume);
            window.removeEventListener('keydown', resume);
          };
        });
      }
    } catch {
      // Ignora caso o ambiente (ex: jsdom) não implemente HTMLMediaElement.play
    }
  };

  tryPlay();
  return () => {
    if (unlockCleanup) unlockCleanup();
  };
}

function RemoteAudioItem({ stream, isDeafened, testId }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !stream) return undefined;

    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    el.muted = Boolean(isDeafened);
    el.volume = 1.0;

    try {
      const preferredSpeaker = localStorage.getItem('discord_audio_output');
      if (preferredSpeaker && preferredSpeaker !== 'default' && typeof el.setSinkId === 'function') {
        el.setSinkId(preferredSpeaker).catch(() => {});
      }
    } catch {
      // Ignora se localStorage ou setSinkId não estiver disponível
    }

    const cleanupUnlock = attachPlayWithUnlock(el, !isDeafened);
    const tracks = typeof stream.getTracks === 'function' ? stream.getTracks() : [];
    const handleUnmute = () => attachPlayWithUnlock(el, !isDeafened);

    tracks.forEach((t) => t?.addEventListener?.('unmute', handleUnmute));
    el.onloadedmetadata = () => attachPlayWithUnlock(el, !isDeafened);

    return () => {
      cleanupUnlock();
      tracks.forEach((t) => t?.removeEventListener?.('unmute', handleUnmute));
    };
  }, [stream, isDeafened]);

  return (
    <audio
      ref={audioRef}
      autoPlay
      playsInline
      muted={Boolean(isDeafened)}
      data-testid={testId}
    />
  );
}

/**
 * Pool invisível de elementos <audio> para reproduzir o áudio WebRTC de todos os participantes remotos,
 * permanecendo ativo inclusive quando a sala está minimizada em modo Picture-in-Picture (PiP).
 */
export function RemoteAudioPool({ remotePeersMedia = {}, isDeafened = false }) {
  const audioItems = [];
  Object.values(remotePeersMedia || {}).forEach((peer) => {
    (peer?.audioStreams || []).forEach((stream, idx) => {
      if (stream) {
        audioItems.push({
          key: `${peer.userId}-${stream.id || idx}`,
          testId: `remote-audio-${peer.userId}-${idx}`,
          stream,
        });
      }
    });
  });

  return (
    <div
      style={{ position: 'fixed', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
      aria-hidden="true"
      data-testid="remote-audio-pool"
    >
      {audioItems.map((item) => (
        <RemoteAudioItem
          key={item.key}
          stream={item.stream}
          isDeafened={isDeafened}
          testId={item.testId}
        />
      ))}
    </div>
  );
}

/**
 * Componente reutilizável para exibir um MediaStream de vídeo remoto (webcam ou tela compartilhada).
 */
export function RemoteVideoView({ stream, className = '', testId, muted = true }) {
  const videoRef = useRef(null);

  const setRef = (el) => {
    videoRef.current = el;
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
      attachPlayWithUnlock(el, true);
    }
  };

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return undefined;

    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    const cleanupUnlock = attachPlayWithUnlock(el, true);
    const tracks = typeof stream.getTracks === 'function' ? stream.getTracks() : [];
    const handleUnmute = () => attachPlayWithUnlock(el, true);

    tracks.forEach((t) => t?.addEventListener?.('unmute', handleUnmute));
    el.onloadedmetadata = () => attachPlayWithUnlock(el, true);

    return () => {
      cleanupUnlock();
      tracks.forEach((t) => t?.removeEventListener?.('unmute', handleUnmute));
    };
  }, [stream]);

  return (
    <video
      ref={setRef}
      autoPlay
      playsInline
      muted={muted}
      className={className}
      data-testid={testId}
    />
  );
}
