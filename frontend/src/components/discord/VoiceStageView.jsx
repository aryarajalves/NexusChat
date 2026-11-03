import React, { useState, useRef, useEffect } from 'react';
import { Volume2, MicOff, Headphones, Activity, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { RemoteVideoView } from './RemoteMediaPlayers';
import { getSelfieSegmentation, renderMeetBlurFrame } from './meetBackgroundBlur';

export default function VoiceStageView({
  channel,
  currentUser,
  participants,
  mergedVoiceStates = {},
  remotePeersMedia = {},
  isSpeaking,
  isMuted,
  isDeafened,
  isCameraOn,
  isScreenSharing,
  cameraBlurMode = 'none',
  onChangeCameraBlurMode,
  onSetVideoRef,
  onSetCameraVideoRef,
}) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [showEffectsPopover, setShowEffectsPopover] = useState(false);
  const localScreenBoxRef = useRef(null);
  const remoteScreenBoxRef = useRef(null);
  const meetCanvasRef = useRef(null);
  const localVideoElementRef = useRef(null);

  const handleCameraVideoRef = (el) => {
    localVideoElementRef.current = el;
    if (typeof onSetCameraVideoRef === 'function') {
      onSetCameraVideoRef(el);
    }
  };

  useEffect(() => {
    if (cameraBlurMode === 'none' || !isCameraOn) return;
    let isMounted = true;
    let animId = null;
    let isProcessing = false;

    async function initMeetBlur() {
      try {
        const segmenter = await getSelfieSegmentation();
        if (!isMounted || !segmenter) return;

        segmenter.onResults((results) => {
          if (!isMounted || !meetCanvasRef.current) return;
          const canvas = meetCanvasRef.current;
          if (canvas.width !== results.image.width && results.image.width > 0) {
            canvas.width = results.image.width;
            canvas.height = results.image.height;
          }
          renderMeetBlurFrame(canvas, results.image, results.segmentationMask, cameraBlurMode);
        });

        const loop = async () => {
          if (!isMounted) return;
          const video = localVideoElementRef.current;
          if (video && video.readyState >= 2 && !video.paused && !video.ended && !isProcessing) {
            isProcessing = true;
            try {
              await segmenter.send({ image: video });
            } catch {
              // Frame individual ignorado com segurança
            } finally {
              isProcessing = false;
            }
          }
          animId = requestAnimationFrame(loop);
        };
        animId = requestAnimationFrame(loop);
      } catch (err) {
        console.warn('[MeetBlur] Fallback visual ativo:', err);
      }
    }

    initMeetBlur();
    return () => {
      isMounted = false;
      if (animId) cancelAnimationFrame(animId);
    };
  }, [cameraBlurMode, isCameraOn]);

  const remoteScreenShares = Object.entries(remotePeersMedia || {})
    .filter(([_, peer]) => Boolean(peer?.screenStream))
    .map(([uid, peer]) => ({ ...peer, userId: peer?.userId || uid }));
  // Apenas uma transmissão é exibida no palco por vez (a mais recente ativa)
  const activeRemoteScreenPeer = !isScreenSharing && remoteScreenShares.length > 0
    ? remoteScreenShares[remoteScreenShares.length - 1]
    : null;
  const hasActiveScreenShare = Boolean(isScreenSharing || activeRemoteScreenPeer);
  const isMyOwnScreen = Boolean(
    isScreenSharing ||
    (activeRemoteScreenPeer && Number(activeRemoteScreenPeer.userId) === Number(currentUser?.id))
  );

  const toggleMaximize = async () => {
    const nextMax = !isMaximized;
    setIsMaximized(nextMax);

    const targetEl = isScreenSharing ? localScreenBoxRef.current : remoteScreenBoxRef.current;
    if (nextMax) {
      if (targetEl && typeof targetEl.requestFullscreen === 'function' && !document.fullscreenElement) {
        try {
          await targetEl.requestFullscreen();
        } catch (_) {
          // Mantém maximizado via CSS viewport fixed
        }
      }
    } else {
      if (typeof document !== 'undefined' && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        try {
          await document.exitFullscreen();
        } catch (_) {}
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsMaximized(Boolean(document.fullscreenElement));
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMaximized) {
        setIsMaximized(false);
        if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
          document.exitFullscreen().catch(() => {});
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isMaximized]);

  const renderScreenShares = (isSpotlight = false) => (
    <div className={`voice-screen-shares-row ${isSpotlight ? 'spotlight-mode' : ''}`}>
      {isScreenSharing && (
        <div
          ref={localScreenBoxRef}
          className="voice-screen-share-box local-stream"
          data-testid="screen-share-preview"
        >
          <video
            ref={onSetVideoRef}
            autoPlay
            playsInline
            muted
            className="voice-screen-video"
            data-testid="screen-share-video"
          />
          <div className="voice-screen-label">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={14} />
              <span>Transmissão ao vivo de {currentUser?.name || 'Você'}</span>
            </div>
          </div>
        </div>
      )}

      {activeRemoteScreenPeer && (
        <div
          ref={remoteScreenBoxRef}
          key={`screen-${activeRemoteScreenPeer.userId}`}
          className={`voice-screen-share-box ${isMaximized ? 'is-maximized' : ''}`}
          data-testid={`remote-screen-share-${activeRemoteScreenPeer.userId}`}
          onDoubleClick={isMyOwnScreen ? undefined : toggleMaximize}
          title={isMyOwnScreen ? 'Sua própria transmissão ao vivo' : 'Clique duas vezes para maximizar/restaurar'}
        >
          <RemoteVideoView
            stream={activeRemoteScreenPeer.screenStream}
            muted
            className="voice-screen-video"
            testId={`remote-screen-video-${activeRemoteScreenPeer.userId}`}
          />
          {!isMyOwnScreen && (
            <button
              type="button"
              className="voice-screen-maximize-btn"
              onClick={(e) => { e.stopPropagation(); toggleMaximize(); }}
              title={isMaximized ? 'Restaurar tamanho' : 'Maximizar tela'}
              data-testid="voice-screen-maximize-btn"
            >
              {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span className="voice-screen-maximize-text">{isMaximized ? 'Restaurar' : 'Maximizar'}</span>
            </button>
          )}
          <div className="voice-screen-label">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={14} />
              <span>Transmissão ao vivo de {isMyOwnScreen ? `${currentUser?.name || 'Você'} (Você)` : (activeRemoteScreenPeer.userName || 'Membro')}</span>
            </div>
            {!isMyOwnScreen && (
              <button
                type="button"
                className="voice-screen-badge-max-btn"
                onClick={(e) => { e.stopPropagation(); toggleMaximize(); }}
                title={isMaximized ? 'Restaurar tamanho' : 'Maximizar tela'}
                data-testid="voice-screen-badge-max-btn"
              >
                {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                <span>{isMaximized ? 'Restaurar' : 'Maximizar'}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderParticipantsGrid = (isFilmstrip = false) => (
    <div
      className={`voice-participants-grid ${isFilmstrip ? 'filmstrip-mode' : ''}`}
      data-testid={isFilmstrip ? 'voice-participants-filmstrip' : 'voice-participants-grid'}
    >
      {participants.map((p) => {
        const isMe = Number(p.user_id) === Number(currentUser?.id);
        const state = mergedVoiceStates[p.user_id] || {};
        const speaking = isMe ? isSpeaking : state.is_speaking;
        const muted = isMe ? isMuted : state.is_muted;
        const deaf = isMe ? isDeafened : state.is_deafened;
        const initial = (p.user_name || 'U').charAt(0).toUpperCase();
        const remoteCameraStream = !isMe ? remotePeersMedia?.[p.user_id]?.cameraStream : null;
        const remoteEffect = !isMe ? remotePeersMedia?.[p.user_id]?.cameraEffect || 'none' : 'none';
        const hasCamera = Boolean((isMe && isCameraOn) || (!isMe && remoteCameraStream));

        return (
          <div
            key={p.user_id}
            className={`voice-participant-tile ${speaking ? 'speaking' : ''} ${hasCamera ? 'has-camera' : ''}`}
            data-testid={`voice-user-tile-${p.user_id}`}
          >
            {isMe && isCameraOn ? (
              <div
                className={`voice-camera-tile-wrapper ${cameraBlurMode !== 'none' ? `camera-blur-${cameraBlurMode}` : ''}`}
                data-testid="user-camera-preview"
              >
                <video
                  ref={handleCameraVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="voice-camera-video"
                  data-testid="user-camera-video"
                />
                {cameraBlurMode !== 'none' && (
                  <canvas
                    ref={meetCanvasRef}
                    className="voice-camera-meet-canvas"
                    data-testid="user-camera-meet-canvas"
                  />
                )}
                {cameraBlurMode !== 'none' && (
                  <div
                    className={`camera-portrait-bloom-overlay ${cameraBlurMode}`}
                    data-testid={`camera-bloom-overlay-${cameraBlurMode}`}
                  />
                )}
                {onChangeCameraBlurMode && (
                  <button
                    type="button"
                    className={`camera-effect-tile-btn ${cameraBlurMode !== 'none' ? 'active' : ''}`}
                    onClick={() => setShowEffectsPopover((prev) => !prev)}
                    title="Ajustar desfoque de fundo / foco no rosto"
                    data-testid="camera-effects-tile-btn"
                  >
                    <Sparkles size={12} />
                    <span>{cameraBlurMode === 'none' ? 'Desfoque' : cameraBlurMode === 'light' ? 'Leve' : 'Intenso'}</span>
                  </button>
                )}
                {showEffectsPopover && onChangeCameraBlurMode && (
                  <div className="camera-effects-popover" data-testid="camera-effects-tile-popover">
                    <div className="camera-effects-popover-header">
                      <Sparkles size={13} color="#5865f2" /> Efeitos de Fundo
                    </div>
                    <button
                      type="button"
                      className={`camera-effect-option-btn ${cameraBlurMode === 'none' ? 'active' : ''}`}
                      onClick={() => { onChangeCameraBlurMode('none'); setShowEffectsPopover(false); }}
                      data-testid="tile-effect-option-none"
                    >
                      <span>Desativado (Normal)</span>
                      {cameraBlurMode === 'none' && <span className="camera-effect-badge-indicator">Ativo</span>}
                    </button>
                    <button
                      type="button"
                      className={`camera-effect-option-btn ${cameraBlurMode === 'light' ? 'active' : ''}`}
                      onClick={() => { onChangeCameraBlurMode('light'); setShowEffectsPopover(false); }}
                      data-testid="tile-effect-option-light"
                    >
                      <span>Desfoque Leve (Foco Suave)</span>
                      {cameraBlurMode === 'light' && <span className="camera-effect-badge-indicator">Ativo</span>}
                    </button>
                    <button
                      type="button"
                      className={`camera-effect-option-btn ${cameraBlurMode === 'intense' ? 'active' : ''}`}
                      onClick={() => { onChangeCameraBlurMode('intense'); setShowEffectsPopover(false); }}
                      data-testid="tile-effect-option-intense"
                    >
                      <span>Desfoque Intenso (Modo Retrato)</span>
                      {cameraBlurMode === 'intense' && <span className="camera-effect-badge-indicator">Ativo</span>}
                    </button>
                  </div>
                )}
                <div className="voice-camera-name-tag">
                  <span>{p.user_name} (Você)</span>
                  {speaking && <span className="speaking-tag-dot" />}
                  {muted && <MicOff size={12} className="voice-icon-muted" title="Mutado" />}
                  {deaf && <Headphones size={12} className="voice-icon-deaf" title="Ensurdecido" />}
                </div>
              </div>
            ) : remoteCameraStream ? (
              <div
                className={`voice-camera-tile-wrapper ${remoteEffect !== 'none' ? `camera-blur-${remoteEffect}` : ''}`}
                data-testid={`remote-camera-preview-${p.user_id}`}
              >
                <RemoteVideoView
                  stream={remoteCameraStream}
                  muted
                  className="voice-camera-video remote-camera"
                  testId={`remote-camera-video-${p.user_id}`}
                />
                {remoteEffect !== 'none' && (
                  <div
                    className={`camera-portrait-bloom-overlay ${remoteEffect}`}
                    data-testid={`remote-camera-bloom-overlay-${p.user_id}`}
                  />
                )}
                <div className="voice-camera-name-tag">
                  <span>{p.user_name}</span>
                  {speaking && <span className="speaking-tag-dot" />}
                  {muted && <MicOff size={12} className="voice-icon-muted" title="Mutado" />}
                  {deaf && <Headphones size={12} className="voice-icon-deaf" title="Ensurdecido" />}
                </div>
              </div>
            ) : (
              <div className={`voice-avatar-circle ${speaking ? 'speaking-halo' : ''}`}>
                <span>{initial}</span>
                {speaking && <div className="speaking-pulse-ring" />}
              </div>
            )}

            {!hasCamera && (
              <div className="voice-participant-name-row">
                <span className="voice-participant-name">
                  {p.user_name} {isMe ? '(Você)' : ''}
                </span>
                <div className="voice-status-icons">
                  {muted && <MicOff size={14} className="voice-icon-muted" title="Mutado" />}
                  {deaf && <Headphones size={14} className="voice-icon-deaf" title="Ensurdecido" />}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className={`voice-stage-container ${hasActiveScreenShare ? 'has-screen-share' : ''}`}
      data-testid="voice-stage-container"
    >
      {hasActiveScreenShare ? (
        <>
          {renderParticipantsGrid(true)}
          {renderScreenShares(true)}
        </>
      ) : (
        renderParticipantsGrid(false)
      )}

      {participants.length === 1 && !hasActiveScreenShare && (
        <div className="voice-empty-hint">
          <Volume2 size={28} className="voice-empty-icon" />
          <h3>Você está conectado na sala de voz #{channel?.name || 'geral'}</h3>
          <p>Aguardando outros amigos ou membros da comunidade entrarem para conversar.</p>
        </div>
      )}
    </div>
  );
}
