// soundboardSynth.js - Sintetizador Web Audio API e Sons Padrão do Soundboard (Discord Style)

export const DEFAULT_SOUNDBOARD_SOUNDS = [
  { id: 'def_quack', name: 'Quack', emoji: '🦆', description: 'Pato cômico', isDefault: true },
  { id: 'def_airhorn', name: 'Airhorn', emoji: '📢', description: 'Corneta clássica', isDefault: true },
  { id: 'def_badumtss', name: 'Ba Dum Tss', emoji: '🥁', description: 'Bateria de piada', isDefault: true },
  { id: 'def_cricket', name: 'Grilos', emoji: '🦗', description: 'Silêncio constrangedor', isDefault: true },
  { id: 'def_applause', name: 'Aplausos', emoji: '👏', description: 'Palmas e ovação', isDefault: true },
  { id: 'def_sadtrombone', name: 'Sad Trombone', emoji: '🎺', description: 'Wah wah wah...', isDefault: true },
  { id: 'def_ding', name: 'Ding', emoji: '🔔', description: 'Sino triunfante', isDefault: true },
  { id: 'def_levelup', name: 'Level Up', emoji: '🎮', description: 'Conquista 8-bit', isDefault: true },
];

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Toca efeito sonoro sintetizado em tempo real via Web Audio API
 */
export function playSynthesizedSound(soundId, volume = 0.8) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(Math.max(0.01, Math.min(volume, 1.0)), now);
  masterGain.connect(ctx.destination);

  switch (soundId) {
    case 'def_quack': {
      // Pato cômico (modulação rápida de frequência)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.22);
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.25);
      break;
    }

    case 'def_airhorn': {
      // Corneta Airhorn tríade brilhante
      const freqs = [466.16, 554.37, 622.25];
      freqs.forEach((f) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.setValueAtTime(0.25, now + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.5);
      });
      break;
    }

    case 'def_badumtss': {
      // Ba Dum Tss: Ba (bumbo), Dum (tom), Tss (prato / ruído)
      const kick = ctx.createOscillator();
      const kickGain = ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(140, now);
      kick.frequency.exponentialRampToValueAtTime(45, now + 0.15);
      kickGain.gain.setValueAtTime(0.8, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      kick.connect(kickGain);
      kickGain.connect(masterGain);
      kick.start(now);
      kick.stop(now + 0.16);

      const tom = ctx.createOscillator();
      const tomGain = ctx.createGain();
      tom.type = 'sine';
      tom.frequency.setValueAtTime(190, now + 0.2);
      tom.frequency.exponentialRampToValueAtTime(70, now + 0.38);
      tomGain.gain.setValueAtTime(0.8, now + 0.2);
      tomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      tom.connect(tomGain);
      tomGain.connect(masterGain);
      tom.start(now + 0.2);
      tom.stop(now + 0.4);

      // Hi-hat / Tss
      const bufferSize = ctx.sampleRate * 0.35;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 6000;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.6, now + 0.42);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(masterGain);
      whiteNoise.start(now + 0.42);
      whiteNoise.stop(now + 0.75);
      break;
    }

    case 'def_sadtrombone': {
      // Sad trombone: 4 notas descendentes
      const notes = [
        { f: 293.66, t: now, d: 0.28 },
        { f: 277.18, t: now + 0.32, d: 0.28 },
        { f: 261.63, t: now + 0.64, d: 0.28 },
        { f: 246.94, t: now + 0.96, d: 0.55 },
      ];
      notes.forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(n.f, n.t);
        if (n.f === 246.94) {
          osc.frequency.linearRampToValueAtTime(220.0, n.t + n.d);
        }
        gain.gain.setValueAtTime(0.4, n.t);
        gain.gain.exponentialRampToValueAtTime(0.001, n.t + n.d);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(n.t);
        osc.stop(n.t + n.d);
      });
      break;
    }

    case 'def_ding': {
      // Ding triunfante (harmônicos metálicos)
      [1046.5, 2093.0].forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);
        gain.gain.setValueAtTime(idx === 0 ? 0.6 : 0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.6);
      });
      break;
    }

    case 'def_levelup': {
      // Level up 8-bit
      const arpeggio = [261.63, 329.63, 392.0, 523.25];
      arpeggio.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        const startT = now + idx * 0.08;
        osc.frequency.setValueAtTime(f, startT);
        gain.gain.setValueAtTime(0.35, startT);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.14);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(startT);
        osc.stop(startT + 0.15);
      });
      break;
    }

    default: {
      // Grilos ou bipe suave
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    }
  }
}

// Duração estimada (em ms) dos efeitos sonoros sintetizados nativos (com margem de reverberação para garantir que terminou)
export const SYNTH_SOUND_DURATIONS = {
  def_quack: 450,
  def_airhorn: 800,
  def_badumtss: 1200,
  def_cricket: 1100,
  def_applause: 1500,
  def_sadtrombone: 1800,
  def_ding: 1000,
  def_levelup: 800,
};

export function getSoundDuration(sound) {
  if (!sound) return 800;
  if (sound.isDefault || String(sound.id || '').startsWith('def_')) {
    return SYNTH_SOUND_DURATIONS[sound.id] || 600;
  }
  return 3000;
}

/**
 * Função unificada para tocar qualquer som do soundboard (nativo ou customizado via URL).
 * Recebe callback onEnded opcional para notificar o término da reprodução.
 */
export function playSoundboardAudio(sound, globalVolume = 1.0, onEnded = null) {
  if (!sound) {
    onEnded?.();
    return null;
  }
  const vol = Math.max(0.05, Math.min((sound.volume ?? 1.0) * globalVolume, 1.0));

  if (sound.isDefault || String(sound.id || '').startsWith('def_')) {
    playSynthesizedSound(sound.id, vol);
    const duration = SYNTH_SOUND_DURATIONS[sound.id] || 600;
    if (onEnded) {
      setTimeout(onEnded, duration);
    }
    return null;
  }

  if (sound.audio_url) {
    try {
      const audio = new Audio(sound.audio_url);
      audio.volume = vol;

      let called = false;
      const finish = () => {
        if (!called) {
          called = true;
          onEnded?.();
        }
      };

      audio.addEventListener('ended', finish, { once: true });
      audio.addEventListener('error', finish, { once: true });
      const fallbackTimer = setTimeout(finish, 20000);

      audio.play().catch(() => {
        clearTimeout(fallbackTimer);
        finish();
      });
      return audio;
    } catch {
      onEnded?.();
      return null;
    }
  } else {
    onEnded?.();
    return null;
  }
}
