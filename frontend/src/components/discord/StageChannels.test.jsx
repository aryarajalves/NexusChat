import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateChannelModal from './CreateChannelModal';
import StageModerationBar from './StageModerationBar';
import VoiceChannelItem from './VoiceChannelItem';

describe('Canais de Palco / Sala de Aula (Stage Channels)', () => {
  describe('CreateChannelModal com opção Palco / Aula (STAGE)', () => {
    it('renderiza o card de seleção para canal de Palco / Aula', () => {
      render(
        <CreateChannelModal
          isOpen={true}
          onClose={vi.fn()}
          onCreateChannel={vi.fn()}
        />
      );

      expect(screen.getByTestId('channel-type-stage')).toBeInTheDocument();
      expect(screen.getByText('Palco / Aula')).toBeInTheDocument();
    });

    it('ao selecionar Palco / Aula e submeter, envia type: "STAGE" e categoria "Canais de Aula"', async () => {
      const handleCreate = vi.fn().mockResolvedValue();
      render(
        <CreateChannelModal
          isOpen={true}
          onClose={vi.fn()}
          onCreateChannel={handleCreate}
        />
      );

      // Clica no card Palco / Aula
      fireEvent.click(screen.getByTestId('channel-type-stage'));

      // Preenche o nome do canal
      const input = screen.getByTestId('channel-name-input');
      fireEvent.change(input, { target: { value: 'aula-programacao' } });

      // Submete o formulário
      const submitBtn = screen.getByRole('button', { name: /criar canal/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'aula-programacao',
            type: 'STAGE',
            category: 'Canais de Aula',
          })
        );
      });
    });
  });

  describe('StageModerationBar Component', () => {
    it('renderiza visão de moderador / professor com fila de dúvidas', () => {
      const onGrantSpeak = vi.fn();
      render(
        <StageModerationBar
          isStage={true}
          isModerator={true}
          handsRaised={[10]}
          participants={[{ id: 10, user_id: 10, user_name: 'Estudante João' }]}
          onGrantSpeak={onGrantSpeak}
        />
      );

      expect(screen.getByText('Professor / Admin')).toBeInTheDocument();
      expect(screen.getByTestId('stage-hands-queue-btn')).toBeInTheDocument();
      expect(screen.getByText('1 na fila de dúvidas')).toBeInTheDocument();

      // Abre popover da fila de dúvidas
      fireEvent.click(screen.getByTestId('stage-hands-queue-btn'));
      expect(screen.getByTestId('stage-hands-popover')).toBeInTheDocument();
      expect(screen.getByText('Estudante João')).toBeInTheDocument();

      // Clica em permitir falar
      fireEvent.click(screen.getByTestId('stage-allow-speak-10'));
      expect(onGrantSpeak).toHaveBeenCalledWith(10);
    });

    it('renderiza visão de ouvinte com botão de levantar a mão', () => {
      const onRaiseHand = vi.fn();
      render(
        <StageModerationBar
          isStage={true}
          isModerator={false}
          isSpeaker={false}
          handRaised={false}
          handsRaised={[]}
          participants={[]}
          onRaiseHand={onRaiseHand}
        />
      );

      expect(screen.getByText('Ouvinte')).toBeInTheDocument();
      const raiseBtn = screen.getByTestId('stage-raise-hand-btn');
      expect(raiseBtn).toBeInTheDocument();
      expect(raiseBtn).toHaveTextContent('✋ Pedir para Falar');

      fireEvent.click(raiseBtn);
      expect(onRaiseHand).toHaveBeenCalledTimes(1);
    });

    it('renderiza estado de mão levantada para o aluno aguardando professor', () => {
      render(
        <StageModerationBar
          isStage={true}
          isModerator={false}
          isSpeaker={false}
          handRaised={true}
          handsRaised={[5]}
          participants={[]}
          onRaiseHand={vi.fn()}
        />
      );

      expect(screen.getByTestId('stage-waiting-label')).toHaveTextContent(
        'Aguardando o professor liberar a palavra...'
      );
      expect(screen.getByTestId('stage-raise-hand-btn')).toHaveTextContent('✋ Abaixar Mão');
    });

    it('renderiza aviso de microfone liberado quando o aluno é orador autorizado no palco', () => {
      render(
        <StageModerationBar
          isStage={true}
          isModerator={false}
          isSpeaker={true}
          handRaised={false}
          handsRaised={[]}
          participants={[]}
        />
      );

      expect(screen.getByText('Orador Autorizado')).toBeInTheDocument();
      expect(screen.getByTestId('stage-speaker-notice')).toBeInTheDocument();
      expect(screen.getByText(/O microfone está liberado/i)).toBeInTheDocument();
    });
  });

  describe('VoiceChannelItem com canal STAGE', () => {
    it('renderiza ícone de rádio/palco para canais do tipo STAGE', () => {
      const stageCh = { id: 7, name: 'auditorio-principal', type: 'STAGE' };
      render(
        <VoiceChannelItem
          ch={stageCh}
          isStage={true}
          onSelectChannel={vi.fn()}
        />
      );

      expect(screen.getByTestId('stage-icon-7')).toBeInTheDocument();
      expect(screen.getByText('auditorio-principal')).toBeInTheDocument();
    });
  });
});
