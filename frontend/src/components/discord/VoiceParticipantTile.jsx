import React from 'react';
import { MicOff, Headphones, Sparkles, Monitor, Eye, EyeOff } from 'lucide-react';
import { RemoteVideoView } from './RemoteMediaPlayers';

export default function VoiceParticipantTile({
  p,
  isMe,
  speaking,
  muted,
  deaf,
  hasCamera,
  isCameraOn,
  cameraBlurMode,
  onChangeCameraBlurMode,
  showEffectsPopover,
  setShowEffectsPopover,
  handleCameraVideoRef,
  meetCanvasRef,
  remoteCameraStream,
  remoteEffect,
  hasScreenShare = false,
  isWatchingThisStream = false,
  onWatchStream,
  onStopWatchingStream,
}) {
  const initial = (p.user_name || 'U').charAt(0).toUpperCase();

  return (
    <div
      className="voice-participant-slot"
      data-testid={`voice-participant-slot-${p.user_id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px',
        flexShrink: 0,
      }}
    >
      <div
        className={`voice-participant-tile ${speaking ? 'speaking' : ''} ${hasCamera ? 'has-camera' : ''}`}
        data-testid={`voice-user-tile-${p.user_id}`}
        style={{ position: 'relative' }}
      >
        {/* Badge AO VIVO no canto superior do card quando o participante está compartilhando tela */}
        {hasScreenShare && (
          <div
            className="voice-live-stream-badge"
            data-testid={`voice-live-badge-${p.user_id}`}
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              background: '#f23f43',
              color: '#fff',
              fontSize: '9.5px',
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: '4px',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              zIndex: 5,
              boxShadow: '0 2px 6px rgba(242, 63, 67, 0.45)',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: '#fff',
                display: 'inline-block',
              }}
            />
            AO VIVO
          </div>
        )}

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
              <span>
                {cameraBlurMode === 'none' ? 'Desfoque' : cameraBlurMode === 'light' ? 'Leve' : 'Intenso'}
              </span>
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
                onClick={() => {
                  onChangeCameraBlurMode('none');
                  setShowEffectsPopover(false);
                }}
                data-testid="tile-effect-option-none"
              >
                <span>Desativado (Normal)</span>
                {cameraBlurMode === 'none' && <span className="camera-effect-badge-indicator">Ativo</span>}
              </button>
              <button
                type="button"
                className={`camera-effect-option-btn ${cameraBlurMode === 'light' ? 'active' : ''}`}
                onClick={() => {
                  onChangeCameraBlurMode('light');
                  setShowEffectsPopover(false);
                }}
                data-testid="tile-effect-option-light"
              >
                <span>Desfoque Leve (Foco Suave)</span>
                {cameraBlurMode === 'light' && <span className="camera-effect-badge-indicator">Ativo</span>}
              </button>
              <button
                type="button"
                className={`camera-effect-option-btn ${cameraBlurMode === 'intense' ? 'active' : ''}`}
                onClick={() => {
                  onChangeCameraBlurMode('intense');
                  setShowEffectsPopover(false);
                }}
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
          {p.avatar_url ? (
            <img
              src={p.avatar_url}
              alt={p.user_name}
              className="voice-avatar-circle-img"
              data-testid={`voice-avatar-img-${p.user_id}`}
            />
          ) : (
            <span>{initial}</span>
          )}
          {speaking && <div className="speaking-pulse-ring" />}
        </div>
      )}

      {!hasCamera && (
        <div className="voice-participant-name-row">
          <span className="voice-participant-name">
            {p.user_name} {isMe ? '(Você)' : ''}
          </span>
          <div className="voice-status-icons">
            {hasScreenShare && (
              <Monitor size={14} color="#23a55a" title="Compartilhando Tela" />
            )}
            {muted && <MicOff size={14} className="voice-icon-muted" title="Mutado" />}
            {deaf && <Headphones size={14} className="voice-icon-deaf" title="Ensurdecido" />}
          </div>
        </div>
      )}
      </div>

      {/* Botão de Assistir/Parar de Assistir: exibido exclusivamente para espectadores (outros participantes), nunca para o próprio apresentador */}
      {hasScreenShare && !isMe && (
        <div className="voice-stream-action-outside" style={{ zIndex: 6 }}>
          {isWatchingThisStream ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStopWatchingStream && onStopWatchingStream();
              }}
              data-testid={`leave-stream-btn-${p.user_id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                background: '#da373a',
                border: '1px solid #f23f43',
                color: '#ffffff',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(218, 55, 58, 0.4)',
                whiteSpace: 'nowrap',
              }}
              title="Parar de assistir esta transmissão"
            >
              <EyeOff size={12} />
              <span>Parar de Assistir</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onWatchStream && onWatchStream(isMe ? 'local' : Number(p.user_id));
              }}
              data-testid={`watch-stream-btn-${p.user_id}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '5px',
                background: '#5865f2',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(88, 101, 242, 0.45)',
                whiteSpace: 'nowrap',
              }}
              title={isMe ? 'Visualizar sua transmissão de tela' : `Assistir transmissão de ${p.user_name}`}
            >
              <Eye size={12} />
              <span>{isMe ? 'Ver Minha Tela' : 'Assistir Transmissão'}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
