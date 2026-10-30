import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Users, Mic, MicOff, Headphones, PhoneOff, Monitor, Activity, Video, VideoOff } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import VoicePipPlayer from './VoicePipPlayer';
import VoiceChannelRecorder from './VoiceChannelRecorder';
import useLiveKitVoice from './useLiveKitVoice';

export default function VoiceChannelArea({
  channel,
  connectionStatus = 'connected',
  currentUser,
  onlineUsers = [],
  voiceStates = {},
  onSendVoiceState,
  onDisconnectVoice,
  showMembers,
  onToggleMembers,
  isMinimized = false,
  onReturnToVoice,
  token,
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const { isSfuActive } = useLiveKitVoice(channel?.id, token);

  const { addToast } = useToast();
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);
  const screenStreamRef = useRef(null);
  const screenVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraVideoRef = useRef(null);

  // Inicializa microfone local e detector de voz (Web Audio API)
  useEffect(() => {
    let active = true;

    async function initMic() {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) return;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
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
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const speaking = avg > 20 && !isMuted && !isDeafened;

          setIsSpeaking((prev) => {
            if (prev !== speaking && onSendVoiceState) {
              onSendVoiceState({
                is_muted: isMuted,
                is_deafened: isDeafened,
                is_speaking: speaking,
              });
            }
            return speaking;
          });

          animationFrameRef.current = requestAnimationFrame(checkVolume);
        };

        checkVolume();
      } catch {
        // Se permissão for negada, mantém conectado em modo ouvinte
        console.warn('Microfone não acessível ou permissão negada. Entrando como ouvinte.');
      }
    }

    initMic();

    return () => {
      active = false;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [isMuted, isDeafened, onSendVoiceState]);

  // Alternar microfone
  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !next;
      });
    }
    if (onSendVoiceState) {
      onSendVoiceState({
        is_muted: next,
        is_deafened: isDeafened,
        is_speaking: false,
      });
    }
    addToast(next ? 'Microfone desativado' : 'Microfone ativado', 'info');
  };

  // Alternar ensurdecer (deafen)
  const handleToggleDeafen = () => {
    const next = !isDeafened;
    setIsDeafened(next);
    const muteState = next ? true : isMuted;
    if (next) setIsMuted(true);

    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !muteState;
      });
    }
    if (onSendVoiceState) {
      onSendVoiceState({
        is_muted: muteState,
        is_deafened: next,
        is_speaking: false,
      });
    }
    addToast(next ? 'Áudio ensurdecido' : 'Áudio restaurado', 'info');
  };

  // Compartilhamento de tela
  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      addToast('Compartilhamento de tela finalizado', 'info');
    } else {
      try {
        if (!navigator?.mediaDevices?.getDisplayMedia) {
          addToast('Compartilhamento de tela não suportado neste navegador.', 'error');
          return;
        }
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = stream;
        setIsScreenSharing(true);
        addToast('Transmissão de tela iniciada!', 'success');

        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          screenStreamRef.current = null;
        };
      } catch {
        // Cancelado pelo usuário
      }
    }
  };

  // Callback ref para garantir que o elemento <video> receba o MediaStream assim que for montado no DOM
  const handleSetVideoRef = (element) => {
    screenVideoRef.current = element;
    if (element && screenStreamRef.current) {
      element.srcObject = screenStreamRef.current;
      element.onloadedmetadata = () => {
        try {
          const p = element.play?.();
          if (p?.catch) p.catch(() => {});
        } catch {}
      };
      try {
        const p = element.play?.();
        if (p?.catch) p.catch(() => {});
      } catch {}
    }
  };

  // Sincroniza o stream com a tag de vídeo caso o estado mude
  useEffect(() => {
    if (isScreenSharing && screenVideoRef.current && screenStreamRef.current) {
      screenVideoRef.current.srcObject = screenStreamRef.current;
      try {
        const p = screenVideoRef.current.play?.();
        if (p?.catch) p.catch(() => {});
      } catch {}
    }
  }, [isScreenSharing]);

  // Ligar/Desligar Câmera de Vídeo
  const handleToggleCamera = async () => {
    if (isCameraOn) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
      setIsCameraOn(false);
      addToast('Câmera desligada', 'info');
    } else {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          addToast('Câmera não suportada neste navegador.', 'error');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        cameraStreamRef.current = stream;
        setIsCameraOn(true);
        addToast('Câmera ligada com sucesso!', 'success');

        stream.getVideoTracks()[0].onended = () => {
          setIsCameraOn(false);
          cameraStreamRef.current = null;
        };
      } catch (err) {
        addToast('Permissão de câmera negada ou câmera indisponível.', 'error');
      }
    }
  };

  // Callback ref para a tag <video> da câmera
  const handleSetCameraVideoRef = (element) => {
    cameraVideoRef.current = element;
    if (element && cameraStreamRef.current) {
      element.srcObject = cameraStreamRef.current;
      element.onloadedmetadata = () => {
        try {
          const p = element.play?.();
          if (p?.catch) p.catch(() => {});
        } catch {}
      };
      try {
        const p = element.play?.();
        if (p?.catch) p.catch(() => {});
      } catch {}
    }
  };

  // Sincroniza stream da câmera caso mude
  useEffect(() => {
    if (isCameraOn && cameraVideoRef.current && cameraStreamRef.current) {
      cameraVideoRef.current.srcObject = cameraStreamRef.current;
      try {
        const p = cameraVideoRef.current.play?.();
        if (p?.catch) p.catch(() => {});
      } catch {}
    }
  }, [isCameraOn]);

  // Limpeza dos fluxos de tela e câmera ao desmontar
  useEffect(() => {
    return () => {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }
    };
  }, []);

  // Lista consolidada de membros no palco de voz
  const participants = onlineUsers.length > 0
    ? onlineUsers
    : [{ user_id: currentUser?.id || 1, user_name: currentUser?.name || 'Você' }];

  // Se estiver em modo Picture-in-Picture (navegando em texto com voz conectada em background)
  if (isMinimized) {
    return (
      <VoicePipPlayer
        channel={channel}
        currentUser={currentUser}
        isMuted={isMuted}
        isSpeaking={isSpeaking}
        isCameraOn={isCameraOn}
        isScreenSharing={isScreenSharing}
        onToggleMute={handleToggleMute}
        onToggleCamera={handleToggleCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onDisconnectVoice={onDisconnectVoice}
        onReturnToVoice={onReturnToVoice}
        onSetVideoRef={handleSetVideoRef}
        onSetCameraVideoRef={handleSetCameraVideoRef}
      />
    );
  }

  return (
    <section className="discord-chat-area voice-channel-area" aria-label={`Canal de Voz 🔊 ${channel.name}`}>
      {/* Cabeçalho da Sala de Voz */}
      <div className="chat-header">
        <div className="chat-header-title">
          <Volume2 size={20} color="#5865f2" />
          <span>{channel.name}</span>
          <span className="chat-header-desc">Canal de Voz & Transmissão</span>
        </div>

        <div className="chat-header-actions">
          {/* Status de Conexão RTC */}
          <div
            className={`connection-pill pill-${connectionStatus}`}
            data-testid="voice-connection-status-pill"
          >
            <span className="status-indicator-dot" />
            <span className="status-indicator-text">
              {connectionStatus === 'connected' ? (isSfuActive ? 'Voz Conectada (RTC SFU)' : 'Voz Conectada (RTC)') : 'Conectando à Voz...'}
            </span>
          </div>

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

      {/* Palco Central de Voz (Grid de Participantes) */}
      <div className="voice-stage-container" data-testid="voice-stage-container">
        {/* Janela de Compartilhamento de Tela se ativo */}
        {isScreenSharing && (
          <div className="voice-screen-share-box" data-testid="screen-share-preview">
            <video
              ref={handleSetVideoRef}
              autoPlay
              playsInline
              muted
              className="voice-screen-video"
              data-testid="screen-share-video"
            />
            <div className="voice-screen-label">
              <Activity size={14} />
              <span>Transmissão ao vivo de {currentUser?.name || 'Você'}</span>
            </div>
          </div>
        )}

        <div className="voice-participants-grid">
          {participants.map((p) => {
            const isMe = p.user_id === currentUser?.id;
            const state = voiceStates[p.user_id] || {};
            const speaking = isMe ? isSpeaking : state.is_speaking;
            const muted = isMe ? isMuted : state.is_muted;
            const deaf = isMe ? isDeafened : state.is_deafened;
            const initial = (p.user_name || 'U').charAt(0).toUpperCase();

            return (
              <div
                key={p.user_id}
                className={`voice-participant-tile ${speaking ? 'speaking' : ''}`}
                data-testid={`voice-user-tile-${p.user_id}`}
              >
                {isMe && isCameraOn ? (
                  <div className="voice-camera-tile-wrapper" data-testid="user-camera-preview">
                    <video
                      ref={handleSetCameraVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="voice-camera-video"
                      data-testid="user-camera-video"
                    />
                    <div className="voice-camera-name-tag">
                      <span>{p.user_name} (Você)</span>
                      {speaking && <span className="speaking-tag-dot" />}
                    </div>
                  </div>
                ) : (
                  <div className={`voice-avatar-circle ${speaking ? 'speaking-halo' : ''}`}>
                    <span>{initial}</span>
                    {speaking && <div className="speaking-pulse-ring" />}
                  </div>
                )}

                <div className="voice-participant-name-row">
                  <span className="voice-participant-name">
                    {p.user_name} {isMe ? '(Você)' : ''}
                  </span>
                  <div className="voice-status-icons">
                    {muted && <MicOff size={14} className="voice-icon-muted" title="Mutado" />}
                    {deaf && <Headphones size={14} className="voice-icon-deaf" title="Ensurdecido" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {participants.length === 1 && (
          <div className="voice-empty-hint">
            <Volume2 size={28} className="voice-empty-icon" />
            <h3>Você está conectado na sala de voz #{channel.name}</h3>
            <p>Aguardando outros amigos ou membros da comunidade entrarem para conversar.</p>
          </div>
        )}
      </div>

      {/* Dock Flutuante de Controles de Voz */}
      <div className="voice-control-dock" data-testid="voice-control-dock">
        <button
          type="button"
          className={`voice-dock-btn ${isMuted ? 'btn-active-red' : ''}`}
          onClick={handleToggleMute}
          title={isMuted ? 'Ativar Microfone' : 'Desativar Microfone'}
          data-testid="voice-toggle-mute-btn"
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>

        <button
          type="button"
          className={`voice-dock-btn ${isDeafened ? 'btn-active-red' : ''}`}
          onClick={handleToggleDeafen}
          title={isDeafened ? 'Restaurar Áudio' : 'Ensurdecer'}
          data-testid="voice-toggle-deafen-btn"
        >
          <Headphones size={20} />
        </button>

        <button
          type="button"
          className={`voice-dock-btn ${isCameraOn ? 'btn-active-green' : ''}`}
          onClick={handleToggleCamera}
          title={isCameraOn ? 'Desligar Câmera' : 'Ligar Câmera'}
          data-testid="voice-toggle-camera-btn"
        >
          {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        <button
          type="button"
          className={`voice-dock-btn ${isScreenSharing ? 'btn-active-green' : ''}`}
          onClick={handleToggleScreenShare}
          title={isScreenSharing ? 'Parar Transmissão' : 'Compartilhar Tela'}
          data-testid="voice-toggle-screen-btn"
        >
          <Monitor size={20} />
        </button>

        <VoiceChannelRecorder
          channel={channel}
          audioStream={streamRef.current}
          screenStream={screenStreamRef.current}
          cameraStream={cameraStreamRef.current}
          isCameraOn={isCameraOn}
          currentUserName={currentUser?.name || 'Você'}
        />

        <button
          type="button"
          className="voice-dock-btn btn-disconnect"
          onClick={onDisconnectVoice}
          title="Desconectar da Sala de Voz"
          data-testid="voice-disconnect-btn"
        >
          <PhoneOff size={20} />
          <span>Desconectar</span>
        </button>
      </div>
    </section>
  );
}
