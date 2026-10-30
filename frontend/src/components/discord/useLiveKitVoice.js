import { useState, useEffect } from 'react';

/**
 * Hook para negociação de credenciais e conexão ao Servidor SFU LiveKit (Fase 3).
 * Permite que clientes de canais de voz conectem-se a salas com alta concorrência
 * de áudio, vídeo de webcam e compartilhamento de tela com largura de banda adaptativa.
 */
export function useLiveKitVoice(channelId, authToken) {
  const [sfuStatus, setSfuStatus] = useState('idle'); // 'idle' | 'connecting' | 'connected' | 'fallback'
  const [voiceCredentials, setVoiceCredentials] = useState(null);

  useEffect(() => {
    if (!channelId) {
      setSfuStatus('idle');
      setVoiceCredentials(null);
      return;
    }

    let isMounted = true;

    async function fetchVoiceCredentials() {
      try {
        setSfuStatus('connecting');
        const storedToken =
          authToken ||
          localStorage.getItem('auth_token') ||
          localStorage.getItem('access_token');

        if (!storedToken) {
          if (isMounted) {
            setSfuStatus('fallback');
          }
          return;
        }

        const headers = { Authorization: `Bearer ${storedToken}` };

        const res = await fetch(`/api/v1/discord/channels/${channelId}/voice-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
        });

        if (!res.ok) {
          throw new Error('Falha ao obter credenciais LiveKit SFU');
        }

        const data = await res.json();
        if (isMounted) {
          setVoiceCredentials(data);
          setSfuStatus(data.is_sfu_available ? 'connected' : 'fallback');
        }
      } catch {
        if (isMounted) {
          setSfuStatus('fallback');
        }
      }
    }

    fetchVoiceCredentials();

    return () => {
      isMounted = false;
    };
  }, [channelId, authToken]);

  return {
    sfuStatus,
    voiceCredentials,
    isSfuActive: sfuStatus === 'connected',
  };
}

export default useLiveKitVoice;
