import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Volume2, Users, Menu, Film, Music } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import VoicePipPlayer from './VoicePipPlayer';
import VoiceStageView from './VoiceStageView';
import VoiceControlDock from './VoiceControlDock';
import ShareScreenModal from './ShareScreenModal';
import VoiceRecordingsGalleryModal from './VoiceRecordingsGalleryModal';
import SoundboardPopover from './SoundboardPopover';
import { playSoundboardAudio } from './soundboardSynth';
import useLiveKitVoice from './useLiveKitVoice';
import useWebRTCVoiceRoom from './useWebRTCVoiceRoom';
import { RemoteAudioPool } from './RemoteMediaPlayers';
import { createMixedCallAudioStream } from './webrtcMediaUtils';

function bindLocalVideoElement(element, stream) {
  if (!element || !stream) return;
  if (element.srcObject !== stream) element.srcObject = stream;
  const safePlay = () => { try { element.play?.()?.catch?.(() => {}); } catch {} };
  element.onloadedmetadata = safePlay;
  safePlay();
}

export default function VoiceChannelArea({
  channel, connectionStatus = 'connected', currentUser, onlineUsers = [], voiceUsers = [],
  voiceStates = {}, onSendVoiceState, onDisconnectVoice, onDisconnect, showMembers, onToggleMembers, onToggleMobileNav,
  isMinimized = false, onReturnToVoice, token, isMuted: externalIsMuted, setIsMuted: externalSetIsMuted,
  isDeafened: externalIsDeafened, setIsDeafened: externalSetIsDeafened, onRoomVoiceStatesUpdate,
}) {
  const [internalMuted, setInternalMuted] = useState(false), [internalDeafened, setInternalDeafened] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false), [isScreenSharing, setIsScreenSharing] = useState(false), [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraBlurMode, setCameraBlurMode] = useState('none'), [isShareModalOpen, setIsShareModalOpen] = useState(false), [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isSoundboardOpen, setIsSoundboardOpen] = useState(false), [serverSounds, setServerSounds] = useState([]);

  const isMuted = externalIsMuted !== undefined ? externalIsMuted : internalMuted;
  const isDeafened = externalIsDeafened !== undefined ? externalIsDeafened : internalDeafened;
  const setIsMuted = externalSetIsMuted || setInternalMuted, setIsDeafened = externalSetIsDeafened || setInternalDeafened;

  const [micStream, setMicStream] = useState(null), [screenStream, setScreenStream] = useState(null), [cameraStream, setCameraStream] = useState(null);

  const { isSfuActive } = useLiveKitVoice(channel?.id, token);
  const { addToast } = useToast();

  const streamRef = useRef(null), audioContextRef = useRef(null), animationFrameRef = useRef(null);
  const screenStreamRef = useRef(null), screenVideoRef = useRef(null);
  const cameraStreamRef = useRef(null), cameraVideoRef = useRef(null);

  const isMutedRef = useRef(isMuted), isDeafenedRef = useRef(isDeafened);
  isMutedRef.current = isMuted; isDeafenedRef.current = isDeafened;

  // Quando outro membro da call inicia o compartilhamento de tela, interrompe o nosso automaticamente (apenas 1 tela por vez)
  const handleRemoteScreenShareStarted = useCallback((senderId, senderName) => {
    if (screenStreamRef.current) { screenStreamRef.current.getTracks?.().forEach((t) => t.stop()); screenStreamRef.current = null; }
    setScreenStream(null); setIsScreenSharing(false);
    addToast(`${senderName || 'Outro participante'} iniciou uma transmissão de tela. Sua transmissão foi encerrada.`, 'info');
  }, [addToast]);

  const handleRemoteSoundboardPlay = useCallback((payload) => {
    if (!payload?.sound) return;
    if (payload.user_id !== currentUser?.id && !isDeafenedRef.current) {
      playSoundboardAudio(payload.sound);
    }
    addToast(`${payload.user_name || 'Alguém'} tocou ${payload.sound.emoji || '🔊'} ${payload.sound.name}`, 'info');
  }, [currentUser?.id, addToast]);

  const { rtcPeers, remotePeersMedia, roomVoiceStates, sendRoomVoiceState, sendSoundboardPlay } = useWebRTCVoiceRoom({
    channelId: channel?.id,
    token,
    currentUser,
    micStream,
    cameraStream,
    screenStream,
    isCameraOn,
    isScreenSharing,
    isMuted,
    isDeafened,
    cameraBlurMode,
    onRemoteScreenShareStarted: handleRemoteScreenShareStarted,
    onRoomVoiceStatesUpdate,
    onSoundboardPlay: handleRemoteSoundboardPlay,
  });

  useEffect(() => {
    if (!channel?.server_id || !token) return;
    fetch(`/api/v1/discord/servers/${channel.server_id}/soundboard`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => (r.ok ? r.json() : [])).then((data) => setServerSounds(Array.isArray(data) ? data : [])).catch(() => {});
  }, [channel?.server_id, token]);

  const handleTriggerSound = useCallback((sound, vol) => {
    if (typeof sendSoundboardPlay === 'function') sendSoundboardPlay(sound);
    if (channel?.id) {
      fetch(`/api/v1/discord/channels/${channel.id}/soundboard/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ sound_id: sound.id, sound_name: sound.name, emoji: sound.emoji, audio_url: sound.audio_url, volume: vol }),
      }).catch(() => {});
    }
  }, [channel?.id, token, sendSoundboardPlay]);

  const emitVoiceState = useCallback(
    (payload) => {
      if (onSendVoiceState) onSendVoiceState(payload);
      sendRoomVoiceState(payload);
    },
    [onSendVoiceState, sendRoomVoiceState]
  );

  const emitVoiceStateRef = useRef(emitVoiceState);
  emitVoiceStateRef.current = emitVoiceState;

  // Sincroniza tracks locais com o estado Mudo / Ensurdecer (seja disparado do dock ou do rodapé da barra lateral)
  useEffect(() => {
    if (streamRef.current) {
      const tracks = streamRef.current.getAudioTracks ? streamRef.current.getAudioTracks() : streamRef.current.getTracks?.() || [];
      const disabled = Boolean(isMuted || isDeafened);
      tracks.forEach((track) => {
        track.enabled = !disabled;
      });
    }
    emitVoiceState({ is_muted: isMuted, is_deafened: isDeafened, is_speaking: false });
  }, [isMuted, isDeafened, emitVoiceState]);

  useEffect(() => {
    let active = true;

    async function initMic() {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) return;
        let savedMic = null;
        try {
          savedMic = localStorage.getItem('discord_audio_input');
        } catch {}

        const audioConstraints =
          savedMic && savedMic !== 'default'
            ? { deviceId: { ideal: savedMic }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        if (!active) {
          stream?.getTracks?.().forEach((t) => t.stop());
          return;
        }

        const audioTracks = stream?.getAudioTracks ? stream.getAudioTracks() : stream?.getTracks?.() || [];
        audioTracks.forEach((t) => {
          t.enabled = !(isMutedRef.current || isDeafenedRef.current);
        });

        streamRef.current = stream;
        setMicStream(stream);

        // Notifica estado inicial do microfone para a sala
        emitVoiceStateRef.current({
          is_muted: isMutedRef.current,
          is_deafened: isDeafenedRef.current,
          is_speaking: false,
        });

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const checkVolume = () => {
          if (!active) return;
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          const mutedNow = isMutedRef.current;
          const deafNow = isDeafenedRef.current;
          const speaking = avg > 20 && !mutedNow && !deafNow;

          setIsSpeaking((prev) => {
            if (prev !== speaking) {
              emitVoiceStateRef.current({
                is_muted: mutedNow,
                is_deafened: deafNow,
                is_speaking: speaking,
              });
            }
            return speaking;
          });

          animationFrameRef.current = requestAnimationFrame(checkVolume);
        };

        checkVolume();
      } catch {
        console.warn('Microfone não acessível ou permissão negada. Entrando como ouvinte.');
      }
    }

    initMic();

    return () => {
      active = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks?.().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setMicStream(null);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [channel?.id]);

  const handleToggleMute = () => {
    const next = !isMuted; setIsMuted(next);
    addToast(next ? 'Microfone desativado' : 'Microfone ativado', 'info');
  };

  const handleToggleDeafen = () => {
    const next = !isDeafened; setIsDeafened(next); if (next) setIsMuted(true);
    addToast(next ? 'Áudio ensurdecido' : 'Áudio restaurado', 'info');
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) { screenStreamRef.current.getTracks?.().forEach((t) => t.stop()); screenStreamRef.current = null; }
      setScreenStream(null); setIsScreenSharing(false);
      addToast('Compartilhamento de tela finalizado', 'info');
    } else {
      setIsShareModalOpen(true);
    }
  };

  const handleConfirmStartScreenShare = async ({ captureAudio }) => {
    try {
      if (!navigator?.mediaDevices?.getDisplayMedia) {
        addToast('Compartilhamento de tela não suportado neste navegador.', 'error'); return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: Boolean(captureAudio) });
      screenStreamRef.current = stream; setScreenStream(stream); setIsScreenSharing(true);
      addToast(captureAudio ? 'Transmissão iniciada com áudio do computador!' : 'Transmissão de tela iniciada (sem som do computador)!', 'success');

      const firstVideo = stream.getVideoTracks?.()[0];
      if (firstVideo) {
        firstVideo.onended = () => { screenStreamRef.current = null; setScreenStream(null); setIsScreenSharing(false); };
      }
    } catch {}
  };

  const handleSetVideoRef = (element) => {
    screenVideoRef.current = element;
    bindLocalVideoElement(element, screenStreamRef.current);
  };

  useEffect(() => {
    if (isScreenSharing) bindLocalVideoElement(screenVideoRef.current, screenStreamRef.current);
  }, [isScreenSharing, screenStream]);

  const handleToggleCamera = async () => {
    if (isCameraOn) {
      if (cameraStreamRef.current) { cameraStreamRef.current.getTracks?.().forEach((t) => t.stop()); cameraStreamRef.current = null; }
      setCameraStream(null); setIsCameraOn(false); addToast('Câmera desligada', 'info');
    } else {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) { addToast('Câmera não suportada neste navegador.', 'error'); return; }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraStreamRef.current = stream; setCameraStream(stream); setIsCameraOn(true); addToast('Câmera ligada com sucesso!', 'success');
        const firstVideo = stream.getVideoTracks?.()[0];
        if (firstVideo) {
          firstVideo.onended = () => { cameraStreamRef.current = null; setCameraStream(null); setIsCameraOn(false); };
        }
      } catch {
        addToast('Permissão de câmera negada ou câmera indisponível.', 'error');
      }
    }
  };

  const handleSetCameraVideoRef = (element) => {
    cameraVideoRef.current = element;
    bindLocalVideoElement(element, cameraStreamRef.current);
  };

  useEffect(() => {
    if (isCameraOn) bindLocalVideoElement(cameraVideoRef.current, cameraStreamRef.current);
  }, [isCameraOn, cameraStream]);

  useEffect(() => {
    return () => {
      screenStreamRef.current?.getTracks?.().forEach((t) => t.stop()); screenStreamRef.current = null;
      cameraStreamRef.current?.getTracks?.().forEach((t) => t.stop()); cameraStreamRef.current = null;
    };
  }, []);

  // Mixa áudio do microfone local com o áudio recebido de todos os amigos para gravação completa da conversa
  const mixedCallAudio = useMemo(() => {
    return createMixedCallAudioStream(micStream, remotePeersMedia);
  }, [micStream, remotePeersMedia]);

  // Identifica a tela ativa (seja local ou remota) para que a gravação capture a transmissão que está no palco
  const activeRemoteScreen = Object.values(remotePeersMedia || {}).find((p) => Boolean(p?.screenStream));
  const activeRecordingScreen = screenStream || activeRemoteScreen?.screenStream || null;

  const mergedVoiceStates = { ...voiceStates, ...roomVoiceStates };

  const participants = (() => {
    const map = new Map();
    const sourceUsers = (voiceUsers && voiceUsers.length > 0) ? voiceUsers : (onlineUsers || []);
    sourceUsers.forEach((u) => {
      const uid = u.user_id || u.id;
      if (uid) map.set(Number(uid), { user_id: Number(uid), user_name: u.user_name || u.name });
    });
    (rtcPeers || []).forEach((u) => {
      if (u.user_id) map.set(Number(u.user_id), { user_id: Number(u.user_id), user_name: u.user_name });
    });
    if (currentUser) map.set(Number(currentUser.id), { user_id: Number(currentUser.id), user_name: currentUser.name });
    return map.size > 0
      ? Array.from(map.values())
      : [{ user_id: currentUser?.id || 1, user_name: currentUser?.name || 'Você' }];
  })();

  return (
    <>
      <RemoteAudioPool remotePeersMedia={remotePeersMedia} isDeafened={isDeafened} />

      {isMinimized ? (
        <VoicePipPlayer
          channel={channel}
          currentUser={currentUser}
          participantsCount={participants.length}
          isMuted={isMuted}
          isSpeaking={isSpeaking}
          isCameraOn={isCameraOn}
          isScreenSharing={isScreenSharing}
          onToggleMute={handleToggleMute}
          onToggleCamera={handleToggleCamera}
          onToggleScreenShare={handleToggleScreenShare}
          onDisconnectVoice={onDisconnectVoice || onDisconnect}
          onReturnToVoice={onReturnToVoice}
          onSetVideoRef={handleSetVideoRef}
          onSetCameraVideoRef={handleSetCameraVideoRef}
        />
      ) : (
        <section className="discord-chat-area voice-channel-area" aria-label={`Canal de Voz 🔊 ${channel.name}`}>
          <div className="chat-header">
            <div className="chat-header-title">
              {onToggleMobileNav && (
                <button
                  type="button"
                  className="chat-mobile-nav-btn"
                  onClick={onToggleMobileNav}
                  title="Abrir Canais"
                  data-testid="chat-mobile-nav-btn"
                >
                  <Menu size={22} />
                </button>
              )}
              <Volume2 size={20} color="#5865f2" />
              <span>{channel.name}</span>
              <span className="chat-header-desc">Canal de Voz & Transmissão</span>
            </div>

            <div className="chat-header-actions">
              <div className={`connection-pill pill-${connectionStatus}`} data-testid="voice-connection-status-pill">
                <span className="status-indicator-dot" />
                <span className="status-indicator-text">
                  {connectionStatus === 'connected'
                    ? isSfuActive
                      ? 'Voz Conectada (RTC SFU)'
                      : 'Voz Conectada (RTC)'
                    : 'Conectando à Voz...'}
                </span>
              </div>

              <button
                type="button"
                className={`control-icon-btn ${isGalleryOpen ? 'active' : ''}`}
                onClick={() => setIsGalleryOpen(true)}
                title="Gravações da Sala"
                data-testid="toggle-recordings-gallery-btn"
              >
                <Film size={20} />
              </button>

              <button
                type="button"
                className={`control-icon-btn ${isSoundboardOpen ? 'active' : ''}`}
                onClick={() => setIsSoundboardOpen((prev) => !prev)}
                title="Soundboard"
                data-testid="open-soundboard-btn"
              >
                <Music size={20} />
              </button>

              <button
                type="button"
                className={`control-icon-btn ${showMembers ? 'active' : ''}`}
                onClick={onToggleMembers}
                title="Alternar Lista de Membros"
                data-testid="toggle-members-btn"
              >
                <Users size={20} />
              </button>
            </div>
          </div>

          <VoiceStageView
            channel={channel}
            currentUser={currentUser}
            participants={participants}
            mergedVoiceStates={mergedVoiceStates}
            remotePeersMedia={remotePeersMedia}
            isSpeaking={isSpeaking}
            isMuted={isMuted}
            isDeafened={isDeafened}
            isCameraOn={isCameraOn}
            isScreenSharing={isScreenSharing}
            cameraBlurMode={cameraBlurMode}
            onChangeCameraBlurMode={setCameraBlurMode}
            onSetVideoRef={handleSetVideoRef}
            onSetCameraVideoRef={handleSetCameraVideoRef}
          />

          <VoiceControlDock
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            isDeafened={isDeafened}
            onToggleDeafen={handleToggleDeafen}
            isCameraOn={isCameraOn}
            onToggleCamera={handleToggleCamera}
            isScreenSharing={isScreenSharing}
            onToggleScreenShare={handleToggleScreenShare}
            cameraBlurMode={cameraBlurMode}
            onChangeCameraBlurMode={setCameraBlurMode}
            channel={channel}
            mixedCallAudio={mixedCallAudio}
            activeRecordingScreen={activeRecordingScreen}
            cameraStream={cameraStream}
            currentUser={currentUser}
            onDisconnectVoice={onDisconnectVoice || onDisconnect}
          />
        </section>
      )}

      <ShareScreenModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onConfirmShare={handleConfirmStartScreenShare}
      />

      <VoiceRecordingsGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        channel={channel}
        currentUser={currentUser}
      />

      <SoundboardPopover
        isOpen={isSoundboardOpen}
        onClose={() => setIsSoundboardOpen(false)}
        channelId={channel?.id}
        serverId={channel?.server_id}
        serverSounds={serverSounds}
        onTriggerSound={handleTriggerSound}
        isDeafened={isDeafened}
      />
    </>
  );
}
