import React, { useState, useRef, useEffect } from 'react';
import { Radio, Mic, Video, Square, Download, Camera } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import VoiceRecordingModal from './VoiceRecordingModal';
import WebcamPipOverlay from './WebcamPipOverlay';
import { createCompositeStream, PIP_CORNERS } from './videoCompositeUtils';

export default function VoiceChannelRecorder({
  channel,
  audioStream,
  screenStream,
  cameraStream,
  isCameraOn = false,
  currentUserName = 'Você',
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordType, setRecordType] = useState('audio'); // 'audio' | 'video'
  const [includeWebcam, setIncludeWebcam] = useState(true);
  const [pipPosition, setPipPosition] = useState({
    corner: PIP_CORNERS.BOTTOM_RIGHT,
    customCoords: null,
  });
  const [duration, setDuration] = useState(0);
  const [recordedUrl, setRecordedUrl] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { addToast } = useToast();
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const recordingStreamRef = useRef(null);
  const menuRef = useRef(null);
  const compositeStopRef = useRef(null);
  const pipPositionRef = useRef(pipPosition);
  pipPositionRef.current = pipPosition;

  // Fecha menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Limpa recursos ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
      if (compositeStopRef.current) {
        compositeStopRef.current();
        compositeStopRef.current = null;
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [recordedUrl]);

  const startTimer = () => {
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
  };

  const handleStartAudioRecording = async () => {
    setIsMenuOpen(false);
    try {
      let stream = audioStream;
      if (!stream || stream.getAudioTracks().length === 0) {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Dispositivo de gravação de áudio não suportado.');
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      recordingStreamRef.current = stream;
      chunksRef.current = [];

      const options = { mimeType: 'audio/webm' };
      let recorder;
      try {
        recorder = new MediaRecorder(stream, options);
      } catch {
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stopTimer();
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setIsRecording(false);
        setIsModalOpen(true);
        addToast('Gravação de áudio finalizada! Revise e exporte.', 'info');
      };

      recorder.start(500);
      mediaRecorderRef.current = recorder;
      setRecordType('audio');
      setIsRecording(true);
      startTimer();
      addToast('Gravando áudio da conversa...', 'info');
    } catch (err) {
      addToast(err.message || 'Erro ao iniciar gravação de áudio.', 'error');
    }
  };

  const handleStartVideoRecording = async () => {
    setIsMenuOpen(false);
    try {
      let stream = screenStream;
      if (!stream || stream.getVideoTracks().length === 0) {
        if (!navigator?.mediaDevices?.getDisplayMedia) {
          throw new Error('Captura de vídeo / tela não suportada neste navegador.');
        }
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
      }

      let recordingStream = stream;
      const hasActiveCamera = isCameraOn || (cameraStream && cameraStream.getVideoTracks().length > 0);

      // Composição Picture-in-Picture se a webcam estiver ativada
      if (includeWebcam && hasActiveCamera && cameraStream) {
        const composite = createCompositeStream({
          screenStream: stream,
          cameraStream,
          audioStream,
          getPipPosition: () => pipPositionRef.current,
        });
        recordingStream = composite.stream;
        compositeStopRef.current = composite.stop;
      } else {
        // Se temos microfone separado, adiciona track ao stream de tela
        if (audioStream && audioStream.getAudioTracks().length > 0) {
          const audioTrack = audioStream.getAudioTracks()[0];
          if (!recordingStream.getAudioTracks().some((t) => t.id === audioTrack.id)) {
            recordingStream.addTrack(audioTrack);
          }
        }
      }

      // Para se o usuário clicar no botão nativo "Parar Compartilhamento"
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            handleStopRecording();
          }
        };
      }

      recordingStreamRef.current = recordingStream;
      chunksRef.current = [];

      const options = { mimeType: 'video/webm' };
      let recorder;
      try {
        recorder = new MediaRecorder(recordingStream, options);
      } catch {
        recorder = new MediaRecorder(recordingStream);
      }

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stopTimer();
        if (compositeStopRef.current) {
          compositeStopRef.current();
          compositeStopRef.current = null;
        }
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setIsRecording(false);
        setIsModalOpen(true);
        addToast('Gravação de vídeo finalizada! Revise e exporte.', 'info');
      };

      recorder.start(500);
      mediaRecorderRef.current = recorder;
      setRecordType('video');
      setIsRecording(true);
      startTimer();
      addToast(
        includeWebcam && hasActiveCamera
          ? 'Gravando tela com Webcam PiP móvel e áudio...'
          : 'Gravando tela e áudio do canal...',
        'info'
      );
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        addToast(err.message || 'Erro ao iniciar gravação de vídeo.', 'error');
      }
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Erro ao parar gravador:', err);
      }
    }
  };

  const handleExportFile = (filename) => {
    if (!recordedUrl) return;
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addToast('Gravação exportada com sucesso para o seu computador!', 'success');
    setIsModalOpen(false);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedUrl(null);
    }
    setRecordedBlob(null);
    setDuration(0);
  };

  const hasCameraAvailable = isCameraOn || (cameraStream && cameraStream.getVideoTracks().length > 0);

  return (
    <div className="voice-recorder-wrap" ref={menuRef} data-testid="voice-recorder-controls">
      {/* Menu Dropdown de Seleção de Tipo de Gravação */}
      {isMenuOpen && !isRecording && (
        <div className="voice-recorder-menu" data-testid="voice-recorder-menu">
          <div className="voice-recorder-menu-header">
            <span>Gravar Canal de Voz</span>
          </div>

          <button
            type="button"
            className="voice-recorder-menu-item"
            onClick={handleStartAudioRecording}
            data-testid="start-audio-recording-btn"
          >
            <div className="voice-recorder-menu-icon-wrap audio">
              <Mic size={16} />
            </div>
            <div className="voice-recorder-menu-text">
              <strong>Gravar Apenas Áudio</strong>
              <small>Grava a conversa e vozes do canal (WebM Audio)</small>
            </div>
          </button>

          <button
            type="button"
            className="voice-recorder-menu-item"
            onClick={handleStartVideoRecording}
            data-testid="start-video-recording-btn"
          >
            <div className="voice-recorder-menu-icon-wrap video">
              <Video size={16} />
            </div>
            <div className="voice-recorder-menu-text">
              <strong>Gravar Vídeo com Áudio</strong>
              <small>Grava a transmissão da tela e áudio (WebM Video)</small>
            </div>
          </button>

          {/* Opção de incluir Webcam no Vídeo se a câmera estiver ligada */}
          {hasCameraAvailable && (
            <div
              className="voice-recorder-pip-option"
              data-testid="toggle-include-webcam-box"
              style={{
                marginTop: '4px',
                padding: '6px 10px',
                borderTop: '1px solid #35373c',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '11.5px',
                  color: '#dbdee1',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={includeWebcam}
                  onChange={(e) => setIncludeWebcam(e.target.checked)}
                  data-testid="include-webcam-checkbox"
                />
                <Camera size={13} color="#5865f2" />
                <span>Incluir Webcam (PiP Móvel)</span>
              </label>
            </div>
          )}
        </div>
      )}

      {/* Botão no Dock de Voz */}
      {isRecording ? (
        <div className="voice-recording-active-dock" data-testid="voice-recording-active-dock">
          <div className="voice-recording-pulse-badge">
            <span className="voice-recording-dot" />
            <span className="voice-recording-type-label">
              REC ({recordType === 'video' ? 'VÍDEO' : 'ÁUDIO'})
            </span>
            <span className="voice-recording-timer" data-testid="recording-timer">
              {formatTimer(duration)}
            </span>
          </div>
          <button
            type="button"
            className="voice-dock-btn btn-stop-recording"
            onClick={handleStopRecording}
            title="Parar Gravação e Exportar"
            data-testid="stop-recording-btn"
          >
            <Square size={16} />
            <span>Parar</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`voice-dock-btn voice-record-btn ${isMenuOpen ? 'btn-active-blurple' : ''}`}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          title="Gravar Áudio ou Vídeo do Canal"
          data-testid="voice-record-btn"
        >
          <Radio size={20} />
        </button>
      )}

      {/* Overlay Flutuante da Webcam PiP durante gravação de vídeo */}
      {isRecording &&
        recordType === 'video' &&
        includeWebcam &&
        hasCameraAvailable &&
        cameraStream && (
          <WebcamPipOverlay
            cameraStream={cameraStream}
            pipPosition={pipPosition}
            onPositionChange={(newPos) => {
              setPipPosition(newPos);
              pipPositionRef.current = newPos;
            }}
            isRecording={true}
            userName={currentUserName}
          />
        )}

      {/* Modal de Prévia e Exportação */}
      <VoiceRecordingModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        channelName={channel?.name || 'voz'}
        recordType={recordType}
        recordedUrl={recordedUrl}
        recordedBlob={recordedBlob}
        durationSeconds={duration}
        onExport={handleExportFile}
      />
    </div>
  );
}
