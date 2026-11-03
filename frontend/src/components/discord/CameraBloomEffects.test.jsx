import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VoiceStageView from './VoiceStageView';
import VoiceControlDock from './VoiceControlDock';
import { ToastProvider } from '../../context/ToastContext';

describe('Camera Bloom & Background Blur Effects', () => {
  const mockParticipants = [
    { user_id: 1, user_name: 'Super Admin' },
    { user_id: 2, user_name: 'Hokage' },
  ];

  it('renderiza o botão de desfoque no card da câmera quando a câmera está ativa', () => {
    const handleChangeBlur = vi.fn();
    render(
      <VoiceStageView
        channel={{ id: 10, name: 'geral' }}
        currentUser={{ id: 1, name: 'Super Admin' }}
        participants={mockParticipants}
        isCameraOn={true}
        cameraBlurMode="none"
        onChangeCameraBlurMode={handleChangeBlur}
      />
    );

    const effectBtn = screen.getByTestId('camera-effects-tile-btn');
    expect(effectBtn).toBeInTheDocument();
    expect(effectBtn).toHaveTextContent('Desfoque');
  });

  it('abre o menu popover com opções de Desfoque Leve e Intenso ao clicar no botão do card', () => {
    const handleChangeBlur = vi.fn();
    render(
      <VoiceStageView
        channel={{ id: 10, name: 'geral' }}
        currentUser={{ id: 1, name: 'Super Admin' }}
        participants={mockParticipants}
        isCameraOn={true}
        cameraBlurMode="none"
        onChangeCameraBlurMode={handleChangeBlur}
      />
    );

    fireEvent.click(screen.getByTestId('camera-effects-tile-btn'));

    expect(screen.getByTestId('camera-effects-tile-popover')).toBeInTheDocument();
    expect(screen.getByTestId('tile-effect-option-light')).toBeInTheDocument();
    expect(screen.getByTestId('tile-effect-option-intense')).toBeInTheDocument();

    // Seleciona desfoque leve
    fireEvent.click(screen.getByTestId('tile-effect-option-light'));
    expect(handleChangeBlur).toHaveBeenCalledWith('light');
  });

  it('aplica overlay de desfoque e foco no rosto quando cameraBlurMode for light ou intense', () => {
    const { rerender } = render(
      <VoiceStageView
        channel={{ id: 10, name: 'geral' }}
        currentUser={{ id: 1, name: 'Super Admin' }}
        participants={mockParticipants}
        isCameraOn={true}
        cameraBlurMode="light"
      />
    );

    expect(screen.getByTestId('camera-bloom-overlay-light')).toBeInTheDocument();

    rerender(
      <VoiceStageView
        channel={{ id: 10, name: 'geral' }}
        currentUser={{ id: 1, name: 'Super Admin' }}
        participants={mockParticipants}
        isCameraOn={true}
        cameraBlurMode="intense"
      />
    );

    expect(screen.getByTestId('camera-bloom-overlay-intense')).toBeInTheDocument();
  });

  it('renderiza o botão de efeitos no dock de controle e altera o modo de desfoque', () => {
    const handleChangeBlur = vi.fn();
    render(
      <ToastProvider>
        <VoiceControlDock
          isMuted={false}
          onToggleMute={vi.fn()}
          isDeafened={false}
          onToggleDeafen={vi.fn()}
          isCameraOn={true}
          onToggleCamera={vi.fn()}
          isScreenSharing={false}
          onToggleScreenShare={vi.fn()}
          cameraBlurMode="none"
          onChangeCameraBlurMode={handleChangeBlur}
          channel={{ id: 10 }}
          currentUser={{ id: 1, name: 'Super Admin' }}
          onDisconnectVoice={vi.fn()}
        />
      </ToastProvider>
    );

    const dockBtn = screen.getByTestId('voice-toggle-camera-effects-btn');
    expect(dockBtn).toBeInTheDocument();

    fireEvent.click(dockBtn);
    expect(screen.getByTestId('camera-effects-dock-popover')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('dock-effect-option-intense'));
    expect(handleChangeBlur).toHaveBeenCalledWith('intense');
  });
});
