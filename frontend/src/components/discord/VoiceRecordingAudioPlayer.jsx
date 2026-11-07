import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, Loader2 } from 'lucide-react';

export default function VoiceRecordingAudioPlayer({
  recording,
  getMediaUrl,
  getHeaders,
}) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(recording?.duration_seconds || 0);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef(null);

  // Carrega o áudio via fetch para criar Blob local em memória
  // Isso resolve 100% o bug do Chromium onde WebM gravado sem duração EBML não toca via HTTP stream
  useEffect(() => {
    let isMounted = true;
    let createdUrl = null;

    async function loadAudioBlob() {
      if (!recording?.stream_url) return;
      try {
        setIsLoading(true);
        const headers = getHeaders ? getHeaders() : {};
        const fetchUrl = getMediaUrl ? getMediaUrl(recording.stream_url) : recording.stream_url;
        const res = await fetch(fetchUrl, { headers });
        if (!res || !res.ok) {
          throw new Error(`HTTP ${res?.status || 'network error'}`);
        }
        if (typeof res.blob === 'function') {
          const blob = await res.blob();
          if (isMounted) {
            createdUrl = URL.createObjectURL(blob);
            setBlobUrl(createdUrl);
          }
        }
      } catch (err) {
        console.warn('[AudioPlayer] Falha no carregamento via Blob, usando URL direta:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAudioBlob();

    return () => {
      isMounted = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [recording?.id, recording?.stream_url, getMediaUrl, getHeaders]);

  const effectiveDuration = duration > 0 ? duration : (recording?.duration_seconds || 0);

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || !isFinite(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isFinite(audio.duration) && audio.duration > 0) {
      setDuration(audio.duration);
    } else {
      // Fix oficial do Chromium para arquivos WebM sem cabeçalho EBML de duração
      audio.currentTime = 1e101;
      audio.ontimeupdate = function () {
        this.ontimeupdate = null;
        if (isFinite(this.duration) && this.duration > 0) {
          setDuration(this.duration);
        }
        this.currentTime = 0;
      };
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
    }
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (audio.paused) {
        await audio.play();
        setIsPlaying(true);
      } else {
        audio.pause();
        setIsPlaying(false);
      }
    } catch (err) {
      console.error('[AudioPlayer] Erro ao reproduzir:', err);
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audio) {
      audio.currentTime = newTime;
    }
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleReset = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const streamSrc = blobUrl || (getMediaUrl ? getMediaUrl(recording?.stream_url) : recording?.stream_url);

  return (
    <div className="voice-audio-custom-player" data-testid={`custom-audio-player-${recording?.id}`}>
      {/* Elemento de áudio nativo sincronizado */}
      <audio
        ref={audioRef}
        src={streamSrc}
        preload="auto"
        controls
        data-testid={`audio-player-${recording?.id}`}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="voice-audio-native-hidden"
      />

      {/* Controles Customizados Estilo Discord Neon */}
      <div className="voice-audio-controls-row">
        <button
          type="button"
          className="voice-audio-play-btn"
          onClick={togglePlay}
          disabled={isLoading}
          title={isPlaying ? 'Pausar Áudio' : 'Tocar Áudio'}
          data-testid={`btn-play-pause-${recording?.id}`}
        >
          {isLoading ? (
            <Loader2 size={16} className="spin-anim" />
          ) : isPlaying ? (
            <Pause size={16} />
          ) : (
            <Play size={16} style={{ marginLeft: 2 }} />
          )}
        </button>

        <button
          type="button"
          className="voice-audio-icon-btn"
          onClick={handleReset}
          title="Voltar ao início"
        >
          <RotateCcw size={14} />
        </button>

        {/* Barra de Progresso Interativa */}
        <div className="voice-audio-timeline-wrap">
          <input
            type="range"
            min="0"
            max={effectiveDuration > 0 ? effectiveDuration : 1}
            step="0.05"
            value={currentTime}
            onChange={handleSeek}
            className="voice-audio-timeline-slider"
            data-testid={`timeline-slider-${recording?.id}`}
          />
          <div className="voice-audio-time-display">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(effectiveDuration)}</span>
          </div>
        </div>

        <button
          type="button"
          className="voice-audio-icon-btn"
          onClick={toggleMute}
          title={isMuted ? 'Ativar Som' : 'Silenciar'}
        >
          {isMuted ? <VolumeX size={15} color="#ed4245" /> : <Volume2 size={15} />}
        </button>
      </div>
    </div>
  );
}
