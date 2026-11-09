import { useState, useCallback } from 'react';
import { isSoundMuted, toggleSoundMuted, playDiscordSound } from './discordSounds';

/**
 * Hook para centralizar o estado global de voz (Mudo, Ensurdecer, Estados dos Membros e Sons do Sistema),
 * permitindo que os controles do rodapé do perfil e a barra lateral sincronizem instantaneamente com a sala de voz.
 */
export default function useDiscordGlobalVoiceState({ addToast }) {
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [isVoiceDeafened, setIsVoiceDeafened] = useState(false);
  const [isVoiceSpeaking, setIsVoiceSpeaking] = useState(false);
  const [isNoiseSuppressionEnabled, setIsNoiseSuppressionEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('discord_noise_suppression');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [voiceStates, setVoiceStates] = useState({});
  const [soundMuted, setSoundMutedState] = useState(isSoundMuted());

  const handleToggleNoiseSuppression = useCallback(() => {
    setIsNoiseSuppressionEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('discord_noise_suppression', String(next));
      } catch {}
      addToast?.(
        next ? 'Supressão de ruído ativada (Krisp)' : 'Supressão de ruído desativada',
        next ? 'success' : 'info'
      );
      return next;
    });
  }, [addToast]);

  const handleToggleSoundMute = useCallback(() => {
    const next = toggleSoundMuted();
    setSoundMutedState(next);
    playDiscordSound(next ? 'mute' : 'unmute');
    addToast?.(
      next ? 'Efeitos sonoros desativados.' : 'Efeitos sonoros ativados.',
      next ? 'info' : 'success'
    );
  }, [addToast]);

  const handleToggleVoiceMute = useCallback(() => {
    setIsVoiceMuted((prev) => {
      const next = !prev;
      if (next) setIsVoiceSpeaking(false);
      playDiscordSound(next ? 'mute' : 'unmute');
      addToast?.(next ? 'Microfone desativado' : 'Microfone ativado', 'info');
      return next;
    });
  }, [addToast]);

  const handleToggleVoiceDeafen = useCallback(() => {
    setIsVoiceDeafened((prev) => {
      const next = !prev;
      if (next) {
        setIsVoiceMuted(true);
        setIsVoiceSpeaking(false);
      }
      playDiscordSound(next ? 'mute' : 'unmute');
      addToast?.(next ? 'Áudio ensurdecido' : 'Áudio restaurado', 'info');
      return next;
    });
  }, [addToast]);

  const [userVolumes, setUserVolumes] = useState(() => {
    try {
      const saved = localStorage.getItem('discord_user_volumes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [userLocalMutes, setUserLocalMutes] = useState(() => {
    try {
      const saved = localStorage.getItem('discord_user_local_mutes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleSetUserVolume = useCallback((userId, vol) => {
    if (userId == null) return;
    const clamped = Math.max(0, Math.min(200, Math.round(Number(vol) || 0)));
    setUserVolumes((prev) => {
      const next = { ...prev, [userId]: clamped, [String(userId)]: clamped };
      try {
        localStorage.setItem('discord_user_volumes', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('discord:user_volume_change', {
          detail: { userId, volume: clamped },
        })
      );
    }
  }, []);

  const handleToggleUserLocalMute = useCallback((userId) => {
    if (userId == null) return;
    setUserLocalMutes((prev) => {
      const isMuted = !Boolean(prev[userId]);
      const next = { ...prev, [userId]: isMuted, [String(userId)]: isMuted };
      try {
        localStorage.setItem('discord_user_local_mutes', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('discord:user_local_mute_change', {
          detail: { userId },
        })
      );
    }
  }, []);

  const getUserVolume = useCallback((userId) => {
    if (userId == null) return 100;
    const v = userVolumes[userId] ?? userVolumes[String(userId)];
    return typeof v === 'number' ? v : 100;
  }, [userVolumes]);

  const isUserLocallyMuted = useCallback((userId) => {
    if (userId == null) return false;
    return Boolean(userLocalMutes[userId] ?? userLocalMutes[String(userId)]);
  }, [userLocalMutes]);

  const handleRoomVoiceStatesUpdate = useCallback((newRoomStates) => {
    if (!newRoomStates) return;
    setVoiceStates((prev) => {
      const merged = { ...prev };
      Object.entries(newRoomStates).forEach(([uid, st]) => {
        merged[uid] = st;
        merged[Number(uid)] = st;
        merged[String(uid)] = st;
      });
      return merged;
    });
  }, []);

  return {
    isVoiceMuted,
    setIsVoiceMuted,
    isVoiceDeafened,
    setIsVoiceDeafened,
    isVoiceSpeaking,
    setIsVoiceSpeaking,
    isNoiseSuppressionEnabled,
    setIsNoiseSuppressionEnabled,
    handleToggleNoiseSuppression,
    voiceStates,
    setVoiceStates,
    soundMuted,
    handleToggleSoundMute,
    handleToggleVoiceMute,
    handleToggleVoiceDeafen,
    handleRoomVoiceStatesUpdate,
    userVolumes,
    userLocalMutes,
    handleSetUserVolume,
    handleToggleUserLocalMute,
    getUserVolume,
    isUserLocallyMuted,
  };
}
