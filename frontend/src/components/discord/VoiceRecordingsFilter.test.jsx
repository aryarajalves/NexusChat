import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VoiceRecordingsGalleryModal from './VoiceRecordingsGalleryModal';
import { ToastProvider } from '../../context/ToastContext';

describe('Voice Recordings Gallery Filters (Room, Author, Admins, Date)', () => {
  const mockCurrentUser = { id: 1, name: 'Super Admin', email: 'admin@nexus.com' };

  const mockRecordings = [
    {
      id: 301,
      server_id: 1,
      channel_id: 10,
      channel_name: 'Sala de Voz Principal',
      user_id: 1,
      author_name: 'Super Admin',
      is_admin_author: true,
      title: 'Apresentação Geral Admin',
      filename: 'rec_301.mp4',
      storage: 'b2',
      file_size: 4000000,
      duration_seconds: 120,
      record_type: 'video',
      stream_url: '/api/v1/discord/recordings/301/stream',
      download_url: '/api/v1/discord/recordings/301/download',
      created_at: '2026-11-08T14:30:00Z',
    },
    {
      id: 302,
      server_id: 1,
      channel_id: 20,
      channel_name: 'Sala Secundária',
      user_id: 2,
      author_name: 'Hokage',
      is_admin_author: false,
      title: 'Gameplay e Testes',
      filename: 'rec_302.mp4',
      storage: 'b2',
      file_size: 2500000,
      duration_seconds: 60,
      record_type: 'video',
      stream_url: '/api/v1/discord/recordings/302/stream',
      download_url: '/api/v1/discord/recordings/302/download',
      created_at: '2026-11-09T09:15:00Z',
    },
    {
      id: 303,
      server_id: 1,
      channel_id: 10,
      channel_name: 'Sala de Voz Principal',
      user_id: 3,
      author_name: 'Visitante User',
      is_admin_author: false,
      title: 'Dúvidas e Sugestões',
      filename: 'rec_303.mp4',
      storage: 'b2',
      file_size: 1500000,
      duration_seconds: 40,
      record_type: 'video',
      stream_url: '/api/v1/discord/recordings/303/stream',
      download_url: '/api/v1/discord/recordings/303/download',
      created_at: '2026-11-08T18:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRecordings,
    });
  });

  it('renders filter bar with channels, authors, admin toggle, and date picker', async () => {
    render(
      <ToastProvider>
        <VoiceRecordingsGalleryModal
          isOpen={true}
          onClose={vi.fn()}
          serverId={1}
          currentUser={mockCurrentUser}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('voice-gallery-filter-bar')).toBeInTheDocument();
      expect(screen.getByTestId('filter-channel-select')).toBeInTheDocument();
      expect(screen.getByTestId('filter-author-select')).toBeInTheDocument();
      expect(screen.getByTestId('filter-only-admins-btn')).toBeInTheDocument();
      expect(screen.getByTestId('filter-date-input')).toBeInTheDocument();
    });

    expect(screen.getByText('Apresentação Geral Admin')).toBeInTheDocument();
    expect(screen.getByText('Gameplay e Testes')).toBeInTheDocument();
    expect(screen.getByText('Dúvidas e Sugestões')).toBeInTheDocument();
  });

  it('filters recordings by specific room/channel', async () => {
    render(
      <ToastProvider>
        <VoiceRecordingsGalleryModal
          isOpen={true}
          onClose={vi.fn()}
          serverId={1}
          currentUser={mockCurrentUser}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('filter-channel-select')).toBeInTheDocument();
    });

    // Seleciona canal 'Sala Secundária' (id: 20)
    fireEvent.change(screen.getByTestId('filter-channel-select'), {
      target: { value: '20' },
    });

    expect(screen.getByText('Gameplay e Testes')).toBeInTheDocument();
    expect(screen.queryByText('Apresentação Geral Admin')).not.toBeInTheDocument();
    expect(screen.queryByText('Dúvidas e Sugestões')).not.toBeInTheDocument();
  });

  it('filters recordings by specific author', async () => {
    render(
      <ToastProvider>
        <VoiceRecordingsGalleryModal
          isOpen={true}
          onClose={vi.fn()}
          serverId={1}
          currentUser={mockCurrentUser}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('filter-author-select')).toBeInTheDocument();
    });

    // Seleciona autor 'Super Admin' (id: 1)
    fireEvent.change(screen.getByTestId('filter-author-select'), {
      target: { value: '1' },
    });

    expect(screen.getByText('Apresentação Geral Admin')).toBeInTheDocument();
    expect(screen.queryByText('Gameplay e Testes')).not.toBeInTheDocument();
    expect(screen.queryByText('Dúvidas e Sugestões')).not.toBeInTheDocument();
  });

  it('filters recordings exclusively for admins (Só dos admins)', async () => {
    render(
      <ToastProvider>
        <VoiceRecordingsGalleryModal
          isOpen={true}
          onClose={vi.fn()}
          serverId={1}
          currentUser={mockCurrentUser}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('filter-only-admins-btn')).toBeInTheDocument();
    });

    // Clica no botão "Só dos admins"
    fireEvent.click(screen.getByTestId('filter-only-admins-btn'));

    expect(screen.getByText('Apresentação Geral Admin')).toBeInTheDocument();
    expect(screen.queryByText('Gameplay e Testes')).not.toBeInTheDocument();
    expect(screen.queryByText('Dúvidas e Sugestões')).not.toBeInTheDocument();
  });

  it('filters recordings by specific date and shows empty state if no match', async () => {
    render(
      <ToastProvider>
        <VoiceRecordingsGalleryModal
          isOpen={true}
          onClose={vi.fn()}
          serverId={1}
          currentUser={mockCurrentUser}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('filter-date-input')).toBeInTheDocument();
    });

    // Filtra pela data '2026-11-08' -> 301 e 303 devem aparecer
    fireEvent.change(screen.getByTestId('filter-date-input'), {
      target: { value: '2026-11-08' },
    });

    expect(screen.getByText('Apresentação Geral Admin')).toBeInTheDocument();
    expect(screen.getByText('Dúvidas e Sugestões')).toBeInTheDocument();
    expect(screen.queryByText('Gameplay e Testes')).not.toBeInTheDocument();

    // Filtra por data sem gravações
    fireEvent.change(screen.getByTestId('filter-date-input'), {
      target: { value: '2026-01-01' },
    });

    expect(screen.getByTestId('voice-gallery-empty-filtered')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma gravação encontrada')).toBeInTheDocument();
    expect(
      screen.getByText(/Nenhum vídeo gravado corresponde aos filtros selecionados/)
    ).toBeInTheDocument();

    // Clica em "Limpar filtros" no estado vazio
    fireEvent.click(screen.getByTestId('empty-clear-filters-btn'));

    // Todas as gravações devem voltar
    expect(screen.getByText('Apresentação Geral Admin')).toBeInTheDocument();
    expect(screen.getByText('Gameplay e Testes')).toBeInTheDocument();
    expect(screen.getByText('Dúvidas e Sugestões')).toBeInTheDocument();
  });
});
