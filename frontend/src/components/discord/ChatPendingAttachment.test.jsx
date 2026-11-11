import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChatPendingAttachment from './ChatPendingAttachment';

describe('ChatPendingAttachment', () => {
  const formatFileSize = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

  it('renders null when pendingFile and pendingFiles are empty', () => {
    const { container } = render(
      <ChatPendingAttachment
        pendingFiles={[]}
        pendingFile={null}
        pendingPreviewUrl={null}
        formatFileSize={formatFileSize}
        onRemovePendingFile={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders image thumbnail, details, caption badge and handles remove (legacy single-file mode)', () => {
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

  it('renders multiple media cards simultaneously and triggers onRemoveFile(index)', () => {
    const handleRemoveFile = vi.fn();
    const handleAddMore = vi.fn();

    const file1 = new File(['1'], 'img1.png', { type: 'image/png' });
    const file2 = new File(['2'], 'clip.mp4', { type: 'video/mp4' });
    const file3 = new File(['3'], 'doc.pdf', { type: 'application/pdf' });
    Object.defineProperty(file1, 'size', { value: 102400 });
    Object.defineProperty(file2, 'size', { value: 512000 });
    Object.defineProperty(file3, 'size', { value: 25600 });

    const pendingFiles = [
      { file: file1, previewUrl: 'blob:img1', id: 'id-1' },
      { file: file2, previewUrl: 'blob:clip', id: 'id-2' },
      { file: file3, previewUrl: null, id: 'id-3' },
    ];

    render(
      <ChatPendingAttachment
        pendingFiles={pendingFiles}
        formatFileSize={formatFileSize}
        onRemoveFile={handleRemoveFile}
        onAddMoreFiles={handleAddMore}
      />
    );

    expect(screen.getByTestId('pending-card-0')).toBeInTheDocument();
    expect(screen.getByTestId('pending-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('pending-card-2')).toBeInTheDocument();

    expect(screen.getByText('img1.png')).toBeInTheDocument();
    expect(screen.getByText('clip.mp4')).toBeInTheDocument();
    expect(screen.getByText('doc.pdf')).toBeInTheDocument();

    expect(screen.getByText('3 mídias selecionadas (envio simultâneo). Digite uma legenda se desejar.')).toBeInTheDocument();

    // Testa botão de remover item específico
    const removeBtnSecond = screen.getByTestId('remove-pending-attachment-btn-1');
    fireEvent.click(removeBtnSecond);
    expect(handleRemoveFile).toHaveBeenCalledWith(1);

    // Testa botão de adicionar mais mídias
    const addMoreBtn = screen.getByTestId('add-more-attachments-btn');
    fireEvent.click(addMoreBtn);
    expect(handleAddMore).toHaveBeenCalledTimes(1);
  });
});
