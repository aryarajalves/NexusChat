/**
 * Pipeline de processamento de áudio local (Web Audio API) para reduzir ruídos
 * de teclado, latidos e som ambiente antes do envio via WebRTC.
 *
 * Combina:
 * 1. Filtro passa-alta (85 Hz) para remover graves de batidas na mesa e vibrações.
 * 2. Filtro passa-baixa (7500 Hz) para atenuar estalos agudos de teclas mecânicas.
 * 3. Noise Gate inteligente com ataque rápido, hold (350 ms) e rejeição de transientes curtos
 *    focado na banda da voz humana (150 Hz – 4000 Hz).
 */

const DEFAULT_VOICE_THRESHOLD_RMS = 0.018;
const GATE_HOLD_MS = 350;
const TRANSIENT_MIN_MS = 35;

/**
 * Calcula o RMS (Root Mean Square) da energia na banda da voz humana usando dados no domínio do tempo
 * ou fallback de média de frequência quando `getFloatTimeDomainData` não está disponível.
 */
export function computeVoiceSignalLevel(analyser, timeData, freqData) {
  if (typeof analyser.getFloatTimeDomainData === 'function' && timeData) {
    analyser.getFloatTimeDomainData(timeData);
    let sumSq = 0;
    for (let i = 0; i < timeData.length; i++) {
      const sample = timeData[i];
      sumSq += sample * sample;
    }
    return Math.sqrt(sumSq / timeData.length);
  }

  if (typeof analyser.getByteFrequencyData === 'function' && freqData) {
    analyser.getByteFrequencyData(freqData);
    let sum = 0;
    for (let i = 0; i < freqData.length; i++) {
      sum += freqData[i];
    }
    return sum / (freqData.length * 255);
  }

  return 0;
}

/**
 * Cria um stream de áudio processado (com filtros + Noise Gate) ligado ao AudioContext.
 * Retorna `{ stream, analyser, updateGateState, cleanup }` com fallback seguro para `rawStream`.
 */
export function createProcessedVoiceStream(ctx, rawStream, { enabled = true, thresholdRms = DEFAULT_VOICE_THRESHOLD_RMS } = {}) {
  const canProcess =
    ctx &&
    rawStream &&
    typeof ctx.createMediaStreamSource === 'function' &&
    typeof ctx.createMediaStreamDestination === 'function' &&
    typeof ctx.createAnalyser === 'function' &&
    typeof ctx.createGain === 'function';

  if (!canProcess) {
    return {
      stream: rawStream,
      analyser: null,
      updateGateState: () => {},
      setEnabled: () => {},
      cleanup: () => {},
    };
  }

  const source = ctx.createMediaStreamSource(rawStream);
  const destination = ctx.createMediaStreamDestination();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;

  const gateGain = ctx.createGain();
  gateGain.gain.value = enabled ? 0 : 1;

  // Cadeia de filtros passa-banda para focar na voz humana e atenuar batidas/cliques
  let lastNode = source;
  if (typeof ctx.createBiquadFilter === 'function') {
    const highPass = ctx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 85;
    highPass.Q.value = 0.7;

    const lowPass = ctx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 7500;
    lowPass.Q.value = 0.7;

    lastNode.connect(highPass);
    highPass.connect(lowPass);
    lastNode = lowPass;
  }

  // O analyser lê o sinal filtrado ANTES do gate para detectar quando o usuário começa a falar
  lastNode.connect(analyser);
  lastNode.connect(gateGain);
  gateGain.connect(destination);

  // Preserva o estado enabled inicial das tracks originais
  const rawTracks = rawStream.getAudioTracks ? rawStream.getAudioTracks() : rawStream.getTracks?.() || [];
  const initialEnabled = rawTracks.length > 0 ? rawTracks[0].enabled : true;
  const processedTracks = destination.stream?.getAudioTracks?.() || [];
  processedTracks.forEach((t) => {
    t.enabled = initialEnabled;
  });

  let gateEnabled = Boolean(enabled);
  let lastAboveThresholdAt = 0;
  let aboveStartAt = 0;
  let gateOpen = !gateEnabled;

  const setGainSmooth = (targetGain, timeConstant) => {
    const now = ctx.currentTime || 0;
    if (typeof gateGain.gain.setTargetAtTime === 'function') {
      gateGain.gain.setTargetAtTime(targetGain, now, timeConstant);
    } else {
      gateGain.gain.value = targetGain;
    }
  };

  const setEnabled = (nextEnabled) => {
    gateEnabled = Boolean(nextEnabled);
    if (!gateEnabled) {
      gateOpen = true;
      setGainSmooth(1, 0.015);
    } else {
      gateOpen = false;
      setGainSmooth(0, 0.03);
    }
  };

  const updateGateState = (rmsLevel, nowMs = Date.now(), isMutedOrDeafened = false) => {
    if (isMutedOrDeafened) {
      if (gateOpen) {
        gateOpen = false;
        setGainSmooth(0, 0.01);
      }
      aboveStartAt = 0;
      return false;
    }

    if (!gateEnabled) {
      if (!gateOpen) {
        gateOpen = true;
        setGainSmooth(1, 0.015);
      }
      return rmsLevel > thresholdRms;
    }

    if (rmsLevel >= thresholdRms) {
      if (aboveStartAt === 0) aboveStartAt = nowMs;
      lastAboveThresholdAt = nowMs;
      // Rejeita transientes curtíssimos (< 35ms) como clique isolado de tecla
      if (!gateOpen && nowMs - aboveStartAt >= TRANSIENT_MIN_MS) {
        gateOpen = true;
        setGainSmooth(1, 0.015);
      }
    } else {
      aboveStartAt = 0;
      if (gateOpen && nowMs - lastAboveThresholdAt > GATE_HOLD_MS) {
        gateOpen = false;
        setGainSmooth(0, 0.06);
      }
    }

    return gateOpen;
  };

  const cleanup = () => {
    try {
      source.disconnect();
      gateGain.disconnect();
    } catch {}
    processedTracks.forEach((t) => {
      try {
        t.stop();
      } catch {}
    });
  };

  return {
    stream: destination.stream || rawStream,
    analyser,
    updateGateState,
    setEnabled,
    cleanup,
  };
}
