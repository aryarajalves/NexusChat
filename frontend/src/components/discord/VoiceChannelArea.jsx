import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Volume2, Radio, Users, Menu, Film, Music, MessageSquare } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import VoicePipPlayer from './VoicePipPlayer';
import VoiceStageView from './VoiceStageView';
import VoiceControlDock from './VoiceControlDock';
import StageModerationBar from './StageModerationBar';
import useDiscordStageState from './useDiscordStageState';
import ShareScreenModal from './ShareScreenModal';
import VoiceRecordingsGalleryModal from './VoiceRecordingsGalleryModal';
import SoundboardPopover from './SoundboardPopover';
import DocumentPipAnnotationWindow from './DocumentPipAnnotationWindow';
import VoiceChannelChatSidebar from './VoiceChannelChatSidebar';
import '../../styles/discord-voice-chat.css';
import '../../styles/discord-stage.css';
import { playSoundboardAudio } from './soundboardSynth';
import useLiveKitVoice from './useLiveKitVoice';
import useWebRTCVoiceRoom from './useWebRTCVoiceRoom';
import useVoiceLocalMedia from './useVoiceLocalMedia';
import { RemoteAudioPool } from './RemoteMediaPlayers';
import { createMixedCallAudioStream } from './webrtcMediaUtils';

export default function VoiceChannelArea({
  channel, connectionStatus = 'connected', currentUser, onlineUsers = [], voiceUsers = [], members = [],
  voiceStates = {}, onSendVoiceState, onDisconnectVoice, onDisconnect, showMembers, onToggleMembers, onToggleMobileNav,
  isMinimized = false, onReturnToVoice, token, isMuted: externalIsMuted, setIsMuted: externalSetIsMuted,
  isDeafened: externalIsDeafened, setIsDeafened: externalSetIsDeafened,
  isNoiseSuppressionEnabled = true, onToggleNoiseSuppression,
  onSpeakingChange, onRoomVoiceStatesUpdate,
  currentUserRole,
  isChatOpen: externalIsChatOpen,
  onToggleChat,
  userVolumes = {},
  userLocalMutes = {},
  onSetUserVolume,
  onToggleUserLocalMute,
}) {
  const [internalMuted, setInternalMuted] = useState(false), [internalDeafened, setInternalDeafened] = useState(false);
  const [cameraBlurMode, setCameraBlurMode] = useState('none'), [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isSoundboardOpen, setIsSoundboardOpen] = useState(false), [serverSounds, setServerSounds] = useState([]);
  const [isCollaborative, setIsCollaborative] = useState(false), [incomingDrawEvent, setIncomingDrawEvent] = useState(null);
  const [isAnnotationActive, setIsAnnotationActive] = useState(false), [isDocumentPipOpen, setIsDocumentPipOpen] = useState(false);
  const [internalIsChatOpen, setInternalIsChatOpen] = useState(false);
  const isChatOpen = externalIsChatOpen !== undefined ? externalIsChatOpen : internalIsChatOpen;
  const handleToggleChat = useCallback((forcedVal) => {
    if (typeof onToggleChat === 'function') {
      onToggleChat(typeof forcedVal === 'boolean' ? forcedVal : !isChatOpen);
    } else {
      setInternalIsChatOpen((prev) => (typeof forcedVal === 'boolean' ? forcedVal : !prev));
    }
  }, [onToggleChat, isChatOpen]);
  const handleCloseDocumentPip = useCallback(() => setIsDocumentPipOpen(false), []);
  const handleToggleDocumentPip = useCallback(() => setIsDocumentPipOpen((p) => !p), []);
  const annotationCanvasRef = useRef(null);
  const handleRegisterAnnotationCanvas = useCallback((c) => { annotationCanvasRef.current = c; }, []);

  const isMuted = externalIsMuted !== undefined ? externalIsMuted : internalMuted;
  const isDeafened = externalIsDeafened !== undefined ? externalIsDeafened : internalDeafened;
  const setIsMuted = externalSetIsMuted || setInternalMuted, setIsDeafened = externalSetIsDeafened || setInternalDeafened;

  const { isSfuActive } = useLiveKitVoice(channel?.id, token);
  const { addToast } = useToast();

  const isDeafenedRef = useRef(isDeafened);
  isDeafenedRef.current = isDeafened;

  const sendRoomVoiceStateRef = useRef(null);
  const emitVoiceState = useCallback(
    (payload) => {
      if (onSendVoiceState) onSendVoiceState(payload);
      sendRoomVoiceStateRef.current?.(payload);
    },
    [onSendVoiceState]
  );

  const {
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
  } = useVoiceLocalMedia({
    channelId: channel?.id,
    isMuted,
    isDeafened,
    setIsMuted,
    setIsDeafened,
    isNoiseSuppressionEnabled,
    emitVoiceState,
    onSpeakingChange,
    addToast,
  });

  const {
    isStage,
    isStageModerator,
    isStageSpeaker,
    isHandRaised,
    stageHandsRaised,
    stageGrantedSpeakers,
    handleToggleRaiseHand,
    handleGrantSpeak,
    handleRevokeSpeak,
  } = useDiscordStageState({
    channel,
    token,
    currentUser,
    setIsMuted,
    addToast,
  });

  const handleProtectedToggleMute = useCallback(() => {
    if (isStage && !isStageModerator && !isStageSpeaker) {
      if (addToast) addToast('Você está no modo ouvinte. Levante a mão para o professor autorizar seu microfone!', 'info');
      return;
    }
    handleToggleMute();
  }, [isStage, isStageModerator, isStageSpeaker, addToast, handleToggleMute]);

  useEffect(() => { if (isScreenSharing) setIsAnnotationActive(true); }, [isScreenSharing]);

  const handleRemoteScreenShareStarted = useCallback((senderId, senderName) => {
    addToast(`${senderName || 'Outro participante'} iniciou uma transmissão de tela. Clique em "Assistir Transmissão" para ver.`, 'info');
  }, [addToast]);

  const handleRemoteSoundboardPlay = useCallback((payload) => {
    if (!payload?.sound) return;
    if (payload.user_id !== currentUser?.id && !isDeafenedRef.current) {
      playSoundboardAudio(payload.sound);
    }
    addToast(`${payload.user_name || 'Alguém'} tocou ${payload.sound.emoji || '🔊'} ${payload.sound.name}`, 'info');
  }, [currentUser?.id, addToast]);

  const { rtcPeers, remotePeersMedia, roomVoiceStates, sendRoomVoiceState, sendSoundboardPlay, sendScreenDraw } = useWebRTCVoiceRoom({
    channelId: channel?.id,
    token,
    currentUser,
    micStream,
    cameraStream,
    screenStream,
    isCameraOn,
    isScreenSharing,
    isMuted,
    isDeafened,
    cameraBlurMode,
    onRemoteScreenShareStarted: handleRemoteScreenShareStarted,
    onRoomVoiceStatesUpdate,
    onSoundboardPlay: handleRemoteSoundboardPlay,
    onScreenDraw: (drawEv) => setIncomingDrawEvent(drawEv),
  });
  sendRoomVoiceStateRef.current = sendRoomVoiceState;

  useEffect(() => {
    if (!channel?.server_id || !token) return;
    fetch(`/api/v1/discord/servers/${channel.server_id}/soundboard`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => (r.ok ? r.json() : [])).then((data) => setServerSounds(Array.isArray(data) ? data : [])).catch(() => {});
  }, [channel?.server_id, token]);

  const handleTriggerSound = useCallback((sound, vol) => {
    if (typeof sendSoundboardPlay === 'function') sendSoundboardPlay(sound);
    if (channel?.id) {
      fetch(`/api/v1/discord/channels/${channel.id}/soundboard/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ sound_id: sound.id, sound_name: sound.name, emoji: sound.emoji, audio_url: sound.audio_url, volume: vol }),
      }).catch(() => {});
    }
  }, [channel?.id, token, sendSoundboardPlay]);

  const mixedCallAudio = useMemo(() => {
    return createMixedCallAudioStream(micStream, remotePeersMedia);
  }, [micStream, remotePeersMedia]);

  const activeRemoteScreen = Object.values(remotePeersMedia || {}).find((p) => Boolean(p?.screenStream));
  const activeRecordingScreen = screenStream || activeRemoteScreen?.screenStream || null;

  const mergedVoiceStates = { ...voiceStates, ...roomVoiceStates };

  const participants = (() => {
    const memberMap = new Map();
    (members || []).forEach((m) => { const mid = Number(m.user_id || m.id); if (mid) memberMap.set(mid, m); });
    const map = new Map(), sourceUsers = (voiceUsers && voiceUsers.length > 0) ? voiceUsers : (onlineUsers || []);
    sourceUsers.forEach((u) => {
      const uid = Number(u.user_id || u.id);
      if (uid) {
        const m = memberMap.get(uid);
        map.set(uid, { user_id: uid, user_name: u.user_name || u.name || m?.user_name || m?.name, avatar_url: u.avatar_url || m?.avatar_url || null });
      }
    });
    (rtcPeers || []).forEach((u) => {
      const uid = Number(u.user_id);
      if (uid) {
        const existing = map.get(uid) || {}, m = memberMap.get(uid);
        map.set(uid, { ...existing, user_id: uid, user_name: u.user_name || existing.user_name || m?.user_name || m?.name, avatar_url: existing.avatar_url || m?.avatar_url || null });
      }
    });
    if (currentUser) {
      const cid = Number(currentUser.id), existing = map.get(cid) || {};
      map.set(cid, { ...existing, user_id: cid, user_name: currentUser.name || existing.user_name, avatar_url: currentUser.avatar_url || existing.avatar_url || null });
    }
    const list = map.size > 0
      ? Array.from(map.values())
      : [{ user_id: currentUser?.id || 1, user_name: currentUser?.name || 'Você', avatar_url: currentUser?.avatar_url || null }];
    return list.sort((a, b) => Number(a.user_id) - Number(b.user_id));
  })();

  const canManageSoundboard = useMemo(() => {
    if (currentUser?.role === 'superadmin' || currentUser?.is_superuser) return true;
    if (currentUserRole === 'OWNER' || currentUserRole === 'ADMIN' || currentUserRole === 'superadmin') return true;
    const currentMember = (members || []).find(
      (m) => Number(m.user_id || m.id) === Number(currentUser?.id)
    );
    if (currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN') return true;
    return false;
  }, [currentUser, currentUserRole, members]);

  return (
    <>
      <RemoteAudioPool
        remotePeersMedia={remotePeersMedia}
        isDeafened={isDeafened}
        userVolumes={userVolumes}
        userLocalMutes={userLocalMutes}
      />

      {isMinimized ? (
        <VoicePipPlayer
          channel={channel}
          currentUser={currentUser}
          participantsCount={participants.length}
          isMuted={isMuted}
          isSpeaking={isSpeaking}
          isCameraOn={isCameraOn}
          isScreenSharing={isScreenSharing}
          onToggleMute={handleToggleMute}
          onToggleCamera={handleToggleCamera}
          onToggleScreenShare={handleToggleScreenShare}
          onDisconnectVoice={onDisconnectVoice || onDisconnect}
          onReturnToVoice={onReturnToVoice}
          onSetVideoRef={handleSetVideoRef}
          onSetCameraVideoRef={handleSetCameraVideoRef}
        />
      ) : (
        <section className="discord-chat-area voice-channel-area" aria-label={`Canal de Voz 🔊 ${channel.name}`}>
          <div className="chat-header">
            <div className="chat-header-title">
              {onToggleMobileNav && (
                <button
                  type="button"
                  className="chat-mobile-nav-btn"
                  onClick={onToggleMobileNav}
                  title="Abrir Canais"
                  data-testid="chat-mobile-nav-btn"
                >
                  <Menu size={22} />
                </button>
              )}
              {isStage ? <Radio size={20} color="#5865f2" /> : <Volume2 size={20} color="#5865f2" />}
              <span>{channel.name}</span>
              <span className="chat-header-desc">
                {isStage ? 'Canal de Palco / Aula' : 'Canal de Voz & Transmissão'}
              </span>
            </div>

            <div className="chat-header-actions">
              <div className={`connection-pill pill-${connectionStatus}`} data-testid="voice-connection-status-pill">
                <span className="status-indicator-dot" />
                <span className="status-indicator-text">
                  {connectionStatus === 'connected'
                    ? isSfuActive
                      ? 'Voz Conectada (RTC SFU)'
                      : 'Voz Conectada (RTC)'
                    : 'Conectando à Voz...'}
                </span>
              </div>

              <button
                type="button"
                className={`control-icon-btn ${isGalleryOpen ? 'active' : ''}`}
                onClick={() => setIsGalleryOpen(true)}
                title="Gravações da Sala"
                data-testid="toggle-recordings-gallery-btn"
              >
                <Film size={20} />
              </button>

              <button
                type="button"
                className={`control-icon-btn ${isChatOpen ? 'active' : ''}`}
                onClick={() => handleToggleChat()}
                title="Bate-Papo de Texto da Call"
                data-testid="toggle-voice-chat-btn"
              >
                <MessageSquare size={20} />
              </button>

              <button
                type="button"
                className={`control-icon-btn ${isSoundboardOpen ? 'active' : ''}`}
                onClick={() => setIsSoundboardOpen((prev) => !prev)}
                title="Soundboard"
                data-testid="open-soundboard-btn"
              >
                <Music size={20} />
              </button>

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

          <div className="voice-channel-body-wrapper">
            <div className="voice-channel-stage-column">
              {isStage && (
                <StageModerationBar
                  channel={channel}
                  isStage={isStage}
                  isModerator={isStageModerator}
                  isSpeaker={isStageSpeaker}
                  handRaised={isHandRaised}
                  handsRaised={stageHandsRaised}
                  grantedSpeakers={stageGrantedSpeakers}
                  participants={participants}
                  currentUser={currentUser}
                  onRaiseHand={handleToggleRaiseHand}
                  onGrantSpeak={handleGrantSpeak}
                  onRevokeSpeak={handleRevokeSpeak}
                />
              )}

              <VoiceStageView
                channel={channel} currentUser={currentUser} participants={participants}
                mergedVoiceStates={mergedVoiceStates} remotePeersMedia={remotePeersMedia}
                isSpeaking={isSpeaking} isMuted={isMuted} isDeafened={isDeafened}
                isCameraOn={isCameraOn} isScreenSharing={isScreenSharing} cameraBlurMode={cameraBlurMode}
                onChangeCameraBlurMode={setCameraBlurMode} onSetVideoRef={handleSetVideoRef}
                onSetCameraVideoRef={handleSetCameraVideoRef} isCollaborative={isCollaborative}
                onToggleCollaborative={setIsCollaborative} onSendDraw={sendScreenDraw}
                incomingDrawEvent={incomingDrawEvent} onRegisterAnnotationCanvas={handleRegisterAnnotationCanvas}
                isAnnotationActive={isAnnotationActive} onToggleAnnotation={() => setIsAnnotationActive((p) => !p)}
                onOpenDocumentPip={() => setIsDocumentPipOpen(true)}
                onToggleScreenShare={handleToggleScreenShare}
              />

              <VoiceControlDock
                isMuted={isMuted} onToggleMute={handleProtectedToggleMute} isDeafened={isDeafened} onToggleDeafen={handleToggleDeafen}
                isCameraOn={isCameraOn} onToggleCamera={handleToggleCamera} isScreenSharing={isScreenSharing}
                onToggleScreenShare={handleToggleScreenShare} cameraBlurMode={cameraBlurMode} onChangeCameraBlurMode={setCameraBlurMode}
                channel={channel} mixedCallAudio={mixedCallAudio} activeRecordingScreen={activeRecordingScreen}
                cameraStream={cameraStream} micStream={micStream} currentUser={currentUser} onDisconnectVoice={onDisconnectVoice || onDisconnect}
                getAnnotationCanvas={() => annotationCanvasRef.current}
                hasActiveScreenShare={Boolean(activeRecordingScreen)}
                isAnnotationActive={isAnnotationActive}
                onToggleAnnotation={() => setIsAnnotationActive((p) => !p)}
                isDocumentPipOpen={isDocumentPipOpen}
                onToggleDocumentPip={handleToggleDocumentPip}
              />
            </div>

            {isChatOpen && (
              <VoiceChannelChatSidebar
                channel={channel}
                currentUser={currentUser}
                token={token}
                onClose={() => handleToggleChat(false)}
              />
            )}
          </div>
        </section>
      )}

      <DocumentPipAnnotationWindow
        isOpen={isDocumentPipOpen}
        onClose={handleCloseDocumentPip}
        channel={channel}
        currentUser={currentUser}
        stream={screenStream || screenStreamRef.current || activeRemoteScreen?.screenStream || null}
        isPresenter={Boolean(isScreenSharing)}
        isCollaborative={isCollaborative}
        onToggleCollaborative={setIsCollaborative}
        onSendDraw={sendScreenDraw}
        incomingDrawEvent={incomingDrawEvent}
        onRegisterAnnotationCanvas={handleRegisterAnnotationCanvas}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
        isDeafened={isDeafened}
        onToggleDeafen={handleToggleDeafen}
        onDisconnectVoice={onDisconnectVoice || onDisconnect}
      />

      <ShareScreenModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        onConfirmShare={handleConfirmStartScreenShare}
      />

      <VoiceRecordingsGalleryModal
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        channel={channel}
        currentUser={currentUser}
      />

      <SoundboardPopover
        isOpen={isSoundboardOpen}
        onClose={() => setIsSoundboardOpen(false)}
        channelId={channel?.id}
        serverId={channel?.server_id}
        token={token}
        serverSounds={serverSounds}
        onSoundsChange={setServerSounds}
        onTriggerSound={handleTriggerSound}
        isDeafened={isDeafened}
        currentUser={currentUser}
        currentUserRole={currentUserRole}
        canManageSounds={canManageSoundboard}
      />
    </>
  );
}
