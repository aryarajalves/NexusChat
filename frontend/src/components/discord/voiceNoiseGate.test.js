import { describe, it, expect, vi } from 'vitest';
import { computeVoiceSignalLevel, createProcessedVoiceStream } from './voiceNoiseGate';

function createMockAudioContext() {
  const filters = [];
  const gainNode = {
    gain: {
      value: 0,
      setTargetAtTime: vi.fn((val) => {
        gainNode.gain.value = val;
      }),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const analyser = {
    fftSize: 512,
    frequencyBinCount: 256,
    connect: vi.fn(),
  };
  const source = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const destTrack = { enabled: true, stop: vi.fn() };
  const destStream = {
    getAudioTracks: () => [destTrack],
    getTracks: () => [destTrack],
  };
  const destination = { stream: destStream };

  const ctx = {
    currentTime: 10,
    createMediaStreamSource: vi.fn(() => source),
    createMediaStreamDestination: vi.fn(() => destination),
    createAnalyser: vi.fn(() => analyser),
    createGain: vi.fn(() => gainNode),
    createBiquadFilter: vi.fn(() => {
      const f = { type: '', frequency: { value: 0 }, Q: { value: 0 }, connect: vi.fn() };
      filters.push(f);
      return f;
    }),
  };

  return { ctx, filters, gainNode, analyser, source, destStream, destTrack };
}

describe('voiceNoiseGate', () => {
  it('calcula nível RMS corretamente no domínio do tempo e com fallback de frequência', () => {
    const timeData = new Float32Array([0.5, -0.5, 0.5, -0.5]);
    const rms = computeVoiceSignalLevel({ getFloatTimeDomainData: (arr) => arr.set(timeData) }, new Float32Array(4), null);
    expect(rms).toBeCloseTo(0.5, 4);

    const freqData = new Uint8Array([255, 0, 255, 0]);
    const avg = computeVoiceSignalLevel({ getByteFrequencyData: (arr) => arr.set(freqData) }, null, new Uint8Array(4));
    expect(avg).toBeCloseTo(0.5, 4);
  });

  it('configura filtros passa-alta (85 Hz) e passa-baixa (7500 Hz) e inicia com gate fechado', () => {
    const { ctx, filters, gainNode, destStream } = createMockAudioContext();
    const rawStream = { getAudioTracks: () => [{ enabled: true, stop: vi.fn() }] };

    const controller = createProcessedVoiceStream(ctx, rawStream, { enabled: true });

    expect(controller.stream).toBe(destStream);
    expect(filters).toHaveLength(2);
    expect(filters[0].type).toBe('highpass');
    expect(filters[0].frequency.value).toBe(85);
    expect(filters[1].type).toBe('lowpass');
    expect(filters[1].frequency.value).toBe(7500);
    expect(gainNode.gain.value).toBe(0);
  });

  it('rejeita cliques curtos (< 35ms) e abre o gate apenas para fala sustentada, fechando após o hold', () => {
    const { ctx, gainNode } = createMockAudioContext();
    const rawStream = { getAudioTracks: () => [{ enabled: true, stop: vi.fn() }] };
    const controller = createProcessedVoiceStream(ctx, rawStream, { enabled: true, thresholdRms: 0.02 });

    // Pico curto de clique de tecla (t=1000ms e t=1020ms) -> não deve abrir o gate
    expect(controller.updateGateState(0.08, 1000, false)).toBe(false);
    expect(controller.updateGateState(0.08, 1020, false)).toBe(false);
    expect(gainNode.gain.value).toBe(0);

    // Fala sustentada (>= 35ms) -> abre o gate
    expect(controller.updateGateState(0.08, 1040, false)).toBe(true);
    expect(gainNode.gain.value).toBe(1);

    // Pausa curta dentro do hold (350ms) -> mantém aberto
    expect(controller.updateGateState(0.001, 1200, false)).toBe(true);
    expect(gainNode.gain.value).toBe(1);

    // Silêncio prolongado após hold (> 350ms) -> fecha o gate
    expect(controller.updateGateState(0.001, 1450, false)).toBe(false);
    expect(gainNode.gain.value).toBe(0);
  });

  it('fecha imediatamente quando mutado/ensurdecido e libera o áudio quando o filtro é desativado', () => {
    const { ctx, gainNode } = createMockAudioContext();
    const rawStream = { getAudioTracks: () => [{ enabled: true, stop: vi.fn() }] };
    const controller = createProcessedVoiceStream(ctx, rawStream, { enabled: true, thresholdRms: 0.02 });

    controller.updateGateState(0.08, 1000, false);
    controller.updateGateState(0.08, 1050, false);
    expect(gainNode.gain.value).toBe(1);

    // Mutou -> fecha imediatamente
    expect(controller.updateGateState(0.08, 1060, true)).toBe(false);
    expect(gainNode.gain.value).toBe(0);

    // Desativou supressão -> abre bypass (ganho = 1)
    controller.setEnabled(false);
    expect(gainNode.gain.value).toBe(1);
  });

  it('faz fallback seguro para rawStream quando createMediaStreamDestination não existe', () => {
    const rawStream = { getAudioTracks: () => [{ enabled: true, stop: vi.fn() }] };
    const controller = createProcessedVoiceStream({}, rawStream, { enabled: true });

    expect(controller.stream).toBe(rawStream);
    expect(controller.analyser).toBeNull();
  });
});
