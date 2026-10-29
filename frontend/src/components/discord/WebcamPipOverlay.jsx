import React, { useRef, useEffect, useState } from 'react';
import { Move, Video, ArrowDownRight, ArrowDownLeft, ArrowUpRight, ArrowUpLeft } from 'lucide-react';
import { PIP_CORNERS } from './videoCompositeUtils';

export default function WebcamPipOverlay({
  cameraStream,
  pipPosition,
  onPositionChange,
  isRecording = true,
  userName = 'Você',
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Conecta o MediaStream da câmera ao elemento <video>
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      try {
        const p = videoRef.current.play();
        if (p?.catch) p.catch(() => {});
      } catch {}
    }
  }, [cameraStream]);

  // Gerenciamento de Drag & Drop livre pelo mouse
  const handlePointerDown = (e) => {
    // Ignora clique em botões dentro do header
    if (e.target.closest('button')) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    dragOffsetRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    setIsDragging(true);

    const handlePointerMove = (moveEvent) => {
      const containerWidth = 270;
      const containerHeight = 195;
      const maxX = Math.max(0, (window.innerWidth || 1280) - containerWidth - 10);
      const maxY = Math.max(0, (window.innerHeight || 720) - containerHeight - 10);

      const newX = Math.max(10, Math.min(maxX, moveEvent.clientX - dragOffsetRef.current.x));
      const newY = Math.max(10, Math.min(maxY, moveEvent.clientY - dragOffsetRef.current.y));

      if (onPositionChange) {
        onPositionChange({
          corner: PIP_CORNERS.CUSTOM,
          customCoords: { x: newX, y: newY },
        });
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleSelectCorner = (corner) => {
    if (onPositionChange) {
      onPositionChange({
        corner,
        customCoords: null,
      });
    }
  };

  const currentCorner = pipPosition?.corner || PIP_CORNERS.BOTTOM_RIGHT;
  const isCustom = currentCorner === PIP_CORNERS.CUSTOM && pipPosition?.customCoords;

  const inlineStyle = isCustom
    ? {
        left: `${pipPosition.customCoords.x}px`,
        top: `${pipPosition.customCoords.y}px`,
        bottom: 'auto',
        right: 'auto',
      }
    : undefined;

  return (
    <div
      ref={containerRef}
      className={`webcam-pip-container ${!isCustom ? `corner-${currentCorner}` : ''} ${isDragging ? 'is-dragging' : ''}`}
      style={inlineStyle}
      data-testid="webcam-pip-overlay"
      onPointerDown={handlePointerDown}
    >
      {/* Alça superior para arrastar e status */}
      <div className="webcam-pip-header" data-testid="webcam-pip-drag-handle">
        <div className="webcam-pip-title-wrap">
          <Move size={13} />
          <span>Webcam PiP</span>
          <span className="webcam-pip-drag-hint">(Arraste)</span>
        </div>

        {isRecording && (
          <div className="webcam-pip-rec-pill" data-testid="webcam-pip-rec-indicator">
            <span className="webcam-pip-rec-dot" />
            <span>REC WEBCAM</span>
          </div>
        )}
      </div>

      {/* Exibição ao vivo da Webcam */}
      <div className="webcam-pip-video-wrap">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="webcam-pip-video"
          data-testid="webcam-pip-video-preview"
        />
        <div className="webcam-pip-overlay-name">{userName}</div>
      </div>

      {/* Mini toolbar de cantos rápidos */}
      <div className="webcam-pip-toolbar" data-testid="webcam-pip-corners-toolbar">
        <button
          type="button"
          className={`webcam-pip-corner-btn ${currentCorner === PIP_CORNERS.TOP_LEFT ? 'active' : ''}`}
          onClick={() => handleSelectCorner(PIP_CORNERS.TOP_LEFT)}
          title="Canto Superior Esquerdo"
          data-testid="corner-top-left-btn"
        >
          <ArrowUpLeft size={13} />
          <span>Sup. Esq</span>
        </button>

        <button
          type="button"
          className={`webcam-pip-corner-btn ${currentCorner === PIP_CORNERS.TOP_RIGHT ? 'active' : ''}`}
          onClick={() => handleSelectCorner(PIP_CORNERS.TOP_RIGHT)}
          title="Canto Superior Direito"
          data-testid="corner-top-right-btn"
        >
          <ArrowUpRight size={13} />
          <span>Sup. Dir</span>
        </button>

        <button
          type="button"
          className={`webcam-pip-corner-btn ${currentCorner === PIP_CORNERS.BOTTOM_LEFT ? 'active' : ''}`}
          onClick={() => handleSelectCorner(PIP_CORNERS.BOTTOM_LEFT)}
          title="Canto Inferior Esquerdo"
          data-testid="corner-bottom-left-btn"
        >
          <ArrowDownLeft size={13} />
          <span>Inf. Esq</span>
        </button>

        <button
          type="button"
          className={`webcam-pip-corner-btn ${currentCorner === PIP_CORNERS.BOTTOM_RIGHT ? 'active' : ''}`}
          onClick={() => handleSelectCorner(PIP_CORNERS.BOTTOM_RIGHT)}
          title="Canto Inferior Direito (Padrão)"
          data-testid="corner-bottom-right-btn"
        >
          <ArrowDownRight size={13} />
          <span>Inf. Dir</span>
        </button>
      </div>
    </div>
  );
}
