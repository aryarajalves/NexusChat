import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateServerModal from './CreateServerModal';

describe('CreateServerModal Component', () => {
  let mockFile;

  beforeEach(() => {
    vi.restoreAllMocks();
    global.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test-icon-preview');
    global.URL.revokeObjectURL = vi.fn();
    mockFile = new File(['dummy icon bytes'], 'meu-icone.png', { type: 'image/png' });
  });

  it('renders modal with circular icon uploader and initial letter when typing name', () => {
    render(<CreateServerModal isOpen={true} onClose={vi.fn()} onCreateServer={vi.fn()} />);

    expect(screen.getByText('Criar seu Servidor')).toBeInTheDocument();
    expect(screen.getByTestId('server-icon-preview-circle')).toBeInTheDocument();
    expect(screen.getByTestId('choose-icon-btn')).toHaveTextContent('Escolher Imagem');

    // Type server name
    const nameInput = screen.getByTestId('server-name-input');
    fireEvent.change(nameInput, { target: { value: 'Comunidade Nexus' } });

    // Should display letter "C" inside circular preview
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('handles image selection, shows preview image and allows removing it', async () => {
    render(<CreateServerModal isOpen={true} onClose={vi.fn()} onCreateServer={vi.fn()} />);

    const fileInput = screen.getByTestId('server-icon-file-input');

    // Select valid image file
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockFile);
    expect(screen.getByTestId('server-icon-preview-img')).toBeInTheDocument();
    expect(screen.getByTestId('choose-icon-btn')).toHaveTextContent('Trocar Imagem');

    // Remove button appears
    const removeBtn = screen.getByTestId('remove-icon-btn');
    expect(removeBtn).toBeInTheDocument();

    // Click remove
    fireEvent.click(removeBtn);
    expect(global.URL.revokeObjectURL).toHaveBeenCalled();
    expect(screen.queryByTestId('server-icon-preview-img')).toBeNull();
    expect(screen.queryByTestId('remove-icon-btn')).toBeNull();
  });

  it('validates file type and shows error for non-image files', () => {
    render(<CreateServerModal isOpen={true} onClose={vi.fn()} onCreateServer={vi.fn()} />);

    const fileInput = screen.getByTestId('server-icon-file-input');
    const badFile = new File(['text content'], 'arquivo.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [badFile] } });

    expect(screen.getByTestId('form-error-banner')).toHaveTextContent(
      'Por favor, selecione um arquivo de imagem válido'
    );
    expect(screen.queryByTestId('server-icon-preview-img')).toBeNull();
  });

  it('submits form with name, description and selected icon file', async () => {
    const onCreateServer = vi.fn().mockResolvedValue();
    const onClose = vi.fn();

    render(<CreateServerModal isOpen={true} onClose={onClose} onCreateServer={onCreateServer} />);

    // Type name & description
    fireEvent.change(screen.getByTestId('server-name-input'), {
      target: { value: 'Gamers Brasil' },
    });
    fireEvent.change(screen.getByTestId('server-desc-input'), {
      target: { value: 'Servidor oficial de jogos' },
    });

    // Select file
    const fileInput = screen.getByTestId('server-icon-file-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });

    // Submit
    fireEvent.click(screen.getByTestId('server-submit-btn'));

    await waitFor(() => {
      expect(onCreateServer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Gamers Brasil',
          description: 'Servidor oficial de jogos',
          icon_file: mockFile,
        }),
        mockFile
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});
