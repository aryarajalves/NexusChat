import { useState, useEffect, useRef, useCallback } from 'react';
import { computeVoiceSignalLevel, createProcessedVoiceStream } from './voiceNoiseGate';

function bindLocalVideoElement(el, stream) {
  if (!el || !stream) return;
  if (el.srcObject !== stream) el.srcObject = stream;
  el.onloadedmetadata = () => { try { el.play?.()?.catch?.(() => {}); } catch {} };
  try { el.play?.()?.catch?.(() => {}); } catch {}
}

/**
 * Hook customizado para captura e gerenciamento de mídias locais na sala de voz:
 * microfone (com detector de volume Web Audio para `isSpeaking`), webcam e compartilhamento de tela.
 */
export default function useVoiceLocalMedia({
  channelId,
  isMuted,
  isDeafened,
  setIsMuted,
  setIsDeafened,
  isNoiseSuppressionEnabled = true,
  emitVoiceState,
  onSpeakingChange,
  addToast,
}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const [micStream, setMicStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [cameraStream, setCameraStream] = useState(null);

  const streamRef = useRef(null);
  const rawStreamRef = useRef(null);
  const noiseGateRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);
  const screenStreamRef = useRef(null);
  const screenVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraVideoRef = useRef(null);

  const isMutedRef = useRef(isMuted);
  const isDeafenedRef = useRef(isDeafened);
  const isNoiseSuppressionRef = useRef(isNoiseSuppressionEnabled);
  isMutedRef.current = isMuted;
  isDeafenedRef.current = isDeafened;
  isNoiseSuppressionRef.current = isNoiseSuppressionEnabled;

  const emitVoiceStateRef = useRef(emitVoiceState);
  emitVoiceStateRef.current = emitVoiceState;
  const onSpeakingChangeRef = useRef(onSpeakingChange);
  onSpeakingChangeRef.current = onSpeakingChange;

  useEffect(() => {
    onSpeakingChangeRef.current?.(Boolean(isSpeaking && !isMuted && !isDeafened));
  }, [isSpeaking, isMuted, isDeafened]);

  // Aplica supressão de ruído e Noise Gate em tempo real nas tracks de áudio do microfone
  useEffect(() => {
    const enabled = Boolean(isNoiseSuppressionEnabled);
    noiseGateRef.current?.setEnabled(enabled);

    const targetStream = rawStreamRef.current || streamRef.current;
    if (!targetStream) return;
    const tracks = targetStream.getAudioTracks
      ? targetStream.getAudioTracks()
      : targetStream.getTracks?.() || [];
    tracks.forEach((track) => {
      try {
        track.applyConstraints?.({
          noiseSuppression: enabled,
          echoCancellation: enabled,
          autoGainControl: !enabled,
        })?.catch?.(() => {});
      } catch {}
    });
  }, [isNoiseSuppressionEnabled]);

  // Sincroniza tracks locais com o estado Mudo / Ensurdecer
  useEffect(() => {
    const disabled = Boolean(isMuted || isDeafened);
    [rawStreamRef.current, streamRef.current].forEach((st) => {
      if (!st) return;
      const tracks = st.getAudioTracks ? st.getAudioTracks() : st.getTracks?.() || [];
      tracks.forEach((track) => {
        track.enabled = !disabled;
      });
    });
    if (isMuted || isDeafened) setIsSpeaking(false);
    emitVoiceStateRef.current?.({ is_muted: isMuted, is_deafened: isDeafened, is_speaking: false });
  }, [isMuted, isDeafened]);

  useEffect(() => {
    let active = true;

    async function initMic() {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) return;
        let savedMic = null;
        try {
          savedMic = localStorage.getItem('discord_audio_input');
        } catch {}

        const useNS = Boolean(isNoiseSuppressionRef.current);
        const audioConstraints =
          savedMic && savedMic !== 'default'
            ? { deviceId: { ideal: savedMic }, echoCancellation: useNS, noiseSuppression: useNS, autoGainControl: !useNS }
            : { echoCancellation: useNS, noiseSuppression: useNS, autoGainControl: !useNS };

        let rawStream;
        try {
          rawStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        } catch {
          rawStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        if (!active) {
          rawStream?.getTracks?.().forEach((t) => t.stop());
          return;
        }

        const rawAudioTracks = rawStream?.getAudioTracks ? rawStream.getAudioTracks() : rawStream?.getTracks?.() || [];
        rawAudioTracks.forEach((t) => {
          t.enabled = !(isMutedRef.current || isDeafenedRef.current);
        });
        rawStreamRef.current = rawStream;

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          streamRef.current = rawStream;
          setMicStream(rawStream);
          emitVoiceStateRef.current?.({
            is_muted: isMutedRef.current,
            is_deafened: isDeafenedRef.current,
            is_speaking: false,
          });
          return;
        }

        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const gateController = createProcessedVoiceStream(ctx, rawStream, {
          enabled: isNoiseSuppressionRef.current,
        });
        noiseGateRef.current = gateController;

        const outputStream = gateController.stream || rawStream;
        streamRef.current = outputStream;
        setMicStream(outputStream);

        emitVoiceStateRef.current?.({
          is_muted: isMutedRef.current,
          is_deafened: isDeafenedRef.current,
          is_speaking: false,
        });

        let analyser = gateController.analyser;
        if (!analyser && typeof ctx.createMediaStreamSource === 'function' && typeof ctx.createAnalyser === 'function') {
          const source = ctx.createMediaStreamSource(rawStream);
          analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          source.connect(analyser);
        }
        if (!analyser) return;

        const freqData = new Uint8Array(analyser.frequencyBinCount || 256);
        const timeData = typeof Float32Array !== 'undefined' ? new Float32Array(analyser.fftSize || 512) : null;

        const checkVolume = () => {
          if (!active) return;
          const level = computeVoiceSignalLevel(analyser, timeData, freqData);
          const mutedNow = isMutedRef.current;
          const deafNow = isDeafenedRef.current;
          const speaking = gateController.analyser
            ? gateController.updateGateState(level, Date.now(), mutedNow || deafNow)
            : level > 0.08 && !mutedNow && !deafNow;

          setIsSpeaking((prev) => {
            if (prev !== speaking) {
              emitVoiceStateRef.current?.({
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
      if (noiseGateRef.current) {
        noiseGateRef.current.cleanup();
        noiseGateRef.current = null;
      }
      if (rawStreamRef.current) {
        rawStreamRef.current.getTracks?.().forEach((t) => t.stop());
        rawStreamRef.current = null;
      }
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
  }, [channelId]);

  const stopLocalScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks?.().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    emitVoiceStateRef.current?.({
      is_muted: isMutedRef.current,
      is_deafened: isDeafenedRef.current,
      is_screen_sharing: false,
    });
  }, []);

  const handleToggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    addToast?.(next ? 'Microfone desativado' : 'Microfone ativado', 'info');
  }, [isMuted, setIsMuted, addToast]);

  const handleToggleDeafen = useCallback(() => {
    const next = !isDeafened;
    setIsDeafened(next);
    if (next) setIsMuted(true);
    addToast?.(next ? 'Áudio ensurdecido' : 'Áudio restaurado', 'info');
  }, [isDeafened, setIsDeafened, setIsMuted, addToast]);

  const handleToggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      stopLocalScreenShare();
      addToast?.('Compartilhamento de tela finalizado', 'info');
    } else {
      setIsShareModalOpen(true);
    }
  }, [isScreenSharing, stopLocalScreenShare, addToast]);

  const handleConfirmStartScreenShare = useCallback(async ({ captureAudio }) => {
    try {
      if (!navigator?.mediaDevices?.getDisplayMedia) {
        addToast?.('Compartilhamento de tela não suportado neste navegador.', 'error');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: Boolean(captureAudio) });
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);
      emitVoiceStateRef.current?.({
        is_muted: isMutedRef.current,
        is_deafened: isDeafenedRef.current,
        is_screen_sharing: true,
      });
      addToast?.(
        captureAudio
          ? 'Transmissão iniciada com áudio do computador!'
          : 'Transmissão de tela iniciada (sem som do computador)!',
        'success'
      );

      const firstVideo = stream.getVideoTracks?.()[0];
      if (firstVideo) {
        firstVideo.onended = () => {
          screenStreamRef.current = null;
          setScreenStream(null);
          setIsScreenSharing(false);
          emitVoiceStateRef.current?.({
            is_muted: isMutedRef.current,
            is_deafened: isDeafenedRef.current,
            is_screen_sharing: false,
          });
        };
      }
    } catch {}
  }, [addToast]);

  const handleSetVideoRef = useCallback((element) => {
    screenVideoRef.current = element;
    bindLocalVideoElement(element, screenStreamRef.current);
  }, []);

  useEffect(() => {
    if (isScreenSharing) bindLocalVideoElement(screenVideoRef.current, screenStreamRef.current);
  }, [isScreenSharing, screenStream]);

  const handleToggleCamera = useCallback(async () => {
    if (isCameraOn) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks?.().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
      setCameraStream(null);
      setIsCameraOn(false);
      addToast?.('Câmera desligada', 'info');
    } else {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          addToast?.('Câmera não suportada neste navegador.', 'error');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraStreamRef.current = stream;
        setCameraStream(stream);
        setIsCameraOn(true);
        addToast?.('Câmera ligada com sucesso!', 'success');
        const firstVideo = stream.getVideoTracks?.()[0];
        if (firstVideo) {
          firstVideo.onended = () => {
            cameraStreamRef.current = null;
            setCameraStream(null);
            setIsCameraOn(false);
          };
        }
      } catch {
        addToast?.('Permissão de câmera negada ou câmera indisponível.', 'error');
      }
    }
  }, [isCameraOn, addToast]);

  const handleSetCameraVideoRef = useCallback((element) => {
    cameraVideoRef.current = element;
    bindLocalVideoElement(element, cameraStreamRef.current);
  }, []);

  useEffect(() => {
    if (isCameraOn) bindLocalVideoElement(cameraVideoRef.current, cameraStreamRef.current);
  }, [isCameraOn, cameraStream]);

  useEffect(() => {
    return () => {
      screenStreamRef.current?.getTracks?.().forEach((t) => t.stop());
      screenStreamRef.current = null;
      cameraStreamRef.current?.getTracks?.().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    };
  }, []);

  return {
    isSpeaking,
    isScreenSharing,
    isCameraOn,
    isShareModalOpen,
    setIsShareModalOpen,
    micStream,
    screenStream,
    screenStreamRef,
    cameraStream,
    stopLocalScreenShare,
    handleToggleMute,
    handleToggleDeafen,
    handleToggleScreenShare,
    handleConfirmStartScreenShare,
    handleSetVideoRef,
    handleToggleCamera,
    handleSetCameraVideoRef,
  };
}
