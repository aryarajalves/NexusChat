import { useState, useEffect, useRef, useCallback } from 'react';
import {
  DEFAULT_ICE_SERVERS,
  getTracksByKind,
  classifyPeerMediaEntry,
  syncPeerLocalTracks,
} from './webrtcMediaUtils';

/**
 * Hook responsável pela malha WebRTC (RTCPeerConnection) em tempo real para canais de voz.
 * Transmite e recebe áudio de voz, vídeo de webcam e compartilhamento de tela via sinalização WebSocket.
 */
export default function useWebRTCVoiceRoom({
  channelId,
  token,
  currentUser,
  micStream,
  cameraStream,
  screenStream,
  isCameraOn,
  isScreenSharing,
  isMuted = true,
  isDeafened = false,
  cameraBlurMode = 'none',
  onRemoteScreenShareStarted,
  onRoomVoiceStatesUpdate,
  onSoundboardPlay,
}) {
  const [rtcConnected, setRtcConnected] = useState(false);
  const [rtcPeers, setRtcPeers] = useState([]);
  const [remotePeersMedia, setRemotePeersMedia] = useState({});
  const [roomVoiceStates, setRoomVoiceStates] = useState({});

  const onSoundboardPlayRef = useRef(onSoundboardPlay);
  onSoundboardPlayRef.current = onSoundboardPlay;

  const isMutedRef = useRef(isMuted);
  const isDeafenedRef = useRef(isDeafened);
  const cameraBlurModeRef = useRef(cameraBlurMode);
  useEffect(() => {
    isMutedRef.current = isMuted;
    isDeafenedRef.current = isDeafened;
    cameraBlurModeRef.current = cameraBlurMode;
  }, [isMuted, isDeafened, cameraBlurMode]);

  const wsRef = useRef(null);
  const heartbeatRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const intentionalCloseRef = useRef(false);
  const isMountedRef = useRef(true);
  const peersRef = useRef(new Map());

  const currentUserRef = useRef(currentUser);
  const micStreamRef = useRef(micStream);
  const cameraStreamRef = useRef(cameraStream);
  const screenStreamRef = useRef(screenStream);
  const isCameraOnRef = useRef(isCameraOn);
  const isScreenSharingRef = useRef(isScreenSharing);
  const onRemoteScreenShareStartedRef = useRef(onRemoteScreenShareStarted);
  const onRoomVoiceStatesUpdateRef = useRef(onRoomVoiceStatesUpdate);

  currentUserRef.current = currentUser;
  micStreamRef.current = micStream;
  cameraStreamRef.current = cameraStream;
  screenStreamRef.current = screenStream;
  isCameraOnRef.current = isCameraOn;
  isScreenSharingRef.current = isScreenSharing;
  onRemoteScreenShareStartedRef.current = onRemoteScreenShareStarted;
  onRoomVoiceStatesUpdateRef.current = onRoomVoiceStatesUpdate;

  const buildLocalMediaState = useCallback(() => ({
    isCameraOn: Boolean(isCameraOnRef.current && cameraStreamRef.current),
    isScreenSharing: Boolean(isScreenSharingRef.current && screenStreamRef.current),
    cameraStreamId: cameraStreamRef.current?.id || null,
    screenStreamId: screenStreamRef.current?.id || null,
    isMuted: Boolean(isMutedRef.current),
    isDeafened: Boolean(isDeafenedRef.current),
    cameraEffect: cameraBlurModeRef.current || 'none',
  }), []);

  const sendSignal = useCallback((targetUserId, signal) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;
    try {
      ws.send(JSON.stringify({ event: 'voice:signal', target_user_id: targetUserId ?? null, signal }));
    } catch {}
  }, []);

  const sendRoomVoiceState = useCallback((stateObj) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;
    try {
      ws.send(JSON.stringify({ event: 'voice:state', ...stateObj }));
    } catch {}
  }, []);

  const syncPublicState = useCallback(() => {
    if (!isMountedRef.current) return;
    const peersList = [];
    const mediaMap = {};
    for (const [peerId, peer] of peersRef.current.entries()) {
      peersList.push({ user_id: peerId, user_name: peer.userName });
      mediaMap[peerId] = classifyPeerMediaEntry(peer);
    }
    setRtcPeers(peersList);
    setRemotePeersMedia(mediaMap);
  }, []);

  const cleanupPeer = useCallback((peerId) => {
    const peer = peersRef.current.get(Number(peerId));
    if (!peer) return;
    try {
      peer.pc?.close?.();
    } catch {}
    peersRef.current.delete(Number(peerId));
  }, []);

  const cleanupAllPeers = useCallback(() => {
    for (const peerId of Array.from(peersRef.current.keys())) cleanupPeer(peerId);
    syncPublicState();
  }, [cleanupPeer, syncPublicState]);

  const syncLocalTracksToPeer = useCallback((peer) => {
    return syncPeerLocalTracks(peer, {
      micStream: micStreamRef.current,
      cameraStream: cameraStreamRef.current,
      screenStream: screenStreamRef.current,
      isCameraOn: isCameraOnRef.current,
      isScreenSharing: isScreenSharingRef.current,
    });
  }, []);

  const negotiateWithPeer = useCallback(
    async (peerId, { iceRestart = false } = {}) => {
      const peer = peersRef.current.get(Number(peerId));
      if (!peer?.pc) return;
      syncLocalTracksToPeer(peer);

      if (peer.makingOffer || (peer.pc.signalingState && peer.pc.signalingState !== 'stable')) {
        peer.needsRenegotiation = true;
        return;
      }

      try {
        peer.makingOffer = true;
        const offer = await peer.pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
          ...(iceRestart ? { iceRestart: true } : {}),
        });
        if (peer.pc.signalingState && peer.pc.signalingState !== 'stable') {
          peer.needsRenegotiation = true;
          return;
        }
        await peer.pc.setLocalDescription(offer);
        sendSignal(peer.peerId, {
          type: 'sdp-offer',
          sdp: peer.pc.localDescription || offer,
          user_id: currentUserRef.current?.id,
          user_name: currentUserRef.current?.name,
          mediaState: buildLocalMediaState(),
        });
      } catch {
        // Ignora erro transitório de negociação
      } finally {
        peer.makingOffer = false;
      }
    },
    [buildLocalMediaState, sendSignal, syncLocalTracksToPeer]
  );

  const getOrCreatePeer = useCallback(
    (remoteUserId, remoteUserName) => {
      const peerId = Number(remoteUserId);
      const existing = peersRef.current.get(peerId);
      if (existing) {
        if (remoteUserName) existing.userName = remoteUserName;
        return existing;
      }
      if (typeof RTCPeerConnection === 'undefined') return null;

      const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS });
      const peer = {
        peerId,
        userName: remoteUserName || 'Membro',
        pc,
        makingOffer: false,
        ignoreOffer: false,
        needsRenegotiation: false,
        pendingCandidates: [],
        mediaState: { isCameraOn: false, isScreenSharing: false, cameraStreamId: null, screenStreamId: null },
        audioStreams: new Map(),
        videoEntries: new Map(),
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal(peerId, {
            type: 'ice-candidate',
            candidate: typeof e.candidate.toJSON === 'function' ? e.candidate.toJSON() : e.candidate,
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') negotiateWithPeer(peerId, { iceRestart: true });
      };

      pc.onsignalingstatechange = () => {
        if (pc.signalingState === 'stable' && peer.needsRenegotiation) {
          peer.needsRenegotiation = false;
          negotiateWithPeer(peerId);
        }
      };

      pc.ontrack = (event) => {
        const track = event.track;
        if (!track) return;
        const rawStream = event.streams?.[0];

        if (track.kind === 'audio') {
          const audioStream =
            rawStream && getTracksByKind(rawStream, 'video').length === 0
              ? rawStream
              : typeof MediaStream !== 'undefined'
                ? new MediaStream([track])
                : rawStream || { id: track.id, getTracks: () => [track] };
          const key = track.id || `audio-${peer.audioStreams.size}`;
          peer.audioStreams.set(key, audioStream);
          track.onunmute = () => syncPublicState();
          track.onended = () => {
            peer.audioStreams.delete(key);
            syncPublicState();
          };
          syncPublicState();
        } else if (track.kind === 'video') {
          const videoStream =
            rawStream ||
            (typeof MediaStream !== 'undefined'
              ? new MediaStream([track])
              : { id: track.id, getTracks: () => [track] });
          const key = track.id || videoStream.id || `video-${peer.videoEntries.size}`;
          peer.videoEntries.set(key, { track, stream: videoStream });
          track.onunmute = () => syncPublicState();
          track.onended = () => {
            peer.videoEntries.delete(key);
            syncPublicState();
          };
          syncPublicState();
        }
      };

      peersRef.current.set(peerId, peer);
      syncLocalTracksToPeer(peer);
      return peer;
    },
    [negotiateWithPeer, sendSignal, syncLocalTracksToPeer, syncPublicState]
  );

  useEffect(() => {
    const peers = Array.from(peersRef.current.values());
    if (peers.length === 0) return;

    sendSignal(null, {
      type: 'media-state',
      user_id: currentUserRef.current?.id,
      user_name: currentUserRef.current?.name,
      mediaState: buildLocalMediaState(),
    });

    peers.forEach((peer) => {
      syncLocalTracksToPeer(peer);
      negotiateWithPeer(peer.peerId);
    });
  }, [micStream, cameraStream, screenStream, isCameraOn, isScreenSharing, cameraBlurMode, buildLocalMediaState, sendSignal, syncLocalTracksToPeer, negotiateWithPeer]);

  useEffect(() => {
    isMountedRef.current = true;
    if (!channelId || !token || typeof WebSocket === 'undefined') {
      setRtcConnected(false);
      return undefined;
    }

    intentionalCloseRef.current = false;

    const flushPendingCandidates = async (peer) => {
      while (peer.pendingCandidates.length > 0) {
        const cand = peer.pendingCandidates.shift();
        await peer.pc.addIceCandidate(cand).catch(() => {});
      }
    };

    const handleSignal = async (payload) => {
      const myId = Number(currentUserRef.current?.id);
      const senderId = Number(payload.sender_id || payload.signal?.user_id);
      if (!myId || !senderId || senderId === myId) return;
      if (payload.target_user_id != null && Number(payload.target_user_id) !== myId) return;

      const signal = payload.signal;
      if (!signal?.type) return;

      if (signal.type === 'peer-leave') {
        cleanupPeer(senderId);
        syncPublicState();
        return;
      }

      const peer = getOrCreatePeer(senderId, payload.sender_name || signal.user_name);
      if (!peer) return;
      if (signal.mediaState) {
        peer.mediaState = { ...peer.mediaState, ...signal.mediaState };
        if (signal.mediaState.isScreenSharing) {
          onRemoteScreenShareStartedRef.current?.(senderId, payload.sender_name || signal.user_name);
        }
        if (signal.mediaState.isMuted !== undefined || signal.mediaState.isDeafened !== undefined) {
          setRoomVoiceStates((prev) => {
            const next = {
              ...prev,
              [senderId]: {
                ...prev[senderId],
                is_muted: Boolean(signal.mediaState.isMuted),
                is_deafened: Boolean(signal.mediaState.isDeafened),
                is_speaking: false,
              },
            };
            onRoomVoiceStatesUpdateRef.current?.(next);
            return next;
          });
        }
      }

      if (signal.type === 'peer-join') {
        syncLocalTracksToPeer(peer);
        sendSignal(senderId, {
          type: 'peer-ready',
          user_id: myId,
          user_name: currentUserRef.current?.name,
          mediaState: buildLocalMediaState(),
        });
        syncPublicState();
        if (myId < senderId) await negotiateWithPeer(senderId);
      } else if (signal.type === 'peer-ready') {
        syncLocalTracksToPeer(peer);
        syncPublicState();
        if (myId < senderId) await negotiateWithPeer(senderId);
      } else if (signal.type === 'sdp-offer') {
        const isPolite = myId > senderId;
        const collision = peer.makingOffer || (peer.pc.signalingState && peer.pc.signalingState !== 'stable');
        peer.ignoreOffer = !isPolite && collision;
        if (peer.ignoreOffer) return;

        try {
          if (collision && isPolite) await peer.pc.setLocalDescription({ type: 'rollback' }).catch(() => {});
          await peer.pc.setRemoteDescription(signal.sdp);
          syncLocalTracksToPeer(peer);
          await flushPendingCandidates(peer);
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          sendSignal(senderId, {
            type: 'sdp-answer',
            sdp: peer.pc.localDescription || answer,
            user_id: myId,
            user_name: currentUserRef.current?.name,
            mediaState: buildLocalMediaState(),
          });
          syncPublicState();
        } catch {}
      } else if (signal.type === 'sdp-answer') {
        try {
          await peer.pc.setRemoteDescription(signal.sdp);
          await flushPendingCandidates(peer);
          syncPublicState();
          if (peer.needsRenegotiation) {
            peer.needsRenegotiation = false;
            await negotiateWithPeer(senderId);
          }
        } catch {}
      } else if (signal.type === 'ice-candidate' && signal.candidate) {
        if (peer.pc.remoteDescription) {
          await peer.pc.addIceCandidate(signal.candidate).catch(() => {});
        } else {
          peer.pendingCandidates.push(signal.candidate);
        }
      } else if (signal.type === 'media-state') {
        syncPublicState();
      }
    };

    const connectSignaling = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/v1/discord/ws/channels/${channelId}?token=${token}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setRtcConnected(true);
        sendSignal(null, {
          type: 'peer-join',
          user_id: currentUserRef.current?.id,
          user_name: currentUserRef.current?.name,
          mediaState: buildLocalMediaState(),
        });
        sendRoomVoiceState({
          is_muted: Boolean(isMutedRef.current),
          is_deafened: Boolean(isDeafenedRef.current),
          is_speaking: false,
        });
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === 1) {
            try {
              ws.send(JSON.stringify({ event: 'ping' }));
            } catch {}
          }
        }, 25000);
      };

      ws.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (!payload?.event || payload.event === 'pong') return;
          if (payload.event === 'voice:signal') {
            handleSignal(payload);
          } else if (payload.event === 'voice:soundboard') {
            onSoundboardPlayRef.current?.(payload);
          } else if (payload.event === 'voice:state' && payload.user_id) {
            setRoomVoiceStates((prev) => {
              const next = {
                ...prev,
                [payload.user_id]: {
                  is_muted: payload.is_muted,
                  is_deafened: payload.is_deafened,
                  is_speaking: payload.is_speaking,
                },
              };
              onRoomVoiceStatesUpdateRef.current?.(next);
              return next;
            });
          } else if (payload.event === 'presence:leave' && Array.isArray(payload.online_users)) {
            const activeIds = new Set(payload.online_users.map((u) => Number(u.user_id || u.id)));
            let removed = false;
            for (const peerId of Array.from(peersRef.current.keys())) {
              if (!activeIds.has(peerId)) {
                cleanupPeer(peerId);
                removed = true;
              }
            }
            if (removed) syncPublicState();
          }
        } catch {}
      };

      ws.onclose = () => {
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        if (!isMountedRef.current) return;
        setRtcConnected(false);
        if (!intentionalCloseRef.current) reconnectTimerRef.current = setTimeout(connectSignaling, 2500);
      };
    };

    connectSignaling();

    return () => {
      isMountedRef.current = false;
      intentionalCloseRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      sendSignal(null, { type: 'peer-leave', user_id: currentUserRef.current?.id });
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
      cleanupAllPeers();
    };
  }, [channelId, token, buildLocalMediaState, cleanupAllPeers, cleanupPeer, getOrCreatePeer, negotiateWithPeer, sendSignal, syncLocalTracksToPeer, syncPublicState]);

  const sendSoundboardPlay = useCallback((sound) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: 'voice:soundboard', sound }));
    }
  }, []);

  return { rtcConnected, rtcPeers, remotePeersMedia, roomVoiceStates, sendRoomVoiceState, sendSoundboardPlay };
}
