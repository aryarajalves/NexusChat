import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SoundboardPopover from './SoundboardPopover';
import { ToastProvider } from '../../context/ToastContext';

describe('SoundboardPopover - Importar e Excluir Sons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exibe o botão "+ Importar Som" no popover e permite enviar um novo arquivo de áudio para administradores', async () => {
    const mockOnSoundsChange = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 77,
        name: 'Meme Novo',
        emoji: '🔥',
        audio_url: '/api/v1/discord/attachments/sound_77.mp3',
        volume: 0.8,
      }),
    });

    render(
      <ToastProvider>
        <SoundboardPopover
          isOpen={true}
          onClose={vi.fn()}
          channelId={10}
          serverId={1}
          token="test-token"
          serverSounds={[]}
          onSoundsChange={mockOnSoundsChange}
          onTriggerSound={vi.fn()}
          isDeafened={false}
          currentUser={{ id: 1, name: 'Super Admin', role: 'superadmin' }}
          canManageSounds={true}
        />
      </ToastProvider>
    );

    const toggleImportBtn = screen.getByTestId('toggle-import-sound-btn');
    expect(toggleImportBtn).toBeInTheDocument();

    // Abre o formulário de importação
    fireEvent.click(toggleImportBtn);
    expect(screen.getByTestId('soundboard-import-form')).toBeInTheDocument();

    // Seleciona um arquivo MP3
    const fileInput = screen.getByTestId('soundboard-import-file-input');
    const fakeFile = new File(['dummy-mp3-bytes'], 'meme_novo.mp3', { type: 'audio/mpeg' });
    fireEvent.change(fileInput, { target: { files: [fakeFile] } });

    // Define emoji e nome do som
    fireEvent.change(screen.getByTestId('soundboard-import-emoji-input'), { target: { value: '🔥' } });
    fireEvent.change(screen.getByTestId('soundboard-import-name-input'), { target: { value: 'Meme Novo' } });

    // Submete o formulário
    fireEvent.click(screen.getByTestId('soundboard-submit-import-btn'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/servers/1/soundboard',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(mockOnSoundsChange).toHaveBeenCalled();
    });
  });

  it('exibe popup de confirmação centralizado ao excluir um som importado e remove após confirmar', async () => {
    const mockOnSoundsChange = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Som excluído com sucesso.' }),
    });

    render(
      <ToastProvider>
        <SoundboardPopover
          isOpen={true}
          onClose={vi.fn()}
          channelId={10}
          serverId={1}
          token="test-token"
          serverSounds={[
            { id: 55, name: 'Som Custom', emoji: '🎉', audio_url: '/sound.mp3' },
          ]}
          onSoundsChange={mockOnSoundsChange}
          onTriggerSound={vi.fn()}
          isDeafened={false}
          currentUserRole="ADMIN"
          canManageSounds={true}
        />
      </ToastProvider>
    );

    // Clica na lixeira do som importado
    fireEvent.click(screen.getByTestId('soundboard-delete-btn-55'));

    // Verifica que o popup centralizado com backdrop abriu
    expect(screen.getByTestId('soundboard-popover-delete-backdrop')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-popover-delete-modal')).toBeInTheDocument();

    // Confirma a exclusão
    fireEvent.click(screen.getByTestId('confirm-popover-delete-sound-btn'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/servers/1/soundboard/55',
        expect.objectContaining({ method: 'DELETE' })
      );
      expect(mockOnSoundsChange).toHaveBeenCalled();
    });
  });

  it('NÃO deve exibir o botão de importar som nem o botão de excluir som para usuário comum (não admin)', () => {
    render(
      <ToastProvider>
        <SoundboardPopover
          isOpen={true}
          onClose={vi.fn()}
          channelId={10}
          serverId={1}
          token="test-token"
          serverSounds={[
            { id: 55, name: 'Som Custom', emoji: '🎉', audio_url: '/sound.mp3' },
          ]}
          onSoundsChange={vi.fn()}
          onTriggerSound={vi.fn()}
          isDeafened={false}
          currentUser={{ id: 2, name: 'Hokage', role: 'user' }}
          currentUserRole="MEMBER"
          canManageSounds={false}
        />
      </ToastProvider>
    );

    // O botão de importar som NÃO deve existir na tela para o membro comum
    expect(screen.queryByTestId('toggle-import-sound-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('soundboard-import-form')).not.toBeInTheDocument();

    // O botão de excluir som (lixeira) NÃO deve existir para o membro comum
    expect(screen.queryByTestId('soundboard-delete-btn-55')).not.toBeInTheDocument();

    // Porém o som customizado e sons padrão continuam visíveis para o membro tocar
    expect(screen.getByTestId('soundboard-play-server-55')).toBeInTheDocument();
  });

  it('permite ao administrador abrir o modal de edição e alterar o nome e emoji do som', async () => {
    const mockOnSoundsChange = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 55,
        name: 'Grito Editado',
        emoji: '⚡',
        audio_url: '/sound.mp3',
        volume: 0.8,
      }),
    });

    render(
      <ToastProvider>
        <SoundboardPopover
          isOpen={true}
          onClose={vi.fn()}
          channelId={10}
          serverId={1}
          token="test-token"
          serverSounds={[
            { id: 55, name: 'Som Original', emoji: '🎉', audio_url: '/sound.mp3' },
          ]}
          onSoundsChange={mockOnSoundsChange}
          onTriggerSound={vi.fn()}
          isDeafened={false}
          currentUser={{ id: 1, name: 'Super Admin', role: 'superadmin' }}
          canManageSounds={true}
        />
      </ToastProvider>
    );

    // Clica no botão de editar (lápis)
    const editBtn = screen.getByTestId('soundboard-edit-btn-55');
    expect(editBtn).toBeInTheDocument();
    fireEvent.click(editBtn);

    // Modal de edição abre centralizado
    expect(screen.getByTestId('soundboard-popover-edit-backdrop')).toBeInTheDocument();
    expect(screen.getByTestId('soundboard-popover-edit-modal')).toBeInTheDocument();

    // Altera nome e emoji
    fireEvent.change(screen.getByTestId('edit-sound-emoji-input'), { target: { value: '⚡' } });
    fireEvent.change(screen.getByTestId('edit-sound-name-input'), { target: { value: 'Grito Editado' } });

    // Salva alterações
    fireEvent.click(screen.getByTestId('confirm-edit-sound-btn'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v1/discord/servers/1/soundboard/55',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'Grito Editado', emoji: '⚡' }),
        })
      );
      expect(mockOnSoundsChange).toHaveBeenCalled();
    });
  });

  it('desabilita todos os botões de som enquanto um som está tocando e impede cliques simultâneos', async () => {
    const mockTriggerSound = vi.fn();

    render(
      <ToastProvider>
        <SoundboardPopover
          isOpen={true}
          onClose={vi.fn()}
          channelId={10}
          serverId={1}
          token="test-token"
          serverSounds={[
            { id: 101, name: 'Buzina', emoji: '📯', audio_url: '/audio/buzina.mp3' },
          ]}
          onSoundsChange={vi.fn()}
          onTriggerSound={mockTriggerSound}
          isDeafened={false}
          currentUser={{ id: 1, name: 'Super Admin', role: 'superadmin' }}
          canManageSounds={true}
        />
      </ToastProvider>
    );

    const quackBtn = screen.getByTestId('soundboard-play-default-def_quack');
    const customBtn = screen.getByTestId('soundboard-play-server-101');

    expect(quackBtn).not.toBeDisabled();
    expect(customBtn).not.toBeDisabled();

    // Clica para tocar Quack
    fireEvent.click(quackBtn);

    // mockTriggerSound foi chamado para def_quack
    expect(mockTriggerSound).toHaveBeenCalledTimes(1);
    expect(mockTriggerSound).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'def_quack' }),
      expect.any(Number)
    );

    // Durante o playback (estado playingSoundId ativo), os botões devem ficar desabilitados
    expect(quackBtn).toBeDisabled();
    expect(customBtn).toBeDisabled();

    // Tentar clicar novamente em outro som enquanto toca não dispara novos envios
    fireEvent.click(customBtn);
    expect(mockTriggerSound).toHaveBeenCalledTimes(1);
  });
});
