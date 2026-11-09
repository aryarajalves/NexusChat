import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Activity, Maximize2, Minimize2, EyeOff } from 'lucide-react';
import { RemoteVideoView } from './RemoteMediaPlayers';
import { getSelfieSegmentation, renderMeetBlurFrame } from './meetBackgroundBlur';
import ScreenAnnotationOverlay from './ScreenAnnotationOverlay';
import VoiceParticipantTile from './VoiceParticipantTile';

export default function VoiceStageView({
  channel,
  currentUser,
  participants = [],
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
  isCollaborative = false,
  onToggleCollaborative,
  onSendDraw,
  incomingDrawEvent,
  onRegisterAnnotationCanvas,
  isAnnotationActive,
  onToggleAnnotation,
  onOpenDocumentPip,
  onToggleScreenShare,
}) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [showEffectsPopover, setShowEffectsPopover] = useState(false);
  // watchedStreamId: null (não está assistindo nada), 'local' (própria tela) ou userId numérico (tela de outro participante)
  const [watchedStreamId, setWatchedStreamId] = useState(isScreenSharing ? 'local' : null);
  const prevIsScreenSharingRef = useRef(Boolean(isScreenSharing));

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

  // Quando o próprio usuário inicia ou encerra seu compartilhamento de tela
  useEffect(() => {
    if (isScreenSharing && !prevIsScreenSharingRef.current) {
      setWatchedStreamId('local');
    } else if (!isScreenSharing && watchedStreamId === 'local') {
      setWatchedStreamId(null);
    }
    prevIsScreenSharingRef.current = isScreenSharing;
  }, [isScreenSharing, watchedStreamId]);

  const remoteScreenShares = participants
    .filter((p) => {
      const uid = Number(p.user_id);
      if (uid === Number(currentUser?.id)) return false;
      const media = remotePeersMedia?.[uid] || {};
      const state = mergedVoiceStates?.[uid] || {};
      return Boolean(
        media.screenStream ||
        media.isScreenSharing ||
        state.is_screen_sharing ||
        state.isScreenSharing ||
        p.is_screen_sharing
      );
    })
    .map((p) => {
      const uid = Number(p.user_id);
      const media = remotePeersMedia?.[uid] || {};
      return {
        ...media,
        userId: uid,
        userName: p.user_name || media.userName,
      };
    });

  // Se o participante que estava sendo assistido parar de compartilhar a tela, sai automaticamente da visualização
  useEffect(() => {
    if (watchedStreamId !== null && watchedStreamId !== 'local') {
      const stillSharing = remoteScreenShares.some(
        (s) => Number(s.userId) === Number(watchedStreamId)
      );
      if (!stillSharing) {
        setWatchedStreamId(null);
        setIsMaximized(false);
      }
    }
  }, [remoteScreenShares, watchedStreamId]);

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
              // Ignorado com segurança
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

  const activeRemoteScreenPeer =
    watchedStreamId !== null && watchedStreamId !== 'local'
      ? remoteScreenShares.find((s) => Number(s.userId) === Number(watchedStreamId)) || null
      : null;

  const isWatchingLocalScreen = Boolean(isScreenSharing && watchedStreamId === 'local');
  const hasActiveScreenShare = Boolean(isWatchingLocalScreen || activeRemoteScreenPeer);
  const isMyOwnScreen = Boolean(
    isWatchingLocalScreen ||
      (activeRemoteScreenPeer && Number(activeRemoteScreenPeer.userId) === Number(currentUser?.id))
  );

  const handleStopWatchingStream = () => {
    setWatchedStreamId(null);
    if (isMaximized) {
      setIsMaximized(false);
      if (typeof document !== 'undefined' && document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const toggleMaximize = async () => {
    const nextMax = !isMaximized;
    setIsMaximized(nextMax);

    const targetEl = isWatchingLocalScreen ? localScreenBoxRef.current : remoteScreenBoxRef.current;
    if (nextMax) {
      if (targetEl && typeof targetEl.requestFullscreen === 'function' && !document.fullscreenElement) {
        try {
          await targetEl.requestFullscreen();
        } catch (_) {}
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
      {isWatchingLocalScreen && (
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
          <ScreenAnnotationOverlay
            isScreenSharing={true}
            isPresenter={true}
            currentUserId={currentUser?.id}
            currentUserName={currentUser?.name || 'Você'}
            isCollaborative={isCollaborative}
            onToggleCollaborative={onToggleCollaborative}
            onSendDraw={onSendDraw}
            incomingDrawEvent={incomingDrawEvent}
            onRegisterAnnotationCanvas={onRegisterAnnotationCanvas}
            isAnnotationActive={isAnnotationActive}
            onToggleAnnotation={onToggleAnnotation}
            onOpenDocumentPip={onOpenDocumentPip}
          />
          <div className="voice-screen-label">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={14} />
              <span>Transmissão ao vivo de {currentUser?.name || 'Você'}</span>
            </div>
            <button
              type="button"
              className="voice-screen-badge-max-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (typeof onToggleScreenShare === 'function') {
                  onToggleScreenShare();
                } else {
                  handleStopWatchingStream();
                }
              }}
              title="Parar de transmitir tela"
              data-testid="stop-own-screen-share-btn"
              style={{ background: 'rgba(242, 63, 67, 0.25)', borderColor: 'rgba(242, 63, 67, 0.5)' }}
            >
              <EyeOff size={12} />
              <span>Parar Transmissão</span>
            </button>
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
          {activeRemoteScreenPeer.screenStream ? (
            <RemoteVideoView
              stream={activeRemoteScreenPeer.screenStream}
              muted
              className="voice-screen-video"
              testId={`remote-screen-video-${activeRemoteScreenPeer.userId}`}
            />
          ) : (
            <div
              className="voice-screen-video"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: '320px',
                color: '#949ba4',
                gap: '12px',
                background: '#1e1f22',
              }}
              data-testid={`remote-screen-loading-${activeRemoteScreenPeer.userId}`}
            >
              <Activity size={32} className="animate-spin text-discord-blue" />
              <span>Conectando à transmissão ao vivo de {activeRemoteScreenPeer.userName || 'usuário'}...</span>
            </div>
          )}
          <ScreenAnnotationOverlay
            isScreenSharing={false}
            isRemoteScreen={true}
            isPresenter={isMyOwnScreen}
            currentUserId={currentUser?.id}
            currentUserName={currentUser?.name || 'Você'}
            isCollaborative={isCollaborative}
            onToggleCollaborative={onToggleCollaborative}
            onSendDraw={onSendDraw}
            incomingDrawEvent={incomingDrawEvent}
            onRegisterAnnotationCanvas={onRegisterAnnotationCanvas}
            isAnnotationActive={isAnnotationActive}
            onToggleAnnotation={onToggleAnnotation}
            onOpenDocumentPip={onOpenDocumentPip}
          />
          {!isMyOwnScreen && (
            <button
              type="button"
              className="voice-screen-maximize-btn"
              onClick={(e) => {
                e.stopPropagation();
                toggleMaximize();
              }}
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
              <span>
                Transmissão ao vivo de{' '}
                {isMyOwnScreen
                  ? `${currentUser?.name || 'Você'} (Você)`
                  : activeRemoteScreenPeer.userName || 'Membro'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {!isMyOwnScreen && (
                <button
                  type="button"
                  className="voice-screen-badge-max-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMaximize();
                  }}
                  title={isMaximized ? 'Restaurar tamanho' : 'Maximizar tela'}
                  data-testid="voice-screen-badge-max-btn"
                >
                  {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  <span>{isMaximized ? 'Restaurar' : 'Maximizar'}</span>
                </button>
              )}
              <button
                type="button"
                className="voice-screen-badge-max-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStopWatchingStream();
                }}
                title="Sair da transmissão e voltar para os cards"
                data-testid="close-watched-stream-btn"
                style={{ background: 'rgba(242, 63, 67, 0.3)', borderColor: 'rgba(242, 63, 67, 0.55)' }}
              >
                <EyeOff size={12} />
                <span>Sair da Transmissão</span>
              </button>
            </div>
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
        const remoteCameraStream = !isMe ? remotePeersMedia?.[p.user_id]?.cameraStream : null;
        const remoteEffect = !isMe ? remotePeersMedia?.[p.user_id]?.cameraEffect || 'none' : 'none';
        const hasCamera = Boolean((isMe && isCameraOn) || (!isMe && remoteCameraStream));
        const remoteMedia = remotePeersMedia?.[p.user_id] || {};
        const hasRemoteScreen = !isMe && Boolean(
          remoteMedia.screenStream ||
          remoteMedia.isScreenSharing ||
          state.is_screen_sharing ||
          state.isScreenSharing ||
          p.is_screen_sharing
        );
        const hasScreenShare = Boolean((isMe && isScreenSharing) || hasRemoteScreen);
        const isWatchingThisStream = isMe
          ? isWatchingLocalScreen
          : Number(watchedStreamId) === Number(p.user_id);

        return (
          <VoiceParticipantTile
            key={p.user_id}
            p={p}
            isMe={isMe}
            speaking={speaking}
            muted={muted}
            deaf={deaf}
            hasCamera={hasCamera}
            isCameraOn={isCameraOn}
            cameraBlurMode={cameraBlurMode}
            onChangeCameraBlurMode={onChangeCameraBlurMode}
            showEffectsPopover={showEffectsPopover}
            setShowEffectsPopover={setShowEffectsPopover}
            handleCameraVideoRef={handleCameraVideoRef}
            meetCanvasRef={meetCanvasRef}
            remoteCameraStream={remoteCameraStream}
            remoteEffect={remoteEffect}
            hasScreenShare={hasScreenShare}
            isWatchingThisStream={isWatchingThisStream}
            onWatchStream={(streamTarget) => setWatchedStreamId(streamTarget)}
            onStopWatchingStream={handleStopWatchingStream}
          />
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
