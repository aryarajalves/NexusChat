import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  Mic,
  MicOff,
  Headphones,
  PhoneOff,
  Activity,
  Layers,
  Monitor,
} from 'lucide-react';
import ScreenAnnotationOverlay from './ScreenAnnotationOverlay';

export default function DocumentPipAnnotationWindow({
  isOpen,
  onClose,
  channel,
  currentUser,
  stream,
  isPresenter = true,
  isCollaborative = false,
  onToggleCollaborative,
  onSendDraw,
  incomingDrawEvent,
  onRegisterAnnotationCanvas,
  isMuted,
  onToggleMute,
  isDeafened,
  onToggleDeafen,
  onDisconnectVoice,
}) {
  const [pipContainer, setPipContainer] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const pipWindowRef = useRef(null);
  const videoRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Gerencia o ciclo de vida do Document Picture-in-Picture
  useEffect(() => {
    let isCancelled = false;

    async function openPipWindow() {
      if (!isOpen) return;

      const hasDocPip = typeof window !== 'undefined' && 'documentPictureInPicture' in window;

      if (!hasDocPip) {
        setIsSupported(false);
        return;
      }

      try {
        if (pipWindowRef.current && !pipWindowRef.current.closed) {
          pipWindowRef.current.focus?.();
          return;
        }

        const win = await window.documentPictureInPicture.requestWindow({
          width: 580,
          height: 440,
        });

        if (isCancelled) {
          try { win.close(); } catch {}
          return;
        }

        pipWindowRef.current = win;
        const doc = win.document;

        // Garante que <head> existe
        if (!doc.head) {
          const h = doc.createElement('head');
          doc.documentElement.prepend(h);
        }

        // Clona todos os estilos do documento principal
        document.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
          try {
            doc.head.appendChild(el.cloneNode(true));
          } catch (_) {}
        });

        doc.documentElement.style.height = '100%';
        doc.documentElement.style.margin = '0';
        doc.documentElement.style.padding = '0';
        doc.body.style.height = '100%';
        doc.body.style.margin = '0';
        doc.body.style.padding = '0';
        doc.body.style.background = '#111214';
        doc.body.style.overflow = 'hidden';
        doc.title = `NexusChat - ${channel?.name || 'Sala de Voz'} (Always-on-Top)`;

        // Cria o contêiner raiz onde o React Portal será montado
        let container = doc.getElementById('document-pip-root');
        if (!container) {
          container = doc.createElement('div');
          container.id = 'document-pip-root';
          container.style.width = '100%';
          container.style.height = '100%';
          container.style.display = 'flex';
          container.style.flexDirection = 'column';
          doc.body.appendChild(container);
        }

        setPipContainer(container);

        win.addEventListener('pagehide', () => {
          pipWindowRef.current = null;
          setPipContainer(null);
          onCloseRef.current?.();
        });
      } catch (err) {
        console.warn('[DocumentPiP] Falha ao abrir janela flutuante:', err);
        setIsSupported(false);
      }
    }

    if (isOpen) {
      openPipWindow();
    } else {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        try { pipWindowRef.current.close(); } catch {}
      }
      pipWindowRef.current = null;
      setPipContainer(null);
    }

    return () => {
      isCancelled = true;
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        try { pipWindowRef.current.close(); } catch {}
      }
    };
  }, [isOpen]);

  // Vincula o stream de transmissão ao elemento de vídeo
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      const safePlay = () => {
        try {
          const p = video.play?.();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch {}
      };
      video.onloadedmetadata = safePlay;
      safePlay();
    } else {
      video.srcObject = null;
    }
  }, [stream, pipContainer]);

  if (!isOpen) return null;

  const content = (
    <div className="document-pip-wrapper" data-testid="document-pip-wrapper">
      {/* Cabeçalho */}
      <div className="document-pip-header" data-testid="document-pip-header">
        <div className="document-pip-title-row">
          <Activity size={14} color="#5865f2" />
          <span>#{channel?.name || 'Sala de Voz'}</span>
          <span className="document-pip-live-badge">
            <span className="document-pip-live-dot" /> Always-on-Top
          </span>
        </div>

        <button
          type="button"
          className="document-pip-close-btn"
          onClick={() => {
            if (pipWindowRef.current && !pipWindowRef.current.closed) {
              try { pipWindowRef.current.close(); } catch {}
            }
            onCloseRef.current?.();
          }}
          title="Fechar Janela Flutuante"
          data-testid="close-document-pip-btn"
        >
          <X size={16} />
        </button>
      </div>

      {!isSupported && (
        <div className="document-pip-fallback-banner">
          <Layers size={13} />
          <span>Janela Always-on-Top nativa ativada em navegadores compatíveis (Chrome 111+).</span>
        </div>
      )}

      {/* Conteúdo: Vídeo + Overlay de Desenho ou Mensagem de Espera */}
      <div className="document-pip-content" data-testid="document-pip-content">
        {stream ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="document-pip-video"
              data-testid="document-pip-video"
            />

            <ScreenAnnotationOverlay
              isScreenSharing={true}
              isPresenter={isPresenter}
              currentUserId={currentUser?.id}
              currentUserName={currentUser?.name || 'Você'}
              isCollaborative={isCollaborative}
              onToggleCollaborative={onToggleCollaborative}
              onSendDraw={onSendDraw}
              incomingDrawEvent={incomingDrawEvent}
              onRegisterAnnotationCanvas={onRegisterAnnotationCanvas}
              isAnnotationActive={true}
            />
          </>
        ) : (
          <div className="document-pip-no-stream" data-testid="document-pip-no-stream">
            <Monitor size={36} color="#5865f2" />
            <h4>Compartilhe a sua tela no NexusChat</h4>
            <p>Assim que você compartilhar a tela, ela aparecerá aqui para você riscar sobre o Google e outros programas.</p>
          </div>
        )}
      </div>

      {/* Barra Inferior com Controles Rápidos */}
      <div className="document-pip-footer" data-testid="document-pip-footer">
        <span className="document-pip-hint">
          {stream ? 'Risque sobre a tela para apontar detalhes' : 'Aguardando transmissão de tela'}
        </span>

        <div className="document-pip-controls">
          {onToggleMute && (
            <button
              type="button"
              className={`document-pip-btn ${isMuted ? 'btn-active-red' : ''}`}
              onClick={onToggleMute}
              title={isMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
              data-testid="pip-toggle-mute-btn"
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}

          {onToggleDeafen && (
            <button
              type="button"
              className={`document-pip-btn ${isDeafened ? 'btn-active-red' : ''}`}
              onClick={onToggleDeafen}
              title={isDeafened ? 'Restaurar Áudio' : 'Ensurdecer'}
              data-testid="pip-toggle-deafen-btn"
            >
              <Headphones size={16} />
            </button>
          )}

          {onDisconnectVoice && (
            <button
              type="button"
              className="document-pip-btn btn-red"
              onClick={onDisconnectVoice}
              title="Desconectar da Chamada"
              data-testid="pip-disconnect-btn"
            >
              <PhoneOff size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (pipContainer) {
    return ReactDOM.createPortal(content, pipContainer);
  }

  // Fallback quando executado sem suporte a Document PiP (ou em testes)
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 480,
        height: 360,
        zIndex: 99999,
        boxShadow: '0 12px 36px rgba(0,0,0,0.85)',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid rgba(88, 101, 242, 0.6)',
      }}
      data-testid="document-pip-fallback-container"
    >
      {content}
    </div>
  );
}
