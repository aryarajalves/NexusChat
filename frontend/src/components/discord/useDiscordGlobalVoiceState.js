import { useState, useCallback } from 'react';
import { isSoundMuted, toggleSoundMuted, playDiscordSound } from './discordSounds';

/**
 * Hook para centralizar o estado global de voz (Mudo, Ensurdecer, Estados dos Membros e Sons do Sistema),
 * permitindo que os controles do rodapé do perfil e a barra lateral sincronizem instantaneamente com a sala de voz.
 */
export default function useDiscordGlobalVoiceState({ addToast }) {
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [isVoiceDeafened, setIsVoiceDeafened] = useState(false);
  const [voiceStates, setVoiceStates] = useState({});
  const [soundMuted, setSoundMutedState] = useState(isSoundMuted());

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
      playDiscordSound(next ? 'mute' : 'unmute');
      addToast?.(next ? 'Microfone desativado' : 'Microfone ativado', 'info');
      return next;
    });
  }, [addToast]);

  const handleToggleVoiceDeafen = useCallback(() => {
    setIsVoiceDeafened((prev) => {
      const next = !prev;
      if (next) setIsVoiceMuted(true);
      playDiscordSound(next ? 'mute' : 'unmute');
      addToast?.(next ? 'Áudio ensurdecido' : 'Áudio restaurado', 'info');
      return next;
    });
  }, [addToast]);

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
    voiceStates,
    setVoiceStates,
    soundMuted,
    handleToggleSoundMute,
    handleToggleVoiceMute,
    handleToggleVoiceDeafen,
    handleRoomVoiceStatesUpdate,
  };
}
