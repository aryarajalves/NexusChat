import React, { useState } from 'react';
import { Mic, MicOff, Headphones, Video, VideoOff, Monitor, Sparkles, PhoneOff, Pen, PictureInPicture2 } from 'lucide-react';
import VoiceChannelRecorder from './VoiceChannelRecorder';

export default function VoiceControlDock({
  isMuted,
  onToggleMute,
  isDeafened,
  onToggleDeafen,
  isCameraOn,
  onToggleCamera,
  isScreenSharing,
  onToggleScreenShare,
  cameraBlurMode,
  onChangeCameraBlurMode,
  channel,
  mixedCallAudio,
  activeRecordingScreen,
  cameraStream,
  micStream,
  currentUser,
  onDisconnectVoice,
  getAnnotationCanvas,
  hasActiveScreenShare = false,
  isAnnotationActive = false,
  onToggleAnnotation,
  isDocumentPipOpen = false,
  onToggleDocumentPip,
}) {
  const [showDockEffects, setShowDockEffects] = useState(false);

  return (
    <div className="voice-control-dock" data-testid="voice-control-dock">
      <button
        type="button"
        className={`voice-dock-btn ${isMuted ? 'btn-active-red' : ''}`}
        onClick={onToggleMute}
        title={isMuted ? 'Ativar Microfone' : 'Desativar Microfone'}
        data-testid="voice-toggle-mute-btn"
      >
        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
      </button>

      <button
        type="button"
        className={`voice-dock-btn ${isDeafened ? 'btn-active-red' : ''}`}
        onClick={onToggleDeafen}
        title={isDeafened ? 'Restaurar Áudio' : 'Ensurdecer'}
        data-testid="voice-toggle-deafen-btn"
      >
        <Headphones size={20} />
      </button>

      <button
        type="button"
        className={`voice-dock-btn ${isCameraOn ? 'btn-active-green' : ''}`}
        onClick={onToggleCamera}
        title={isCameraOn ? 'Desligar Câmera' : 'Ligar Câmera'}
        data-testid="voice-toggle-camera-btn"
      >
        {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
      </button>

      {isCameraOn && (
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className={`voice-dock-btn ${cameraBlurMode !== 'none' ? 'btn-active-blue' : ''}`}
            onClick={() => setShowDockEffects((p) => !p)}
            title="Efeitos de Câmera (Desfoque de Fundo)"
            data-testid="voice-toggle-camera-effects-btn"
          >
            <Sparkles size={18} />
          </button>
          {showDockEffects && (
            <div className="camera-effects-popover" data-testid="camera-effects-dock-popover">
              <div className="camera-effects-popover-header">
                <Sparkles size={13} color="#5865f2" /> Desfoque de Fundo
              </div>
              <button
                type="button"
                className={`camera-effect-option-btn ${cameraBlurMode === 'none' ? 'active' : ''}`}
                onClick={() => { onChangeCameraBlurMode?.('none'); setShowDockEffects(false); }}
                data-testid="dock-effect-option-none"
              >
                <span>Desativado (Normal)</span>
                {cameraBlurMode === 'none' && <span className="camera-effect-badge-indicator">Ativo</span>}
              </button>
              <button
                type="button"
                className={`camera-effect-option-btn ${cameraBlurMode === 'light' ? 'active' : ''}`}
                onClick={() => { onChangeCameraBlurMode?.('light'); setShowDockEffects(false); }}
                data-testid="dock-effect-option-light"
              >
                <span>Desfoque Leve (Foco Suave)</span>
                {cameraBlurMode === 'light' && <span className="camera-effect-badge-indicator">Ativo</span>}
              </button>
              <button
                type="button"
                className={`camera-effect-option-btn ${cameraBlurMode === 'intense' ? 'active' : ''}`}
                onClick={() => { onChangeCameraBlurMode?.('intense'); setShowDockEffects(false); }}
                data-testid="dock-effect-option-intense"
              >
                <span>Desfoque Intenso (Modo Retrato)</span>
                {cameraBlurMode === 'intense' && <span className="camera-effect-badge-indicator">Ativo</span>}
              </button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className={`voice-dock-btn ${isScreenSharing ? 'btn-active-green' : ''}`}
        onClick={onToggleScreenShare}
        title={isScreenSharing ? 'Parar Transmissão' : 'Compartilhar Tela'}
        data-testid="voice-toggle-screen-btn"
      >
        <Monitor size={20} />
      </button>

      {/* Botão de Riscar Tela (Caneta) visível durante qualquer compartilhamento */}
      {(isScreenSharing || hasActiveScreenShare) && (
        <>
          <button
            type="button"
            className={`voice-dock-btn ${isAnnotationActive ? 'btn-active-blue' : ''}`}
            onClick={onToggleAnnotation}
            title={isAnnotationActive ? 'Ocultar Ferramentas de Desenho' : 'Riscar Tela (Caneta)'}
            data-testid="voice-toggle-annotation-dock-btn"
          >
            <Pen size={20} />
          </button>

          <button
            type="button"
            className={`voice-dock-btn ${isDocumentPipOpen ? 'btn-active-blue' : ''}`}
            onClick={onToggleDocumentPip}
            title={isDocumentPipOpen ? 'Fechar Janela Flutuante Always-on-Top' : 'Janela Flutuante Always-on-Top (Riscar enquanto usa Google/outros apps)'}
            data-testid="voice-toggle-document-pip-btn"
          >
            <PictureInPicture2 size={20} />
          </button>
        </>
      )}

      <VoiceChannelRecorder
        channel={channel}
        audioStream={mixedCallAudio}
        micStream={micStream}
        screenStream={activeRecordingScreen}
        cameraStream={cameraStream}
        isCameraOn={isCameraOn}
        currentUserName={currentUser?.name || 'Você'}
        getAnnotationCanvas={getAnnotationCanvas}
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
  );
}
