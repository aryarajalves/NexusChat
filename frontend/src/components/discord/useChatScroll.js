import { useRef, useEffect, useCallback } from 'react';

/**
 * Hook de controle de rolagem para o feed do Discord.
 * Garante que ao abrir um servidor/canal ou receber novas mensagens com mídias
 * (imagens, vídeos, anexos), a rolagem desça 100% até o fim do feed sem parar antes.
 */
export function useChatScroll({ messages = [], channelId, currentUserId }) {
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const isNearBottomRef = useRef(true);
  const prevChannelIdRef = useRef(channelId);
  const prevMessagesLengthRef = useRef(messages.length);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    const container = messagesContainerRef.current;
    if (!container) return;

    if (behavior === 'auto') {
      container.scrollTop = container.scrollHeight;
    } else {
      if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
        try {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        } catch (_) {
          container.scrollTop = container.scrollHeight;
        }
      } else {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, []);

  const handleScrollToMessage = useCallback((messageId) => {
    const el = document.getElementById(`message-item-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('message-highlight-pulse');
      setTimeout(() => {
        el.classList.remove('message-highlight-pulse');
      }, 2000);
    }
  }, []);

  // Monitora a posição de rolagem para saber se o usuário está perto do final
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const onScroll = () => {
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      isNearBottomRef.current = distanceFromBottom <= 180;
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  // Ao trocar de canal/servidor: ativa janela de carga inicial e ancora no fundo imediatamente
  useEffect(() => {
    if (prevChannelIdRef.current !== channelId) {
      prevChannelIdRef.current = channelId;
      isInitialLoadRef.current = true;
      isNearBottomRef.current = true;
      prevMessagesLengthRef.current = 0;
    }

    scrollToBottom('auto');

    const raf = requestAnimationFrame(() => scrollToBottom('auto'));
    const t1 = setTimeout(() => scrollToBottom('auto'), 60);
    const t2 = setTimeout(() => scrollToBottom('auto'), 180);
    const t3 = setTimeout(() => scrollToBottom('auto'), 360);
    const t4 = setTimeout(() => scrollToBottom('auto'), 650);
    const tDone = setTimeout(() => {
      isInitialLoadRef.current = false;
    }, 1500);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(tDone);
    };
  }, [channelId, scrollToBottom]);

  // Ao atualizar mensagens: rola para o fim se for carga inicial, envio próprio ou se estiver no fundo
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const isFirstPopulation = prevMessagesLengthRef.current === 0 && messages.length > 0;
    const isNewMessage = messages.length > prevMessagesLengthRef.current;
    prevMessagesLengthRef.current = messages.length;

    if (isInitialLoadRef.current || isFirstPopulation) {
      scrollToBottom('auto');
      const raf = requestAnimationFrame(() => scrollToBottom('auto'));
      const t = setTimeout(() => scrollToBottom('auto'), 80);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t);
      };
    }

    if (isNewMessage) {
      const lastMsg = messages[messages.length - 1];
      const isMyMessage = Boolean(
        lastMsg && (lastMsg.author_id === currentUserId || lastMsg.author?.id === currentUserId)
      );

      if (isMyMessage || isNearBottomRef.current) {
        scrollToBottom(isMyMessage ? 'smooth' : 'auto');
        // Checagem tardia caso a nova mensagem contenha mídia
        const t = setTimeout(() => {
          if (isNearBottomRef.current) scrollToBottom('auto');
        }, 150);
        return () => clearTimeout(t);
      }
    }
  }, [messages, currentUserId, scrollToBottom]);

  // Captura eventos nativos de carregamento de imagens e vídeos no feed
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleMediaLoaded = () => {
      if (isInitialLoadRef.current || isNearBottomRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    };

    container.addEventListener('load', handleMediaLoaded, true);
    container.addEventListener('loadeddata', handleMediaLoaded, true);

    return () => {
      container.removeEventListener('load', handleMediaLoaded, true);
      container.removeEventListener('loadeddata', handleMediaLoaded, true);
    };
  }, []);

  return {
    messagesContainerRef,
    messagesEndRef,
    scrollToBottom,
    handleScrollToMessage,
  };
}
