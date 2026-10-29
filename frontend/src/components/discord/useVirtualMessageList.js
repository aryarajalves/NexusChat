import { useState, useEffect, useMemo, useCallback } from 'react';

const ESTIMATED_ITEM_HEIGHT = 68;
const BUFFER_ITEMS = 12;

/**
 * Hook de virtualização de alto desempenho para o feed de mensagens do Discord.
 * Quando o canal possui poucas mensagens (<= 40), mantém renderização nativa 1:1 sem overhead.
 * Em canais com histórico longo (> 40), renderiza apenas os itens no viewport + buffer.
 */
export function useVirtualMessageList({
  messages = [],
  containerRef,
  enabledThreshold = 40,
  itemHeight = ESTIMATED_ITEM_HEIGHT,
  overscan = BUFFER_ITEMS,
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800);

  const isVirtual = messages.length > enabledThreshold;

  const handleScroll = useCallback(() => {
    if (!containerRef?.current || !isVirtual) return;
    setScrollTop(containerRef.current.scrollTop);
  }, [containerRef, isVirtual]);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;

    setContainerHeight(el.clientHeight || 800);

    const onScroll = () => {
      setScrollTop(el.scrollTop);
    };

    el.addEventListener('scroll', onScroll, { passive: true });

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      try {
        resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            if (entry.contentRect?.height) {
              setContainerHeight(entry.contentRect.height);
            }
          }
        });
        resizeObserver.observe(el);
      } catch {
        // Fallback gracioso caso ResizeObserver não esteja disponível
      }
    }

    return () => {
      el.removeEventListener('scroll', onScroll);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [containerRef, isVirtual]);

  const { visibleMessages, topSpacerHeight, bottomSpacerHeight, startIndex } = useMemo(() => {
    if (!isVirtual) {
      return {
        visibleMessages: messages,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
        startIndex: 0,
      };
    }

    const total = messages.length;
    const rawStartIndex = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);

    const startIndex = Math.max(0, rawStartIndex - overscan);
    const endIndex = Math.min(total, rawStartIndex + visibleCount + overscan);

    const topSpacerHeight = startIndex * itemHeight;
    const bottomSpacerHeight = (total - endIndex) * itemHeight;
    const visibleMessages = messages.slice(startIndex, endIndex);

    return {
      visibleMessages,
      topSpacerHeight,
      bottomSpacerHeight,
      startIndex,
    };
  }, [isVirtual, messages, scrollTop, containerHeight, itemHeight, overscan]);

  return {
    isVirtual,
    visibleMessages,
    topSpacerHeight,
    bottomSpacerHeight,
    startIndex,
    handleScroll,
  };
}

export default useVirtualMessageList;
