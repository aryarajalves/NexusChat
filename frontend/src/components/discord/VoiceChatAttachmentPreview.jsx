import React from 'react';

export default function VoiceChatAttachmentPreview({ msg }) {
  if (!msg?.attachment_url) return null;

  const isAudio =
    msg.attachment_type?.startsWith('audio/') ||
    /\.(mp3|ogg|wav|m4a|aac|opus)(\?.*)?$/i.test(msg.attachment_url || '');

  const isVideo =
    !isAudio &&
    (msg.attachment_type?.startsWith('video/') ||
      /\.(mp4|webm|mov|mkv)(\?.*)?$/i.test(msg.attachment_url || ''));

  const isImage =
    !isAudio &&
    !isVideo &&
    (msg.attachment_type?.startsWith('image/') ||
      /\.(png|jpe?g|gif|webp|svg|bmp)(\?.*)?$/i.test(msg.attachment_url || ''));

  return (
    <div className="voice-chat-attachment" data-testid={`voice-chat-attachment-${msg.id}`}>
      {isImage ? (
        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer">
          <img src={msg.attachment_url} alt="Anexo da call" loading="lazy" />
        </a>
      ) : isVideo ? (
        <video
          src={msg.attachment_url}
          controls
          playsInline
          className="voice-chat-video-attachment"
          data-testid={`voice-chat-video-${msg.id}`}
        />
      ) : isAudio ? (
        <audio
          src={msg.attachment_url}
          controls
          className="voice-chat-audio-attachment"
          data-testid={`voice-chat-audio-${msg.id}`}
        />
      ) : (
        <a
          href={msg.attachment_url}
          target="_blank"
          rel="noopener noreferrer"
          className="voice-chat-file-attachment"
        >
          📎 Ver anexo ({msg.attachment_url.split('/').pop()})
        </a>
      )}
    </div>
  );
}
