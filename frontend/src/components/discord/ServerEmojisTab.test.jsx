import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ServerEmojisTab from './ServerEmojisTab';
import EmojiPickerPopover from './EmojiPickerPopover';
import { renderContentWithMentions } from './chatUtils';
import { ToastProvider } from '../../context/ToastContext';
import { ServerEmojisProvider } from '../../context/ServerEmojisContext';

describe('Server Custom Emojis Feature', () => {
  const mockServer = { id: 1, name: 'Servidor Teste', owner_id: 1 };
  const mockUser = { id: 1, name: 'Admin', role: 'superadmin' };

  const mockEmojis = [
    { id: 10, server_id: 1, user_id: 1, name: 'pepe_hype', image_url: '/uploads/pepe.png', created_at: '2026-11-04T12:00:00Z' },
    { id: 11, server_id: 1, user_id: 1, name: 'nexus_fire', image_url: '/uploads/fire.gif', created_at: '2026-11-04T12:05:00Z' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.setItem('auth_token', 'fake-test-token');
  });

  const renderWithProviders = (ui) => {
    return render(
      <ToastProvider>
        <ServerEmojisProvider serverId={mockServer.id}>
          {ui}
        </ServerEmojisProvider>
      </ToastProvider>
    );
  };

  it('renders ServerEmojisTab with title and loads existing server emojis', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockEmojis,
    });

    renderWithProviders(<ServerEmojisTab server={mockServer} currentUser={mockUser} />);

    expect(screen.getByText('Emojis do Servidor')).toBeInTheDocument();
    expect(screen.getByTestId('upload-emoji-form')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(':pepe_hype:')).toBeInTheDocument();
      expect(screen.getByText(':nexus_fire:')).toBeInTheDocument();
    });
  });

  it('allows filling emoji name and uploading a new custom emoji', async () => {
    const newEmoji = { id: 12, server_id: 1, user_id: 1, name: 'cat_party', image_url: '/uploads/cat.png', created_at: '2026-11-04T12:10:00Z' };

    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => newEmoji,
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockEmojis,
      });
    });

    renderWithProviders(<ServerEmojisTab server={mockServer} currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText(':pepe_hype:')).toBeInTheDocument();
    });

    const file = new File(['dummy content'], 'cat.png', { type: 'image/png' });
    const fileInput = screen.getByTestId('emoji-file-input');
    fireEvent.change(fileInput, { target: { files: [file] } });

    const nameInput = screen.getByTestId('emoji-name-input');
    fireEvent.change(nameInput, { target: { value: 'cat party!' } });

    const submitBtn = screen.getByTestId('submit-emoji-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(':cat_party:')).toBeInTheDocument();
    });
  });

  it('opens confirmation popup before deleting emoji and handles cancel & confirm deletion', async () => {
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      if (opts?.method === 'DELETE') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ message: 'Emoji excluído com sucesso.' }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockEmojis,
      });
    });

    renderWithProviders(<ServerEmojisTab server={mockServer} currentUser={mockUser} />);

    await waitFor(() => {
      expect(screen.getByText(':pepe_hype:')).toBeInTheDocument();
    });

    // Clica no botão de excluir do primeiro emoji
    const deleteBtn = screen.getByTestId('delete-emoji-btn-10');
    fireEvent.click(deleteBtn);

    // Valida abertura do popup de confirmação centralizado com backdrop
    const popupBackdrop = screen.getByTestId('delete-emoji-backdrop');
    expect(popupBackdrop).toBeInTheDocument();
    const deleteModal = screen.getByTestId('delete-emoji-modal');
    expect(deleteModal).toBeInTheDocument();
    expect(deleteModal).toHaveTextContent('pepe_hype');

    // Testa botão de Cancelar (1 botão de fechar/cancelar além do principal)
    const cancelBtn = screen.getByTestId('cancel-delete-emoji-btn');
    fireEvent.click(cancelBtn);
    expect(screen.queryByTestId('delete-emoji-backdrop')).not.toBeInTheDocument();
    expect(screen.getByText(':pepe_hype:')).toBeInTheDocument();

    // Reabre e confirma a deleção
    fireEvent.click(deleteBtn);
    const confirmBtn = screen.getByTestId('confirm-delete-emoji-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.queryByText(':pepe_hype:')).not.toBeInTheDocument();
    });
  });

  it('renders custom emojis section inside EmojiPickerPopover and fires onSelectEmoji', () => {
    const onSelectMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <EmojiPickerPopover
        onSelectEmoji={onSelectMock}
        onClose={onCloseMock}
        customEmojis={mockEmojis}
        serverName="Servidor Teste"
      />
    );

    expect(screen.getByTestId('category-section-custom')).toBeInTheDocument();
    expect(screen.getByText(/Emojis de Servidor Teste/i)).toBeInTheDocument();

    const customBtn = screen.getByTestId('input-emoji-select-custom-pepe_hype');
    expect(customBtn).toBeInTheDocument();
    fireEvent.click(customBtn);

    expect(onSelectMock).toHaveBeenCalledWith(':pepe_hype: ');
  });

  it('renders custom emojis inline when rendering message content in chatUtils', () => {
    const emojisMap = {
      pepe_hype: mockEmojis[0],
      nexus_fire: mockEmojis[1],
    };

    const renderedNodes = renderContentWithMentions(
      'Olha esse emoji :pepe_hype: e esse :nexus_fire: que massa!',
      'Aryaraj',
      null,
      [],
      emojisMap
    );

    const { container } = render(<div>{renderedNodes}</div>);
    const customImgs = container.querySelectorAll('.discord-custom-emoji-inline');
    expect(customImgs.length).toBe(2);
    expect(customImgs[0].getAttribute('src')).toBe('/uploads/pepe.png');
    expect(customImgs[1].getAttribute('src')).toBe('/uploads/fire.gif');
  });
});
