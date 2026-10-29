import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);
const MAX_TOASTS = 3;
const DEDUPE_INTERVAL_MS = 2500;

export function ToastProvider({ children, maxToasts = MAX_TOASTS }) {
  const [toasts, setToasts] = useState([]);
  const recentToastsRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'success', duration = 3500) => {
    if (!message) return;

    const dedupeKey = `${type}:${message.trim()}`;
    const now = Date.now();
    const lastTime = recentToastsRef.current.get(dedupeKey);

    // Evita enxurrada de toasts idênticos disparados em sequência ou loops
    if (lastTime && now - lastTime < DEDUPE_INTERVAL_MS) {
      return;
    }
    recentToastsRef.current.set(dedupeKey, now);

    // Limpa chaves antigas do mapa para manter memória limpa
    if (recentToastsRef.current.size > 50) {
      for (const [key, timestamp] of recentToastsRef.current.entries()) {
        if (now - timestamp > 10000) {
          recentToastsRef.current.delete(key);
        }
      }
    }

    const id = now + Math.random().toString(36).substr(2, 9);

    setToasts((prev) => {
      // Se já houver toast idêntico visível na tela, não duplica
      const alreadyVisible = prev.some((t) => t.message === message && t.type === type);
      if (alreadyVisible) return prev;

      // Limita a quantidade visível: mantém no máximo (maxToasts - 1) anteriores
      const trimmed = prev.length >= maxToasts ? prev.slice(prev.length - (maxToasts - 1)) : prev;
      return [...trimmed, { id, message, type }];
    });

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [maxToasts, removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="toast-container" data-testid="toast-container" aria-live="polite">
        {toasts.map((toast) => {
          let Icon = CheckCircle2;
          let typeClass = 'toast-success';
          if (toast.type === 'error') {
            Icon = AlertCircle;
            typeClass = 'toast-error';
          } else if (toast.type === 'info') {
            Icon = Info;
            typeClass = 'toast-info';
          }

          return (
            <div
              key={toast.id}
              className={`toast-item ${typeClass}`}
              data-testid={`toast-${toast.type}`}
            >
              <Icon size={20} className="toast-icon" />
              <span className="toast-message">{toast.message}</span>
              <button
                type="button"
                className="toast-close-btn"
                onClick={() => removeToast(toast.id)}
                aria-label="Fechar notificação"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
