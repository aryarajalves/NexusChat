import { useState, useEffect, useCallback } from 'react';

export default function useDiscordStageState({
  channel,
  token,
  currentUser,
  setIsMuted,
  addToast,
}) {
  const isStage = channel?.type === 'STAGE';
  const [isStageModerator, setIsStageModerator] = useState(false);
  const [isStageSpeaker, setIsStageSpeaker] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [stageHandsRaised, setStageHandsRaised] = useState([]);
  const [stageGrantedSpeakers, setStageGrantedSpeakers] = useState([]);

  // Sincronização inicial de status do Canal de Palco
  useEffect(() => {
    if (!isStage || !channel?.id || !token) return;
    fetch(`/api/v1/discord/channels/${channel.id}/stage/status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const isMod = Boolean(data.current_user_is_moderator);
        const myId = Number(currentUser?.id);
        const granted = data.granted_speakers || [];
        const isSpk = isMod || granted.map(Number).includes(myId);
        setIsStageModerator(isMod);
        setIsStageSpeaker(isSpk);
        setStageHandsRaised(data.hands_raised || []);
        setIsHandRaised((data.hands_raised || []).map(Number).includes(myId));
        setStageGrantedSpeakers(granted);
        if (!isSpk && !isMod) {
          setIsMuted(true);
        }
      })
      .catch(() => {});
  }, [channel?.id, isStage, token, currentUser?.id, setIsMuted]);

  // Listener em tempo real de eventos de Palco
  useEffect(() => {
    const handleStageEvent = (e) => {
      const payload = e.detail;
      if (!payload || Number(payload.channel_id) !== Number(channel?.id)) return;
      if (payload.event === 'stage:hand_updated') {
        setStageHandsRaised(payload.hands_raised || []);
        if (Number(payload.user_id) === Number(currentUser?.id)) {
          setIsHandRaised(payload.hand_raised);
        }
      } else if (payload.event === 'stage:speaker_granted') {
        const targetId = Number(payload.target_user_id);
        const myId = Number(currentUser?.id);
        setStageGrantedSpeakers(payload.speakers || []);
        setStageHandsRaised(payload.hands_raised || []);
        if (targetId === myId) {
          setIsStageSpeaker(true);
          setIsHandRaised(false);
          setIsMuted(false);
          if (addToast) addToast('🎙️ O professor concedeu a sua palavra! Seu microfone foi liberado.', 'success');
        }
      } else if (payload.event === 'stage:speaker_revoked') {
        const targetId = Number(payload.target_user_id);
        const myId = Number(currentUser?.id);
        setStageGrantedSpeakers(payload.speakers || []);
        if (targetId === myId) {
          setIsStageSpeaker(false);
          setIsMuted(true);
          if (addToast) addToast('O professor moveu você de volta para os ouvintes.', 'info');
        }
      }
    };

    window.addEventListener('discord:stage', handleStageEvent);
    return () => window.removeEventListener('discord:stage', handleStageEvent);
  }, [channel?.id, currentUser?.id, setIsMuted, addToast]);

  const handleToggleRaiseHand = useCallback(async () => {
    const nextVal = !isHandRaised;
    try {
      const res = await fetch(`/api/v1/discord/channels/${channel.id}/stage/raise-hand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ hand_raised: nextVal }),
      });
      if (res.ok) {
        setIsHandRaised(nextVal);
        setStageHandsRaised((prev) =>
          nextVal ? [...prev, Number(currentUser?.id)] : prev.filter((id) => id !== Number(currentUser?.id))
        );
        if (addToast) addToast(nextVal ? '✋ Você levantou a mão para falar!' : 'Você abaixou a mão.', 'info');
      }
    } catch {}
  }, [channel?.id, isHandRaised, token, currentUser?.id, addToast]);

  const handleGrantSpeak = useCallback(async (targetUserId) => {
    try {
      const res = await fetch(`/api/v1/discord/channels/${channel.id}/stage/grant-speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      if (res.ok) {
        setStageGrantedSpeakers((prev) => [...prev, targetUserId]);
        setStageHandsRaised((prev) => prev.filter((id) => id !== targetUserId));
        if (addToast) addToast('Palavra concedida ao aluno!', 'success');
      }
    } catch {}
  }, [channel?.id, token, addToast]);

  const handleRevokeSpeak = useCallback(async (targetUserId) => {
    try {
      const res = await fetch(`/api/v1/discord/channels/${channel.id}/stage/revoke-speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      if (res.ok) {
        setStageGrantedSpeakers((prev) => prev.filter((id) => id !== targetUserId));
        if (addToast) addToast('Aluno movido para ouvintes.', 'info');
      }
    } catch {}
  }, [channel?.id, token, addToast]);

  return {
    isStage,
    isStageModerator,
    isStageSpeaker,
    isHandRaised,
    stageHandsRaised,
    stageGrantedSpeakers,
    handleToggleRaiseHand,
    handleGrantSpeak,
    handleRevokeSpeak,
  };
}
