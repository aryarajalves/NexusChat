import React, { useState, useEffect } from 'react';

/**
 * Componente modular para exibir o cronômetro em tempo real de uma call ativa de voz.
 * Estilo idêntico ao nativo do Discord (verde, tabular-nums).
 * Respeita regras de limites de código (< 500 linhas).
 */
export default function VoiceCallTimer({ callStartedAt, isActive = true, className = '' }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isActive || !callStartedAt) {
      setElapsed(0);
      return;
    }

    // Normaliza para segundos se fornecido em milissegundos
    const startSec = typeof callStartedAt === 'string' && !isNaN(Number(callStartedAt))
      ? Number(callStartedAt)
      : typeof callStartedAt === 'number'
      ? (callStartedAt > 1e11 ? callStartedAt / 1000 : callStartedAt)
      : typeof callStartedAt === 'string'
      ? new Date(callStartedAt).getTime() / 1000
      : null;

    if (!startSec) return;

    const updateTimer = () => {
      const nowSec = Date.now() / 1000;
      const diff = Math.max(0, Math.floor(nowSec - startSec));
      setElapsed(diff);
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);

    return () => clearInterval(intervalId);
  }, [callStartedAt, isActive]);

  if (!isActive || !callStartedAt) return null;

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  const formatted = hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <span
      className={`voice-channel-call-timer ${className}`}
      data-testid="voice-call-timer"
      title={`Call em andamento há ${formatted}`}
    >
      {formatted}
    </span>
  );
}
