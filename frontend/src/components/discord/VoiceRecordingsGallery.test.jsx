import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import VoiceRecordingsGalleryModal from './VoiceRecordingsGalleryModal';
import VoiceRecordingModal from './VoiceRecordingModal';
import VoiceChannelArea from './VoiceChannelArea';
import ChatArea from './ChatArea';
import { ToastProvider } from '../../context/ToastContext';

describe('Voice Recordings Gallery & Cloud Storage Feature', () => {
  const mockChannel = { id: 10, name: 'sala-reuniao', type: 'VOICE' };
  const mockCurrentUser = { id: 1, name: 'Super Admin', email: 'admin@nexus.com' };

  const mockRecordings = [
    {
      id: 101,
      server_id: 1,
      channel_id: 10,
      user_id: 1,
      author_name: 'Super Admin',
      title: 'Reunião Geral Semanal',
      filename: 'rec_101.mp4',
      storage: 'b2',
      file_size: 5242880, // 5 MB
      duration_seconds: 130, // 02:10
      record_type: 'video',
      stream_url: '/api/v1/discord/recordings/101/stream',
      download_url: '/api/v1/discord/recordings/101/download',
      created_at: '2026-11-03T18:00:00Z',
    },
    {
      id: 102,
      server_id: 1,
      channel_id: 10,
      user_id: 1,
      author_name: 'Super Admin',
      title: 'Discussão de Ideias (Áudio)',
      filename: 'rec_102.webm',
      storage: 'b2',
      file_size: 1048576, // 1 MB
      duration_seconds: 45, // 00:45
      record_type: 'audio',
      stream_url: '/api/v1/discord/recordings/102/stream',
      download_url: '/api/v1/discord/recordings/102/download',
      created_at: '2026-11-03T18:15:00Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('renders recordings gallery button in VoiceChannelArea header and opens gallery', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRecordings,
    });

    render(
      <ToastProvider>
        <VoiceChannelArea
          channel={mockChannel}
          currentUser={mockCurrentUser}
          onlineUsers={[mockCurrentUser]}
          onDisconnectVoice={vi.fn()}
        />
      </ToastProvider>
    );

    const galleryBtn = screen.getByTestId('toggle-recordings-gallery-btn');
    expect(galleryBtn).toBeInTheDocument();
    expect(galleryBtn).toHaveAttribute('title', 'Gravações da Sala');

    // Clica para abrir a galeria
    fireEvent.click(galleryBtn);

    expect(screen.getByTestId('voice-gallery-modal')).toBeInTheDocument();
    expect(screen.getByText('Gravações da Sala')).toBeInTheDocument();
  });

  it('renders list of recordings with player, metadata, and handles rename', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRecordings,
    });

    render(
      <ToastProvider>
        <VoiceRecordingsGalleryModal
          isOpen={true}
          onClose={vi.fn()}
          channel={mockChannel}
          currentUser={mockCurrentUser}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Reunião Geral Semanal')).toBeInTheDocument();
      expect(screen.getByText('Discussão de Ideias (Áudio)')).toBeInTheDocument();
    });

    // Valida players
    expect(screen.getByTestId('video-player-101')).toBeInTheDocument();
    expect(screen.getByTestId('audio-player-102')).toBeInTheDocument();

    // Valida formatação de data no Horário de Brasília (America/Sao_Paulo: UTC-3)
    expect(screen.getByText('03/11/26 15:00')).toBeInTheDocument();
    expect(screen.getByText('03/11/26 15:15')).toBeInTheDocument();

    // Valida botões de download
    const downloadBtn = screen.getByTestId('btn-download-101');
    expect(downloadBtn).toHaveAttribute('href', '/api/v1/discord/recordings/101/download');

    // Inicia edição de título (renomear)
    const renameBtn = screen.getByTestId('btn-start-rename-101');
    fireEvent.click(renameBtn);

    const inputRename = screen.getByTestId('input-rename-101');
    expect(inputRename).toBeInTheDocument();
    expect(inputRename.value).toBe('Reunião Geral Semanal');

    // Altera o título e salva via PATCH
    fireEvent.change(inputRename, { target: { value: 'Reunião Geral Semanal - Parte 1' } });

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockRecordings[0], title: 'Reunião Geral Semanal - Parte 1' }),
    });

    const saveRenameBtn = screen.getByTestId('save-rename-btn-101');
    fireEvent.click(saveRenameBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/recordings/101',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ title: 'Reunião Geral Semanal - Parte 1' }),
        })
      );
      expect(screen.getByText('Reunião Geral Semanal - Parte 1')).toBeInTheDocument();
    });
  });

  it('shows delete confirmation modal and permanently deletes recording from Backblaze B2', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRecordings,
    });

    render(
      <ToastProvider>
        <VoiceRecordingsGalleryModal
          isOpen={true}
          onClose={vi.fn()}
          channel={mockChannel}
          currentUser={mockCurrentUser}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Reunião Geral Semanal')).toBeInTheDocument();
    });

    // Clica em excluir no card 101
    const deleteBtn = screen.getByTestId('btn-delete-101');
    fireEvent.click(deleteBtn);

    // Modal de confirmação padrão centralizado aparece
    const modal = screen.getByTestId('delete-recording-modal');
    expect(modal).toBeInTheDocument();
    expect(screen.getByText(/Excluir Gravação Permanentemente/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Backblaze B2/i).length).toBeGreaterThan(0);

    // Confirma a exclusão via DELETE
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'deleted', id: 101 }),
    });

    const confirmDeleteBtn = screen.getByTestId('confirm-delete-recording-btn');
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/recordings/101',
        expect.objectContaining({ method: 'DELETE' })
      );
      // Item 101 é removido da lista
      expect(screen.queryByTestId('recording-card-101')).not.toBeInTheDocument();
      // Item 102 permanece
      expect(screen.getByTestId('recording-card-102')).toBeInTheDocument();
    });
  });

  it('allows saving recording to server (Backblaze B2) directly from VoiceRecordingModal', async () => {
    const fakeBlob = new Blob(['video-bytes'], { type: 'video/mp4' });
    const onSavedToCloud = vi.fn();

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 200,
        title: 'Minha Reunião Personalizada',
        storage: 'b2',
      }),
    });

    render(
      <ToastProvider>
        <VoiceRecordingModal
          isOpen={true}
          onClose={vi.fn()}
          channelId={10}
          channelName="sala-reuniao"
          recordType="video"
          recordedUrl="blob:http://localhost/test"
          recordedBlob={fakeBlob}
          durationSeconds={60}
          onSavedToCloud={onSavedToCloud}
        />
      </ToastProvider>
    );

    // Campo de título personalizado
    const titleInput = screen.getByTestId('recording-title-input');
    expect(titleInput).toBeInTheDocument();
    fireEvent.change(titleInput, { target: { value: 'Minha Reunião Personalizada' } });

    // Botão de salvar no servidor
    const saveCloudBtn = screen.getByTestId('save-to-cloud-btn');
    expect(saveCloudBtn).toBeInTheDocument();
    fireEvent.click(saveCloudBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/channels/10/recordings',
        expect.objectContaining({ method: 'POST' })
      );
      expect(onSavedToCloud).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 200,
          title: 'Minha Reunião Personalizada',
          storage: 'b2',
        })
      );
    });
  });

  it('provides custom audio player with play/pause, volume and timeline seek', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [mockRecordings[1]], // Apenas gravação de áudio
    });
    // mock para o fetch do áudio blob
    global.fetch.mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(['audio-data'], { type: 'audio/webm' }),
    });

    render(
      <ToastProvider>
        <VoiceRecordingsGalleryModal
          isOpen={true}
          onClose={vi.fn()}
          channel={mockChannel}
          currentUser={mockCurrentUser}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('custom-audio-player-102')).toBeInTheDocument();
      expect(screen.getByTestId('btn-play-pause-102')).toBeInTheDocument();
      expect(screen.getByTestId('timeline-slider-102')).toBeInTheDocument();
    });

    const playBtn = screen.getByTestId('btn-play-pause-102');
    expect(playBtn).toBeInTheDocument();
    fireEvent.click(playBtn);

    const slider = screen.getByTestId('timeline-slider-102');
    fireEvent.change(slider, { target: { value: '10' } });
    expect(slider.value).toBe('10');
  });

  it('supports selecting items one-by-one, selecting all, and batch deleting selected recordings', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockRecordings,
    });

    render(
      <ToastProvider>
        <VoiceRecordingsGalleryModal
          isOpen={true}
          onClose={vi.fn()}
          channel={mockChannel}
          currentUser={mockCurrentUser}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('recording-card-101')).toBeInTheDocument();
      expect(screen.getByTestId('recording-card-102')).toBeInTheDocument();
    });

    // 1. Selecionar 1 por 1
    const checkbox101 = screen.getByTestId('checkbox-recording-101');
    expect(checkbox101.checked).toBe(false);
    fireEvent.click(checkbox101);
    expect(checkbox101.checked).toBe(true);

    // Badge de selecionados aparece com "1 selecionado"
    expect(screen.getByTestId('selected-count-badge')).toHaveTextContent('1 selecionado');
    expect(screen.getByTestId('bulk-delete-btn')).toBeInTheDocument();

    // 2. Selecionar todos de uma só vez via botão do toolbar
    const selectAllBtn = screen.getByTestId('select-all-recordings-btn');
    fireEvent.click(selectAllBtn);

    const checkbox102 = screen.getByTestId('checkbox-recording-102');
    expect(checkbox101.checked).toBe(true);
    expect(checkbox102.checked).toBe(true);
    expect(screen.getByTestId('selected-count-badge')).toHaveTextContent('2 selecionados');

    // 3. Clica para excluir em lote
    const bulkDeleteBtn = screen.getByTestId('bulk-delete-btn');
    fireEvent.click(bulkDeleteBtn);

    // Modal de confirmação em lote aparece
    expect(screen.getByTestId('batch-delete-confirm-modal')).toBeInTheDocument();
    expect(screen.getByText(/Excluir 2 Gravações em Lote\?/i)).toBeInTheDocument();

    // Mock do endpoint POST batch-delete
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ deleted_ids: [101, 102], count: 2 }),
    });

    const confirmBatchBtn = screen.getByTestId('confirm-batch-delete-btn');
    fireEvent.click(confirmBatchBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/channels/10/recordings/batch-delete',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ recording_ids: [101, 102] }),
        })
      );
      // Todos os itens foram removidos e exibe mensagem de sala vazia
      expect(screen.getByTestId('voice-gallery-empty')).toBeInTheDocument();
    });
  });

  it('paginates recordings showing a maximum of 20 per page with next/prev controls', async () => {
    // Cria 25 gravações mockadas
    const manyRecordings = Array.from({ length: 25 }, (_, i) => ({
      id: 200 + i,
      server_id: 1,
      channel_id: 10,
      user_id: 1,
      author_name: 'Super Admin',
      title: `Gravação de Teste #${i + 1}`,
      filename: `rec_${200 + i}.webm`,
      storage: 'b2',
      file_size: 102400,
      duration_seconds: 30,
      record_type: 'audio',
      stream_url: `/api/v1/discord/recordings/${200 + i}/stream`,
      download_url: `/api/v1/discord/recordings/${200 + i}/download`,
      created_at: '2026-11-04T10:00:00Z',
    }));

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => manyRecordings,
    });

    render(
      <ToastProvider>
        <VoiceRecordingsGalleryModal
          isOpen={true}
          onClose={vi.fn()}
          channel={mockChannel}
          currentUser={mockCurrentUser}
        />
      </ToastProvider>
    );

    await waitFor(() => {
      // Página 1: itens 1 a 20 estão visíveis
      expect(screen.getByText('Gravação de Teste #1')).toBeInTheDocument();
      expect(screen.getByText('Gravação de Teste #20')).toBeInTheDocument();
      // Itens 21 a 25 NÃO devem estar na página 1
      expect(screen.queryByText('Gravação de Teste #21')).not.toBeInTheDocument();
      expect(screen.queryByText('Gravação de Teste #25')).not.toBeInTheDocument();
    });

    // Controles de paginação
    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Mostrando 1–20 de 25 gravações');
    expect(screen.getByTestId('pagination-current-page')).toHaveTextContent('Página 1 de 2');

    const prevBtn = screen.getByTestId('pagination-prev-btn');
    const nextBtn = screen.getByTestId('pagination-next-btn');
    expect(prevBtn).toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    // Avança para a página 2
    fireEvent.click(nextBtn);

    // Página 2: itens 21 a 25 estão visíveis
    expect(screen.getByText('Gravação de Teste #21')).toBeInTheDocument();
    expect(screen.getByText('Gravação de Teste #25')).toBeInTheDocument();
    expect(screen.queryByText('Gravação de Teste #1')).not.toBeInTheDocument();

    expect(screen.getByTestId('pagination-info')).toHaveTextContent('Mostrando 21–25 de 25 gravações');
    expect(screen.getByTestId('pagination-current-page')).toHaveTextContent('Página 2 de 2');
    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).toBeDisabled();

    // Volta para a página 1
    fireEvent.click(prevBtn);
    expect(screen.getByText('Gravação de Teste #1')).toBeInTheDocument();
    expect(screen.getByTestId('pagination-current-page')).toHaveTextContent('Página 1 de 2');
  });

  it('renders server recordings button in text channels and loads server recordings with channel badges', async () => {
    const textChannel = { id: 2, name: 'geral', type: 'TEXT', server_id: 99 };
    const serverRecordings = [{
      id: 201, server_id: 99, channel_id: 10, channel_name: 'Sala de Voz',
      user_id: 1, author_name: 'Super Admin', title: 'Gravação da Reunião Geral',
      filename: 'rec_201.mp4', storage: 'b2', file_size: 4000000, duration_seconds: 90,
      record_type: 'video', stream_url: '/api/v1/discord/recordings/201/stream',
      download_url: '/api/v1/discord/recordings/201/download', created_at: '2026-11-07T10:00:00Z',
    }];

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => serverRecordings,
    });

    render(
      <ToastProvider>
        <ChatArea channel={textChannel} messages={[]} currentUser={mockCurrentUser} />
      </ToastProvider>
    );

    const serverRecBtn = screen.getByTestId('toggle-server-recordings-btn');
    expect(serverRecBtn).toBeInTheDocument();
    expect(serverRecBtn).toHaveAttribute('title', 'Gravações do Servidor');

    fireEvent.click(serverRecBtn);

    await waitFor(() => {
      expect(screen.getByTestId('voice-gallery-modal')).toBeInTheDocument();
      expect(screen.getByText('Gravações do Servidor')).toBeInTheDocument();
      expect(screen.getByText('Gravação da Reunião Geral')).toBeInTheDocument();
      expect(screen.getByTestId('channel-badge-201')).toHaveTextContent('Canal: #Sala de Voz');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/discord/servers/99/recordings',
      expect.anything()
    );
  });

  it('does not render server recordings button when viewing direct messages (DM)', () => {
    const dmChannel = { id: 3, name: 'amigo', is_dm: true };

    render(
      <ToastProvider>
        <ChatArea
          channel={dmChannel}
          messages={[]}
          currentUser={mockCurrentUser}
        />
      </ToastProvider>
    );

    expect(screen.queryByTestId('toggle-server-recordings-btn')).not.toBeInTheDocument();
  });
});
