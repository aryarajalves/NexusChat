import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatPendingAttachment from './ChatPendingAttachment';

describe('ChatPendingAttachment', () => {
  const formatFileSize = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

  it('renders null when pendingFile is null', () => {
    const { container } = render(
      <ChatPendingAttachment
        pendingFile={null}
        pendingPreviewUrl={null}
        formatFileSize={formatFileSize}
        onRemovePendingFile={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders image thumbnail, details, caption badge and handles remove', () => {
    const handleRemove = vi.fn();
    const fakeFile = new File(['content'], 'foto_teste.png', { type: 'image/png' });
    Object.defineProperty(fakeFile, 'size', { value: 204800 });

    render(
      <ChatPendingAttachment
        pendingFile={fakeFile}
        pendingPreviewUrl="blob:http://localhost:3000/foto-blob"
        formatFileSize={formatFileSize}
        onRemovePendingFile={handleRemove}
      />
    );

    expect(screen.getByTestId('attachment-pending-box')).toBeInTheDocument();
    const img = screen.getByTestId('pending-image-preview');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'blob:http://localhost:3000/foto-blob');
    expect(screen.getByText('foto_teste.png')).toBeInTheDocument();
    expect(screen.getByText('(200 KB)')).toBeInTheDocument();
    expect(screen.getByText('Digite uma legenda abaixo (opcional)')).toBeInTheDocument();

    const removeBtn = screen.getByTestId('remove-pending-attachment-btn');
    fireEvent.click(removeBtn);
    expect(handleRemove).toHaveBeenCalledTimes(1);
  });

  it('renders video thumbnail, details, and handles remove', () => {
    const handleRemove = vi.fn();
    const fakeFile = new File(['content'], 'clipe.mp4', { type: 'video/mp4' });
    Object.defineProperty(fakeFile, 'size', { value: 1048576 });

    render(
      <ChatPendingAttachment
        pendingFile={fakeFile}
        pendingPreviewUrl="blob:http://localhost:3000/video-blob"
        formatFileSize={formatFileSize}
        onRemovePendingFile={handleRemove}
      />
    );

    expect(screen.getByTestId('pending-video-preview')).toBeInTheDocument();
    expect(screen.getByText('clipe.mp4')).toBeInTheDocument();
    expect(screen.getByText('(1024 KB)')).toBeInTheDocument();
  });

  it('renders fallback generic document card for non-media files', () => {
    const handleRemove = vi.fn();
    const fakeFile = new File(['content'], 'documento.pdf', { type: 'application/pdf' });
    Object.defineProperty(fakeFile, 'size', { value: 51200 });

    render(
      <ChatPendingAttachment
        pendingFile={fakeFile}
        pendingPreviewUrl={null}
        formatFileSize={formatFileSize}
        onRemovePendingFile={handleRemove}
      />
    );

    expect(screen.queryByTestId('pending-image-preview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pending-video-preview')).not.toBeInTheDocument();
    expect(screen.getByText('documento.pdf')).toBeInTheDocument();
    expect(screen.getByText('(50 KB)')).toBeInTheDocument();

    const removeBtn = screen.getByTestId('remove-pending-attachment-btn');
    fireEvent.click(removeBtn);
    expect(handleRemove).toHaveBeenCalledTimes(1);
  });
});
