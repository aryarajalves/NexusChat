import React from 'react';
import {
  Volume2,
  Mic,
  MicOff,
  PhoneOff,
  Monitor,
  Maximize2,
  Video,
  VideoOff,
} from 'lucide-react';

export default function VoicePipPlayer({
  channel,
  currentUser,
  isMuted,
  isSpeaking,
  isCameraOn,
  isScreenSharing,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onDisconnectVoice,
  onReturnToVoice,
  onSetVideoRef,
  onSetCameraVideoRef,
}) {
  return (
    <div className="voice-pip-floating-box" data-testid="voice-pip-container">
      {/* Cabeçalho do Mini-Player PiP */}
      <div className="voice-pip-header">
        <div
          className="voice-pip-title"
          onClick={onReturnToVoice}
          title="Clique para voltar para o canal de voz"
          data-testid="voice-pip-title-btn"
        >
          <Volume2 size={15} color="#57f287" />
          <span>#{channel?.name}</span>
          <span className="voice-pip-status-dot" />
        </div>
        <button
          type="button"
          className="voice-pip-action-btn"
          onClick={onReturnToVoice}
          title="Expandir tela cheia"
          data-testid="voice-pip-expand-btn"
        >
          <Maximize2 size={15} />
        </button>
      </div>

      {/* Visualização de Vídeo ou Avatar em PiP */}
      <div
        className="voice-pip-body"
        onClick={onReturnToVoice}
        title="Clique para voltar ao canal de voz"
        data-testid="voice-pip-body"
      >
        {isScreenSharing ? (
          <video
            ref={onSetVideoRef}
            autoPlay
            playsInline
            muted
            className="voice-pip-video"
            data-testid="voice-pip-screen-video"
          />
        ) : isCameraOn ? (
          <video
            ref={onSetCameraVideoRef}
            autoPlay
            playsInline
            muted
            className="voice-pip-video"
            data-testid="voice-pip-camera-video"
          />
        ) : (
          <div className="voice-pip-avatar-view">
            <div className={`voice-avatar-circle small ${isSpeaking ? 'speaking-halo' : ''}`}>
              {(currentUser?.name || 'U').charAt(0).toUpperCase()}
            </div>
            <span className="voice-pip-speaking-hint">
              {isSpeaking ? 'Você está falando...' : `${currentUser?.name || 'Você'} conectado`}
            </span>
          </div>
        )}
      </div>

      {/* Ações Rápidas no Rodapé do PiP */}
      <div className="voice-pip-footer">
        <button
          type="button"
          className={`voice-pip-btn ${isMuted ? 'btn-active-red' : ''}`}
          onClick={onToggleMute}
          title={isMuted ? 'Ativar Microfone' : 'Silenciar'}
          data-testid="voice-pip-mute-btn"
        >
          {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
        </button>

        <button
          type="button"
          className={`voice-pip-btn ${isCameraOn ? 'btn-active-green' : ''}`}
          onClick={onToggleCamera}
          title={isCameraOn ? 'Desligar Câmera' : 'Ligar Câmera'}
          data-testid="voice-pip-camera-btn"
        >
          {isCameraOn ? <Video size={14} /> : <VideoOff size={14} />}
        </button>

        <button
          type="button"
          className={`voice-pip-btn ${isScreenSharing ? 'btn-active-green' : ''}`}
          onClick={onToggleScreenShare}
          title={isScreenSharing ? 'Parar Transmissão' : 'Compartilhar Tela'}
          data-testid="voice-pip-screen-btn"
        >
          <Monitor size={14} />
        </button>

        <button
          type="button"
          className="voice-pip-btn btn-disconnect"
          onClick={onDisconnectVoice}
          title="Desconectar da Sala"
          data-testid="voice-pip-disconnect-btn"
        >
          <PhoneOff size={14} />
        </button>
      </div>
    </div>
  );
}
