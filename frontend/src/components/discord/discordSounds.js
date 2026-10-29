// discordSounds.js - Efeitos Sonoros Nativos do Discord sintetizados via Web Audio API
// 100% autônomo sem dependência de arquivos externos

const SOUND_MUTED_KEY = 'discord_sound_muted';
const SOUND_VOLUME_KEY = 'discord_sound_volume';

let audioCtx = null;

export function resetAudioContextForTesting() {
  audioCtx = null;
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  if (!audioCtx) {
    try {
      audioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

export function isSoundMuted() {
  try {
    return localStorage.getItem(SOUND_MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSoundMuted(muted) {
  try {
    localStorage.setItem(SOUND_MUTED_KEY, muted ? 'true' : 'false');
  } catch {}
}

export function toggleSoundMuted() {
  const next = !isSoundMuted();
  setSoundMuted(next);
  return next;
}

export function getSoundVolume() {
  try {
    const v = localStorage.getItem(SOUND_VOLUME_KEY);
    return v !== null ? parseFloat(v) : 0.4;
  } catch {
    return 0.4;
  }
}

export function setSoundVolume(volume) {
  try {
    const clamped = Math.max(0, Math.min(1, volume));
    localStorage.setItem(SOUND_VOLUME_KEY, String(clamped));
  } catch {}
}

/**
 * Toca o efeito sonoro especificado utilizando osciladores do Web Audio API.
 * Tipos: 'message' | 'mention' | 'voice_join' | 'voice_leave' | 'mute' | 'unmute'
 */
export function playDiscordSound(type) {
  if (isSoundMuted()) return false;

  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    const now = ctx.currentTime;
    const volume = getSoundVolume();

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);
    masterGain.connect(ctx.destination);

    switch (type) {
      case 'message': {
        // Bloop harmônico duplo suave característico do Discord
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        gain1.gain.setValueAtTime(0.4, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        osc1.connect(gain1);
        gain1.connect(masterGain);
        osc1.start(now);
        osc1.stop(now + 0.09);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.04);
        gain2.gain.setValueAtTime(0.001, now);
        gain2.gain.setValueAtTime(0.5, now + 0.04);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc2.connect(gain2);
        gain2.connect(masterGain);
        osc2.start(now + 0.04);
        osc2.stop(now + 0.16);
        break;
      }

      case 'mention': {
        // Arpeggio brilhante de sino de menção (@Você / @everyone)
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 -> E5 -> G5 -> C6
        notes.forEach((freq, idx) => {
          const startTime = now + idx * 0.06;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.setValueAtTime(0.45, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(startTime);
          osc.stop(startTime + 0.22);
        });
        break;
      }

      case 'voice_join': {
        // Sequência ascendente suave de entrada em canal de voz
        const notes = [329.63, 440.0, 554.37]; // E4 -> A4 -> C#5
        notes.forEach((freq, idx) => {
          const startTime = now + idx * 0.07;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.setValueAtTime(0.4, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(startTime);
          osc.stop(startTime + 0.18);
        });
        break;
      }

      case 'voice_leave': {
        // Sequência descendente suave de desconexão de canal de voz
        const notes = [554.37, 440.0, 329.63]; // C#5 -> A4 -> E4
        notes.forEach((freq, idx) => {
          const startTime = now + idx * 0.06;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, startTime);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.setValueAtTime(0.35, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(startTime);
          osc.stop(startTime + 0.15);
        });
        break;
      }

      case 'mute': {
        // Clique rápido descendente de mudo
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(480, now);
        osc.frequency.exponentialRampToValueAtTime(240, now + 0.08);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }

      case 'unmute': {
        // Clique rápido ascendente de desmudo
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(240, now);
        osc.frequency.exponentialRampToValueAtTime(480, now + 0.08);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }

      default:
        break;
    }

    return true;
  } catch {
    return false;
  }
}
