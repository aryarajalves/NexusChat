import React, { useState, useEffect, useRef } from 'react';
import { Music, Upload, Trash2, Play, Pause, AlertTriangle, Loader2, Volume2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { playSoundboardAudio } from './soundboardSynth';
import '../../styles/discord-soundboard.css';

export default function ServerSoundboardTab({ server, currentUser }) {
  const [sounds, setSounds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [soundName, setSoundName] = useState('');
  const [soundEmoji, setSoundEmoji] = useState('🔊');
  const [soundVolume, setSoundVolume] = useState(1.0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [playingId, setPlayingId] = useState(null);

  // Popup de exclusão
  const [soundToDelete, setSoundToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef(null);

  let addToast = () => {};
  try {
    const toastCtx = useToast();
    if (toastCtx?.addToast) addToast = toastCtx.addToast;
  } catch {}

  const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || '';

  const fetchSounds = async () => {
    if (!server?.id || !token) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/discord/servers/${server.id}/soundboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSounds(Array.isArray(data) ? data : []);
      }
    } catch {
      addToast('Não foi possível carregar os sons do servidor.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSounds();
  }, [server?.id]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm)$/i)) {
      addToast('Formato inválido. Selecione MP3, WAV ou OGG.', 'warning');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      addToast('O arquivo excede o limite máximo de 2 MB para sons.', 'warning');
      return;
    }

    setSelectedFile(file);
    if (!soundName) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').slice(0, 32);
      setSoundName(baseName);
    }
  };

  const handleUploadSound = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      addToast('Selecione um arquivo de áudio.', 'warning');
      return;
    }

    const cleanName = soundName.trim();
    if (!cleanName || cleanName.length < 2) {
      addToast('O nome do som deve ter pelo menos 2 caracteres.', 'warning');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('name', cleanName);
      formData.append('emoji', soundEmoji || '🔊');
      formData.append('volume', String(soundVolume));
      formData.append('file', selectedFile);

      const res = await fetch(`/api/v1/discord/servers/${server.id}/soundboard`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Erro ao cadastrar som no soundboard.');
      }

      const newSound = await res.json();
      setSounds((prev) => [...prev, newSound]);
      setSoundName('');
      setSoundEmoji('🔊');
      setSoundVolume(1.0);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      addToast(`Som "${cleanName}" adicionado ao soundboard!`, 'success');
    } catch (err) {
      addToast(err.message || 'Falha ao cadastrar som.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!soundToDelete) return;
    try {
      setDeleting(true);
      const res = await fetch(`/api/v1/discord/servers/${server.id}/soundboard/${soundToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Erro ao excluir som.');
      }

      setSounds((prev) => prev.filter((s) => s.id !== soundToDelete.id));
      addToast(`Som "${soundToDelete.name}" removido com sucesso!`, 'success');
      setSoundToDelete(null);
    } catch (err) {
      addToast(err.message || 'Falha ao excluir som.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handlePreviewSound = (sound) => {
    if (playingId === sound.id) {
      setPlayingId(null);
      return;
    }
    setPlayingId(sound.id);
    playSoundboardAudio(sound, 1.0);
    setTimeout(() => setPlayingId(null), 3000);
  };

  return (
    <div className="server-soundboard-tab" data-testid="server-soundboard-tab">
      <div className="server-soundboard-header">
        <h3 className="server-tab-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Music size={20} color="#5865f2" /> Soundboard do Servidor
        </h3>
        <p className="server-tab-desc">
          Adicione efeitos sonoros personalizados que qualquer membro pode tocar durante chamadas de voz neste servidor.
        </p>
      </div>

      {/* Formulário de Upload */}
      <form onSubmit={handleUploadSound} className="server-sound-upload-card" data-testid="upload-sound-form">
        <div className="server-sound-upload-grid">
          <div
            className="server-sound-dropzone"
            onClick={() => fileInputRef.current?.click()}
            data-testid="sound-file-dropzone"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.ogg,.webm"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              data-testid="sound-file-input"
            />
            {selectedFile ? (
              <div className="server-sound-file-selected">
                <Music size={24} color="#23a55a" />
                <span>{selectedFile.name}</span>
                <small>{(selectedFile.size / 1024).toFixed(1)} KB</small>
              </div>
            ) : (
              <div className="server-sound-dropzone-empty">
                <Upload size={24} color="#5865f2" />
                <span>Carregar Áudio (MP3, WAV, OGG)</span>
                <small>Máximo 2 MB</small>
              </div>
            )}
          </div>

          <div className="server-sound-inputs-col">
            <div className="server-sound-row">
              <div style={{ width: 80 }}>
                <label className="server-field-label">Emoji</label>
                <input
                  type="text"
                  className="server-input server-sound-emoji-input"
                  value={soundEmoji}
                  onChange={(e) => setSoundEmoji(e.target.value)}
                  maxLength={4}
                  data-testid="sound-emoji-input"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label className="server-field-label">Nome do Som</label>
                <input
                  type="text"
                  className="server-input"
                  placeholder="Ex: Buzina, Risada..."
                  value={soundName}
                  onChange={(e) => setSoundName(e.target.value)}
                  maxLength={32}
                  data-testid="sound-name-input"
                />
              </div>
            </div>

            <div className="server-sound-vol-row">
              <label className="server-field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Volume2 size={14} /> Volume Padrão: {Math.round(soundVolume * 100)}%
              </label>
              <input
                type="range"
                min="0.2"
                max="1.0"
                step="0.05"
                value={soundVolume}
                onChange={(e) => setSoundVolume(parseFloat(e.target.value))}
                className="soundboard-vol-slider"
                data-testid="sound-volume-input"
              />
            </div>

            <button
              type="submit"
              disabled={uploading || !selectedFile || !soundName.trim()}
              className="server-sound-submit-btn"
              data-testid="submit-sound-btn"
            >
              {uploading ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
              <span>{uploading ? 'Enviando...' : 'Adicionar ao Soundboard'}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Lista de Sons Existentes */}
      <div className="server-sounds-list-section">
        <h4 className="server-sound-subheading">Sons Cadastrados ({sounds.length})</h4>
        {loading ? (
          <div className="server-sound-loading">
            <Loader2 size={24} className="spin" /> Carregando sons...
          </div>
        ) : sounds.length === 0 ? (
          <div className="server-sound-empty" data-testid="sounds-empty">
            Nenhum som customizado foi adicionado a este servidor ainda.
          </div>
        ) : (
          <div className="server-sounds-grid" data-testid="sounds-grid">
            {sounds.map((sound) => (
              <div key={sound.id} className="server-sound-item-card" data-testid={`sound-card-${sound.id}`}>
                <span className="server-sound-item-emoji">{sound.emoji || '🔊'}</span>
                <div className="server-sound-item-info">
                  <strong className="server-sound-item-name">{sound.name}</strong>
                </div>
                <div className="server-sound-item-actions">
                  <button
                    type="button"
                    className="server-sound-action-btn"
                    onClick={() => handlePreviewSound(sound)}
                    title="Ouvir som"
                    data-testid={`preview-sound-${sound.id}`}
                  >
                    {playingId === sound.id ? <Pause size={14} color="#5865f2" /> : <Play size={14} />}
                  </button>
                  <button
                    type="button"
                    className="server-sound-delete-btn"
                    onClick={() => setSoundToDelete(sound)}
                    title="Excluir Som"
                    data-testid={`delete-sound-btn-${sound.id}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Popup de Confirmação de Deleção Centralizado */}
      {soundToDelete && (
        <div className="modal-backdrop" data-testid="delete-sound-backdrop">
          <div
            className="delete-confirm-popup"
            onClick={(e) => e.stopPropagation()}
            data-testid="delete-sound-modal"
          >
            <h4 className="delete-confirm-title">
              <AlertTriangle size={20} color="#f87171" /> Excluir Som "{soundToDelete.name}"?
            </h4>
            <p className="delete-confirm-message">
              Tem certeza de que deseja apagar o som <strong>"{soundToDelete.name}"</strong> do soundboard? Os membros não poderão mais tocá-lo nas chamadas de voz deste servidor.
            </p>
            <div className="delete-confirm-footer">
              <button
                type="button"
                className="discord-btn discord-btn-secondary"
                onClick={() => setSoundToDelete(null)}
                disabled={deleting}
                data-testid="cancel-delete-sound-btn"
              >
                <span>Cancelar</span>
              </button>
              <button
                type="button"
                className="discord-btn discord-btn-danger"
                onClick={handleConfirmDelete}
                disabled={deleting}
                data-testid="confirm-delete-sound-btn"
              >
                {deleting ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
                <span>{deleting ? 'Excluindo...' : 'Sim, Excluir'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
