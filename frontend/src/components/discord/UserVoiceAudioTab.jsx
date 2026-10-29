import React, { useState, useEffect } from 'react';
import { Mic, Headphones, Volume2, VolumeX, Play } from 'lucide-react';
import {
  getSoundVolume,
  setSoundVolume,
  isSoundMuted,
  setSoundMuted,
  toggleSoundMuted,
  playDiscordSound,
} from './discordSounds';
import { useToast } from '../../context/ToastContext';

export default function UserVoiceAudioTab() {
  const [volume, setVolumeState] = useState(Math.round(getSoundVolume() * 100));
  const [muted, setMutedState] = useState(isSoundMuted());
  const [inputDevices, setInputDevices] = useState([
    { deviceId: 'default', label: 'Microfone Padrão do Sistema' },
  ]);
  const [outputDevices, setOutputDevices] = useState([
    { deviceId: 'default', label: 'Alto-falante Padrão do Sistema' },
  ]);
  const [selectedInput, setSelectedInput] = useState('default');
  const [selectedOutput, setSelectedOutput] = useState('default');

  const { addToast } = useToast();

  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const inputs = devices.filter((d) => d.kind === 'audioinput');
          const outputs = devices.filter((d) => d.kind === 'audiooutput');
          if (inputs.length > 0) {
            setInputDevices(
              inputs.map((d, i) => ({
                deviceId: d.deviceId || String(i),
                label: d.label || `Microfone ${i + 1}`,
              }))
            );
          }
          if (outputs.length > 0) {
            setOutputDevices(
              outputs.map((d, i) => ({
                deviceId: d.deviceId || String(i),
                label: d.label || `Alto-falante ${i + 1}`,
              }))
            );
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleVolumeChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setVolumeState(val);
    setSoundVolume(val / 100);
  };

  const handleToggleMute = () => {
    const next = toggleSoundMuted();
    setMutedState(next);
    if (next) {
      addToast('Efeitos sonoros desativados.', 'info');
    } else {
      playDiscordSound('unmute');
      addToast('Efeitos sonoros ativados.', 'success');
    }
  };

  const handleTestSound = (type, label) => {
    if (muted) {
      addToast('Ative os efeitos sonoros para ouvir o teste.', 'info');
      return;
    }
    playDiscordSound(type);
    addToast(`Reproduzindo teste: ${label}`, 'success');
  };

  return (
    <div className="server-tab-content" data-testid="user-voice-audio-tab">
      <h3 className="server-tab-title">Voz & Efeitos Sonoros</h3>
      <p className="server-tab-desc">Configure seus dispositivos de áudio e os efeitos sonoros do aplicativo.</p>

      {/* Dispositivos de Áudio */}
      <div className="server-images-row" style={{ marginTop: '10px' }}>
        <div className="server-input-group" style={{ flex: 1 }}>
          <label className="server-field-label" htmlFor="input-device-select">Dispositivo de Entrada (Microfone)</label>
          <select
            id="input-device-select"
            className="discord-role-select"
            style={{ width: '100%', padding: '10px' }}
            value={selectedInput}
            onChange={(e) => setSelectedInput(e.target.value)}
            data-testid="input-device-select"
          >
            {inputDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        <div className="server-input-group" style={{ flex: 1 }}>
          <label className="server-field-label" htmlFor="output-device-select">Dispositivo de Saída (Alto-falante)</label>
          <select
            id="output-device-select"
            className="discord-role-select"
            style={{ width: '100%', padding: '10px' }}
            value={selectedOutput}
            onChange={(e) => setSelectedOutput(e.target.value)}
            data-testid="output-device-select"
          >
            {outputDevices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Volume dos Efeitos Sonoros */}
      <div className="user-audio-volume-section" style={{ marginTop: '30px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <label className="server-field-label" htmlFor="sound-volume-slider">Volume dos Efeitos Sonoros</label>
          <span style={{ color: '#dbdee1', fontSize: '13px', fontWeight: 600 }} data-testid="volume-label">
            {volume}%
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '10px' }}>
          <Volume2 size={20} color="#949ba4" />
          <input
            id="sound-volume-slider"
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            className="discord-range-slider"
            style={{ flex: 1, accentColor: '#5865f2', cursor: 'pointer' }}
            data-testid="sound-volume-slider"
          />
        </div>
      </div>

      {/* Silenciar Efeitos Sonoros Switch */}
      <div className="role-toggles-section" style={{ marginTop: '24px' }}>
        <label className="role-toggle-item">
          <input
            type="checkbox"
            checked={muted}
            onChange={handleToggleMute}
            data-testid="mute-sounds-checkbox"
          />
          <div>
            <span className="role-toggle-label">Silenciar todos os efeitos sonoros</span>
            <span className="role-toggle-desc">Desativa sons de mensagens, menções e canais de voz.</span>
          </div>
        </label>
      </div>

      {/* Teste dos Efeitos Sonoros Nativos */}
      <div style={{ marginTop: '32px' }}>
        <h4 className="server-editor-title">Testar Efeitos Sonoros Web Audio</h4>
        <p className="server-field-help">Clique nos botões abaixo para ouvir os sintetizadores sonoros em tempo real:</p>

        <div className="sound-test-grid" data-testid="sound-test-grid">
          <button
            type="button"
            className="discord-btn discord-btn-secondary"
            onClick={() => handleTestSound('message', 'Mensagem Recebida')}
            data-testid="test-sound-message-btn"
          >
            <Play size={14} /> Som de Mensagem
          </button>
          <button
            type="button"
            className="discord-btn discord-btn-secondary"
            onClick={() => handleTestSound('mention', 'Menção Direta')}
            data-testid="test-sound-mention-btn"
          >
            <Play size={14} /> Som de Menção (@Você)
          </button>
          <button
            type="button"
            className="discord-btn discord-btn-secondary"
            onClick={() => handleTestSound('voice_join', 'Entrada em Canal de Voz')}
            data-testid="test-sound-voice-join-btn"
          >
            <Play size={14} /> Conexão de Voz
          </button>
          <button
            type="button"
            className="discord-btn discord-btn-secondary"
            onClick={() => handleTestSound('voice_leave', 'Saída de Canal de Voz')}
            data-testid="test-sound-voice-leave-btn"
          >
            <Play size={14} /> Desconexão de Voz
          </button>
        </div>
      </div>
    </div>
  );
}
