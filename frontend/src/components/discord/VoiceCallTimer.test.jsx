import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import VoiceCallTimer from './VoiceCallTimer';

describe('VoiceCallTimer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('não renderiza nada se a call não estiver ativa ou não tiver callStartedAt', () => {
    const { container: c1 } = render(<VoiceCallTimer callStartedAt={null} isActive={false} />);
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(<VoiceCallTimer callStartedAt={12345678} isActive={false} />);
    expect(c2.firstChild).toBeNull();
  });

  it('calcula e exibe minutos e segundos no formato MM:SS', () => {
    const nowSec = 1700000000;
    vi.setSystemTime(new Date(nowSec * 1000));

    // Call iniciada há 2 minutos e 15 segundos (135 segundos atrás)
    const startedAt = nowSec - 135;

    render(<VoiceCallTimer callStartedAt={startedAt} isActive={true} />);

    const timer = screen.getByTestId('voice-call-timer');
    expect(timer).toBeInTheDocument();
    expect(timer).toHaveTextContent('02:15');
  });

  it('calcula e exibe horas no formato HH:MM:SS quando ultrapassar 1 hora', () => {
    const nowSec = 1700000000;
    vi.setSystemTime(new Date(nowSec * 1000));

    // Call iniciada há 1 hora, 15 minutos e 30 segundos (4530s atrás)
    const startedAt = nowSec - 4530;

    render(<VoiceCallTimer callStartedAt={startedAt} isActive={true} />);

    const timer = screen.getByTestId('voice-call-timer');
    expect(timer).toHaveTextContent('01:15:30');
  });

  it('avança o cronômetro a cada segundo', () => {
    const nowSec = 1700000000;
    vi.setSystemTime(new Date(nowSec * 1000));

    const startedAt = nowSec; // acabou de iniciar

    render(<VoiceCallTimer callStartedAt={startedAt} isActive={true} />);
    const timer = screen.getByTestId('voice-call-timer');
    expect(timer).toHaveTextContent('00:00');

    act(() => {
      vi.advanceTimersByTime(5000); // 5 segundos depois
    });

    expect(timer).toHaveTextContent('00:05');
  });
});
