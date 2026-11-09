import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Sparkles, Trash2, Pencil } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { DEFAULT_SOUNDBOARD_SOUNDS, playSoundboardAudio, getSoundDuration } from './soundboardSynth';
import SoundboardHeader from './SoundboardHeader';
import SoundboardDeleteModal from './SoundboardDeleteModal';
import SoundboardEditModal from './SoundboardEditModal';
import '../../styles/discord-soundboard.css';

export default function SoundboardPopover({
  isOpen,
  onClose,
  channelId,
  serverId,
  token: propToken,
  serverSounds = [],
  onSoundsChange,
  onTriggerSound,
  isDeafened = false,
  currentUser,
  currentUserRole,
  canManageSounds,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('discord_soundboard_volume');
    return saved !== null ? parseFloat(saved) : 0.8;
  });

  // Regra de clique único: só pode tocar um som por vez e tem que esperar terminar
  const [playingSoundId, setPlayingSoundId] = useState(null);
  const activeAudioRef = useRef(null);

  // Estados de formulários e popups
  const [showImportForm, setShowImportForm] = useState(false);
  const [soundName, setSoundName] = useState('');
  const [soundEmoji, setSoundEmoji] = useState('🔊');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [soundToEdit, setSoundToEdit] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [soundToDelete, setSoundToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const isPlayingLockRef = useRef(false);

  let addToast = () => {};
  try {
    const toastCtx = useToast();
    if (toastCtx?.addToast) addToast = toastCtx.addToast;
  } catch {}

  const authToken = propToken || localStorage.getItem('auth_token') || localStorage.getItem('token') || '';

  // Permissão estrita: Apenas administradores ou donos do servidor podem gerenciar sons
  const canManage = useMemo(() => {
    if (canManageSounds !== undefined) return Boolean(canManageSounds);
    if (currentUser?.role === 'superadmin' || currentUser?.is_superuser) return true;
    if (currentUserRole === 'OWNER' || currentUserRole === 'ADMIN' || currentUserRole === 'superadmin') return true;
    return false;
  }, [canManageSounds, currentUser, currentUserRole]);

  useEffect(() => {
    if (!isOpen) {
      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.pause();
          activeAudioRef.current = null;
        } catch (_) {}
      }
      isPlayingLockRef.current = false;
      setPlayingSoundId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !showImportForm) {
      const timer = setTimeout(() => searchInputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, showImportForm]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !soundToDelete && !soundToEdit) {
        onClose?.();
      }
    };
    const handleClickOutside = (e) => {
      if (soundToDelete || soundToEdit) return;
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, soundToDelete, soundToEdit]);

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    localStorage.setItem('discord_soundboard_volume', String(newVol));
  };

  const filteredDefaults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return DEFAULT_SOUNDBOARD_SOUNDS;
    return DEFAULT_SOUNDBOARD_SOUNDS.filter((s) => s.name.toLowerCase().includes(q));
  }, [searchQuery]);

  const filteredServerSounds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!Array.isArray(serverSounds)) return [];
    if (!q) return serverSounds;
    return serverSounds.filter((s) => s.name.toLowerCase().includes(q));
  }, [searchQuery, serverSounds]);

  // Regra de clique único: bloqueia novos toques até o áudio atual terminar de tocar
  const handleSoundClick = (sound) => {
    if (isPlayingLockRef.current || playingSoundId) return;
    isPlayingLockRef.current = true;
    setPlayingSoundId(sound.id);

    const onAudioFinished = () => {
      isPlayingLockRef.current = false;
      setPlayingSoundId(null);
      activeAudioRef.current = null;
    };

    if (!isDeafened) {
      const audioInstance = playSoundboardAudio(sound, volume, onAudioFinished);
      activeAudioRef.current = audioInstance;
    } else {
      const dur = getSoundDuration(sound);
      setTimeout(onAudioFinished, dur);
    }

    if (typeof onTriggerSound === 'function') {
      onTriggerSound(sound, volume);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|webm|m4a)$/i)) {
      addToast('Formato inválido. Selecione MP3, WAV, OGG ou M4A.', 'warning');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      addToast('O arquivo excede o limite máximo de 2 MB para o soundboard.', 'warning');
      return;
    }

    setSelectedFile(file);
    if (!soundName.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, '').slice(0, 32);
      setSoundName(baseName);
    }
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!serverId) {
      addToast('Servidor não identificado para importar o som.', 'error');
      return;
    }
    if (!canManage) {
      addToast('Apenas administradores podem adicionar sons ao soundboard.', 'error');
      return;
    }
    if (!selectedFile) {
      addToast('Selecione um arquivo de áudio para importar.', 'warning');
      return;
    }
    const cleanName = soundName.trim();
    if (cleanName.length < 2) {
      addToast('O nome do som deve ter pelo menos 2 caracteres.', 'warning');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('name', cleanName);
      formData.append('emoji', (soundEmoji || '🔊').trim());
      formData.append('volume', String(volume));
      formData.append('file', selectedFile);

      const res = await fetch(`/api/v1/discord/servers/${serverId}/soundboard`, {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Não foi possível importar o som.');
      }

      const newSound = await res.json();
      if (typeof onSoundsChange === 'function') {
        onSoundsChange((prev) => [...(Array.isArray(prev) ? prev : []), newSound]);
      }
      setSoundName('');
      setSoundEmoji('🔊');
      setSelectedFile(null);
      setShowImportForm(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      addToast(`Som "${cleanName}" importado com sucesso!`, 'success');
    } catch (err) {
      addToast(err.message || 'Falha ao importar som.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmEditSound = async (updatedData) => {
    if (!soundToEdit || !serverId) return;
    if (!canManage) {
      addToast('Apenas administradores podem editar sons do soundboard.', 'error');
      return;
    }
    try {
      setSavingEdit(true);
      const res = await fetch(`/api/v1/discord/servers/${serverId}/soundboard/${soundToEdit.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          name: updatedData.name,
          emoji: updatedData.emoji,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Erro ao atualizar som.');
      }

      const updatedSound = await res.json();
      if (typeof onSoundsChange === 'function') {
        onSoundsChange((prev) =>
          (Array.isArray(prev) ? prev : []).map((s) => (s.id === updatedSound.id ? updatedSound : s))
        );
      }
      addToast(`Som renomeado para "${updatedSound.name}" com sucesso!`, 'success');
      setSoundToEdit(null);
    } catch (err) {
      addToast(err.message || 'Falha ao editar som.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDeleteSound = async () => {
    if (!soundToDelete || !serverId) return;
    if (!canManage) {
      addToast('Apenas administradores podem excluir sons do soundboard.', 'error');
      return;
    }
    try {
      setDeleting(true);
      const res = await fetch(`/api/v1/discord/servers/${serverId}/soundboard/${soundToDelete.id}`, {
        method: 'DELETE',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Erro ao excluir som.');
      }
      if (typeof onSoundsChange === 'function') {
        onSoundsChange((prev) => (Array.isArray(prev) ? prev.filter((s) => s.id !== soundToDelete.id) : []));
      }
      addToast(`Som "${soundToDelete.name}" removido do soundboard!`, 'success');
      setSoundToDelete(null);
    } catch (err) {
      addToast(err.message || 'Falha ao remover som.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="discord-soundboard-popover"
      data-testid="discord-soundboard-popover"
      onClick={(e) => e.stopPropagation()}
    >
      <SoundboardHeader
        serverId={serverId}
        canManage={canManage}
        showImportForm={showImportForm}
        setShowImportForm={setShowImportForm}
        onClose={onClose}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchInputRef={searchInputRef}
        volume={volume}
        handleVolumeChange={handleVolumeChange}
        soundName={soundName}
        setSoundName={setSoundName}
        soundEmoji={soundEmoji}
        setSoundEmoji={setSoundEmoji}
        selectedFile={selectedFile}
        uploading={uploading}
        fileInputRef={fileInputRef}
        handleFileChange={handleFileChange}
        handleImportSubmit={handleImportSubmit}
      />

      {/* Conteúdo com Grid de Sons */}
      <div className="soundboard-popover-body" data-testid="soundboard-popover-body">
        {/* Sons do Servidor */}
        {filteredServerSounds.length > 0 && (
          <div className="soundboard-section" data-testid="soundboard-server-section">
            <div className="soundboard-section-title">
              <Sparkles size={14} color="#f0b232" />
              <span>Sons Importados ({filteredServerSounds.length})</span>
            </div>
            <div className="soundboard-grid">
              {filteredServerSounds.map((sound) => {
                const isPlaying = playingSoundId === sound.id;
                return (
                  <div
                    key={sound.id}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      minWidth: 0,
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <button
                      type="button"
                      disabled={Boolean(playingSoundId)}
                      className={`soundboard-card ${isPlaying ? 'playing' : ''}`}
                      style={{
                        width: '100%',
                        minWidth: 0,
                        paddingRight: canManage ? '50px' : '8px',
                        boxSizing: 'border-box',
                      }}
                      onClick={() => handleSoundClick(sound)}
                      title={
                        isPlaying
                          ? `Tocando ${sound.name}... aguarde terminar.`
                          : playingSoundId
                          ? 'Aguarde o som atual terminar para tocar outro.'
                          : `Tocar ${sound.name}`
                      }
                      data-testid={`soundboard-play-server-${sound.id}`}
                    >
                      <span className="soundboard-card-emoji">{sound.emoji || '🔊'}</span>
                      <span className="soundboard-card-name">
                        {sound.name}
                        {isPlaying && ' 🎵'}
                      </span>
                    </button>

                    {canManage && (
                      <div
                        style={{
                          position: 'absolute',
                          right: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                          zIndex: 2,
                        }}
                      >
                        <button
                          type="button"
                          disabled={Boolean(playingSoundId)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSoundToEdit(sound);
                          }}
                          title={`Editar nome de ${sound.name}`}
                          data-testid={`soundboard-edit-btn-${sound.id}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#949ba4',
                            cursor: playingSoundId ? 'not-allowed' : 'pointer',
                            padding: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '4px',
                          }}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(playingSoundId)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSoundToDelete(sound);
                          }}
                          title={`Excluir ${sound.name}`}
                          data-testid={`soundboard-delete-btn-${sound.id}`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#949ba4',
                            cursor: playingSoundId ? 'not-allowed' : 'pointer',
                            padding: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '4px',
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sons Padrão do Discord */}
        <div className="soundboard-section" data-testid="soundboard-default-section">
          <div className="soundboard-section-title">
            <span>Sons Padrão</span>
          </div>
          <div className="soundboard-grid">
            {filteredDefaults.map((sound) => {
              const isPlaying = playingSoundId === sound.id;
              return (
                <button
                  key={sound.id}
                  type="button"
                  disabled={Boolean(playingSoundId)}
                  className={`soundboard-card ${isPlaying ? 'playing' : ''}`}
                  onClick={() => handleSoundClick(sound)}
                  title={
                    isPlaying
                      ? `Tocando ${sound.name}... aguarde terminar.`
                      : playingSoundId
                      ? 'Aguarde o som atual terminar para tocar outro.'
                      : `Tocar ${sound.name}`
                  }
                  data-testid={`soundboard-play-default-${sound.id}`}
                >
                  <span className="soundboard-card-emoji">{sound.emoji}</span>
                  <span className="soundboard-card-name">
                    {sound.name}
                    {isPlaying && ' 🎵'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {filteredDefaults.length === 0 && filteredServerSounds.length === 0 && (
          <div className="soundboard-empty" data-testid="soundboard-empty">
            <span>Nenhum som encontrado para "{searchQuery}"</span>
          </div>
        )}
      </div>

      <SoundboardEditModal
        soundToEdit={soundToEdit}
        saving={savingEdit}
        onClose={() => setSoundToEdit(null)}
        onSave={handleConfirmEditSound}
      />

      <SoundboardDeleteModal
        soundToDelete={soundToDelete}
        deleting={deleting}
        onClose={() => setSoundToDelete(null)}
        onConfirm={handleConfirmDeleteSound}
      />
    </div>
  );
}
