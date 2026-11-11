import React from 'react';
import { Volume2, Radio, Lock, Settings, MessageSquare } from 'lucide-react';
import VoiceCallTimer from './VoiceCallTimer';
import VoiceUserItem from './VoiceUserItem';

export default function VoiceChannelItem({
  ch,
  isStage = false,
  isActive = false,
  isConnected = false,
  displayUsers = [],
  voiceChannelCallTimes = {},
  onSelectChannel,
  onOpenVoiceChat,
  onOpenEditChannel,
  isOwnerOrAdmin = false,
  currentUser,
  voiceStates = {},
  isVoiceMuted = false,
  isVoiceDeafened = false,
  userVolumes = {},
  userLocalMutes = {},
  onSetUserVolume,
  onToggleUserLocalMute,
}) {
  return (
    <div key={ch.id} className="voice-channel-wrapper">
      <div
        className={`channel-item ${isActive ? 'active' : ''} ${isConnected ? 'voice-connected' : ''}`}
        onClick={() => onSelectChannel(ch.id)}
        data-testid={`channel-item-${ch.id}`}
        role="button"
        tabIndex={0}
      >
        <div className="channel-item-left">
          {ch.is_private ? (
            <Lock
              size={16}
              className={`channel-icon ${isConnected || displayUsers.length > 0 ? 'voice-active-icon' : ''}`}
              data-testid={`channel-lock-${ch.id}`}
            />
          ) : isStage ? (
            <Radio
              size={16}
              className={`channel-icon ${isConnected || displayUsers.length > 0 ? 'voice-active-icon' : ''}`}
              data-testid={`stage-icon-${ch.id}`}
            />
          ) : (
            <Volume2
              size={16}
              className={`channel-icon ${isConnected || displayUsers.length > 0 ? 'voice-active-icon' : ''}`}
            />
          )}
          <span>{ch.name}</span>
        </div>
        <VoiceCallTimer
          callStartedAt={voiceChannelCallTimes?.[ch.id]}
          isActive={displayUsers.length > 0}
        />
        <div className="channel-item-actions">
          <button
            type="button"
            className="channel-action-chat-btn"
            title="Abrir Bate-Papo da Call"
            onClick={(e) => {
              e.stopPropagation();
              if (typeof onOpenVoiceChat === 'function') {
                onOpenVoiceChat(ch.id);
              } else {
                onSelectChannel(ch.id);
              }
            }}
            data-testid={`open-voice-chat-btn-${ch.id}`}
          >
            <MessageSquare size={13} />
          </button>
          {isOwnerOrAdmin && (
            <button
              type="button"
              className="channel-action-settings-btn"
              title="Configurações do Canal"
              onClick={(e) => {
                e.stopPropagation();
                onOpenEditChannel && onOpenEditChannel(ch);
              }}
              data-testid={`edit-voice-channel-btn-${ch.id}`}
            >
              <Settings size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Lista de usuários conectados */}
      {displayUsers.length > 0 && (
        <div className="voice-channel-users-list" data-testid={`voice-channel-users-${ch.id}`}>
          {displayUsers.map((u) => {
            const uid = u.user_id || u.id;
            return (
              <VoiceUserItem
                key={uid}
                user={u}
                currentUser={currentUser}
                voiceStates={voiceStates}
                isVoiceMuted={isVoiceMuted}
                isVoiceDeafened={isVoiceDeafened}
                userVolumes={userVolumes}
                userLocalMutes={userLocalMutes}
                onSetUserVolume={onSetUserVolume}
                onToggleUserLocalMute={onToggleUserLocalMute}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
