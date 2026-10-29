import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Send, Loader2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export default function ChatVoiceRecorder({ onCancel, onFinish }) {
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const isCanceledRef = useRef(false);

  const { addToast } = useToast();

  useEffect(() => {
    let isMounted = true;

    async function startRecording() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Navegador não suporta gravação de áudio.');
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        chunksRef.current = [];

        let mimeType = 'audio/webm';
        if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
            mimeType = 'audio/ogg;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
          }
        }

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          if (isCanceledRef.current) return;

          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const ext = recorder.mimeType?.includes('ogg') ? 'ogg' : recorder.mimeType?.includes('mp4') ? 'm4a' : 'webm';
          const audioFile = new File([blob], `audio_${Date.now()}.${ext}`, {
            type: recorder.mimeType || 'audio/webm',
          });

          if (onFinish) {
            onFinish(audioFile, recordingSeconds);
          }
        };

        recorder.start(100);

        timerRef.current = setInterval(() => {
          setRecordingSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        if (isMounted) {
          addToast('Não foi possível acessar o microfone. Verifique as permissões.', 'error');
          if (onCancel) onCancel();
        }
      }
    }

    startRecording();

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleCancelRecording = () => {
    isCanceledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (_) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    if (onCancel) onCancel();
  };

  const handleSendRecording = () => {
    setIsFinishing(true);
    if (timerRef.current) clearInterval(timerRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {
        if (onCancel) onCancel();
      }
    } else {
      if (onCancel) onCancel();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="chat-voice-recorder-bar" data-testid="chat-voice-recorder-bar">
      <div className="voice-recorder-left">
        <span className="voice-recording-pulsing-dot" data-testid="voice-recording-dot" />
        <span className="voice-recording-label">Gravando áudio...</span>
        <span className="voice-recording-timer" data-testid="voice-recording-timer">
          {formatTimer(recordingSeconds)}
        </span>
      </div>

      <div className="voice-wave-container" aria-hidden="true">
        <span className="voice-wave-bar bar-1" />
        <span className="voice-wave-bar bar-2" />
        <span className="voice-wave-bar bar-3" />
        <span className="voice-wave-bar bar-4" />
        <span className="voice-wave-bar bar-5" />
        <span className="voice-wave-bar bar-6" />
        <span className="voice-wave-bar bar-7" />
      </div>

      <div className="voice-recorder-actions">
        <button
          type="button"
          className="voice-cancel-btn"
          onClick={handleCancelRecording}
          disabled={isFinishing}
          title="Cancelar gravação"
          data-testid="cancel-voice-recording-btn"
        >
          <Trash2 size={18} />
        </button>

        <button
          type="button"
          className="voice-send-btn"
          onClick={handleSendRecording}
          disabled={isFinishing}
          title="Enviar mensagem de voz"
          data-testid="send-voice-recording-btn"
        >
          {isFinishing ? <Loader2 size={18} className="spinner-icon" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
