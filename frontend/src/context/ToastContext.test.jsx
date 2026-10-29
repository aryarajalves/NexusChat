import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { ToastProvider, useToast } from './ToastContext';

function TestConsumer({ triggerType, message }) {
  const { addToast, removeToast } = useToast();
  return (
    <div>
      <button
        onClick={() => addToast(message, triggerType)}
        data-testid="trigger-toast"
      >
        Trigger
      </button>
      <button
        onClick={() => {
          for (let i = 1; i <= 6; i++) {
            addToast(`Notificação #${i}`, 'info');
          }
        }}
        data-testid="trigger-burst-toasts"
      >
        Trigger Burst
      </button>
      <button
        onClick={() => {
          for (let i = 0; i < 5; i++) {
            addToast('Erro repetido em loop', 'error');
          }
        }}
        data-testid="trigger-duplicate-toasts"
      >
        Trigger Duplicates
      </button>
    </div>
  );
}

describe('ToastContext & Toast Notifications', () => {
  it('renders success toast when triggered', () => {
    render(
      <ToastProvider>
        <TestConsumer triggerType="success" message="Link de convite copiado!" />
      </ToastProvider>
    );

    const triggerBtn = screen.getByTestId('trigger-toast');
    act(() => {
      triggerBtn.click();
    });

    expect(screen.getByText('Link de convite copiado!')).toBeInTheDocument();
    expect(screen.getByTestId('toast-success')).toBeInTheDocument();
  });

  it('renders error toast when triggered with error type', () => {
    render(
      <ToastProvider>
        <TestConsumer triggerType="error" message="Erro ao gerar convite." />
      </ToastProvider>
    );

    const triggerBtn = screen.getByTestId('trigger-toast');
    act(() => {
      triggerBtn.click();
    });

    expect(screen.getByText('Erro ao gerar convite.')).toBeInTheDocument();
    expect(screen.getByTestId('toast-error')).toBeInTheDocument();
  });

  it('limits maximum visible toasts to at most 3 when a burst occurs', () => {
    render(
      <ToastProvider maxToasts={3}>
        <TestConsumer triggerType="info" message="qualquer" />
      </ToastProvider>
    );

    const burstBtn = screen.getByTestId('trigger-burst-toasts');
    act(() => {
      burstBtn.click();
    });

    const toastContainer = screen.getByTestId('toast-container');
    const toastItems = toastContainer.querySelectorAll('.toast-item');
    // Não pode criar uma "ruma" de 6 toasts de uma vez; limita no máximo a 3
    expect(toastItems.length).toBeLessThanOrEqual(3);
    expect(screen.getByText('Notificação #6')).toBeInTheDocument();
  });

  it('deduplicates identical toasts triggered simultaneously/in loop', () => {
    render(
      <ToastProvider>
        <TestConsumer triggerType="error" message="qualquer" />
      </ToastProvider>
    );

    const duplicateBtn = screen.getByTestId('trigger-duplicate-toasts');
    act(() => {
      duplicateBtn.click();
    });

    // Mesmo chamando 5 vezes em loop com a mesma mensagem de erro, exibe apenas 1 toast
    const duplicateElements = screen.getAllByText('Erro repetido em loop');
    expect(duplicateElements.length).toBe(1);
  });

  it('allows dismissing a toast by clicking the close button', () => {
    render(
      <ToastProvider>
        <TestConsumer triggerType="success" message="Toast a ser fechado" />
      </ToastProvider>
    );

    act(() => {
      screen.getByTestId('trigger-toast').click();
    });

    expect(screen.getByText('Toast a ser fechado')).toBeInTheDocument();

    const closeBtn = screen.getByLabelText('Fechar notificação');
    act(() => {
      closeBtn.click();
    });

    expect(screen.queryByText('Toast a ser fechado')).not.toBeInTheDocument();
  });
});
