import React, { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  Mic,
  MicOff,
  PhoneOff,
  Monitor,
  Maximize2,
  Video,
  VideoOff,
  GripHorizontal,
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
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('discord_pip_pos');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialLeft: 0, initialTop: 0 });
  const hasDraggedRef = useRef(false);

  // Início do arrasto (mouse ou touch)
  const handleStartDrag = (clientX, clientY) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
    };
    hasDraggedRef.current = false;
    setIsDragging(true);
  };

  const handleMouseDown = (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    handleStartDrag(e.clientX, e.clientY);
  };

  const handleTouchStart = (e) => {
    if (e.target.closest('button')) return;
    const touch = e.touches[0];
    if (touch) handleStartDrag(touch.clientX, touch.clientY);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      handleMoveDrag(e.clientX, e.clientY);
    };

    const handleTouchMove = (e) => {
      const touch = e.touches[0];
      if (touch) handleMoveDrag(touch.clientX, touch.clientY);
    };

    const handleMoveDrag = (clientX, clientY) => {
      const deltaX = clientX - dragStartRef.current.startX;
      const deltaY = clientY - dragStartRef.current.startY;

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        hasDraggedRef.current = true;
      }

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const maxX = Math.max(0, window.innerWidth - rect.width);
      const maxY = Math.max(0, window.innerHeight - rect.height);

      let newLeft = dragStartRef.current.initialLeft + deltaX;
      let newTop = dragStartRef.current.initialTop + deltaY;

      newLeft = Math.max(10, Math.min(newLeft, maxX - 10));
      newTop = Math.max(10, Math.min(newTop, maxY - 10));

      setPosition({ x: newLeft, y: newTop });
    };

    const handleEndDrag = () => {
      setIsDragging(false);
      if (hasDraggedRef.current) {
        setPosition((current) => {
          if (current) {
            try {
              localStorage.setItem('discord_pip_pos', JSON.stringify(current));
            } catch (_) {}
          }
          return current;
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEndDrag);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleEndDrag);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEndDrag);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEndDrag);
    };
  }, [isDragging]);

  const handleHeaderTitleClick = (e) => {
    if (hasDraggedRef.current) {
      e.stopPropagation();
      return;
    }
    onReturnToVoice?.();
  };

  const containerStyle = position
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
        bottom: 'auto',
        right: 'auto',
      }
    : {};

  return (
    <div
      ref={containerRef}
      className={`voice-pip-floating-box ${isDragging ? 'is-dragging' : ''}`}
      style={containerStyle}
      data-testid="voice-pip-container"
    >
      {/* Cabeçalho arrastável do Mini-Player PiP */}
      <div
        className="voice-pip-header"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        data-testid="voice-pip-drag-handle"
        title="Clique e arraste para mover na tela"
      >
        <div
          className="voice-pip-title"
          onClick={handleHeaderTitleClick}
          title="Clique para voltar para o canal de voz"
          data-testid="voice-pip-title-btn"
        >
          <GripHorizontal size={14} className="voice-pip-grip-icon" />
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
        onClick={() => {
          if (!hasDraggedRef.current) onReturnToVoice?.();
        }}
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
