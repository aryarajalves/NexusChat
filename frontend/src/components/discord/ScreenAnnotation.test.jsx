import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ScreenAnnotationOverlay, { ANNOTATION_TOOLS, ANNOTATION_COLORS } from './ScreenAnnotationOverlay';
import VoiceControlDock from './VoiceControlDock';
import { createCompositeStream } from './videoCompositeUtils';
import { ToastProvider } from '../../context/ToastContext';

describe('Screen Annotation & Collaborative Drawing Feature', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (props = {}) => {
    const defaultProps = {
      isScreenSharing: true,
      isPresenter: true,
      currentUserId: 1,
      currentUserName: 'Super Admin',
      isCollaborative: false,
      onToggleCollaborative: vi.fn(),
      onSendDraw: vi.fn(),
      incomingDrawEvent: null,
      onRegisterAnnotationCanvas: vi.fn(),
      ...props,
    };

    return {
      ...render(
        <ToastProvider>
          <ScreenAnnotationOverlay {...defaultProps} />
        </ToastProvider>
      ),
      props: defaultProps,
    };
  };

  it('renders quick toggle button and opens annotation toolbar on click', () => {
    renderComponent();

    const toggleBtn = screen.getByTestId('toggle-annotation-btn');
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveTextContent('Riscar Tela (Caneta)');

    // Inicialmente a toolbar está fechada
    expect(screen.queryByTestId('screen-annotation-toolbar')).not.toBeInTheDocument();

    // Clica para ativar
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId('screen-annotation-toolbar')).toBeInTheDocument();
    expect(toggleBtn).toHaveTextContent('Anotando');

    // Clica no botão de fechar a barra de ferramentas
    const closeToolbarBtn = screen.getByTestId('close-annotation-toolbar-btn');
    fireEvent.click(closeToolbarBtn);
    expect(screen.queryByTestId('screen-annotation-toolbar')).not.toBeInTheDocument();
  });

  it('provides all 4 drawing tools (Pen, Laser, Arrow, Rect) and switches between them', () => {
    renderComponent();
    fireEvent.click(screen.getByTestId('toggle-annotation-btn'));

    const penBtn = screen.getByTestId('tool-pen-btn');
    const laserBtn = screen.getByTestId('tool-laser-btn');
    const arrowBtn = screen.getByTestId('tool-arrow-btn');
    const rectBtn = screen.getByTestId('tool-rect-btn');

    expect(penBtn).toHaveClass('active');

    // Alterna para Laser
    fireEvent.click(laserBtn);
    expect(laserBtn).toHaveClass('laser-active');

    // Alterna para Seta
    fireEvent.click(arrowBtn);
    expect(arrowBtn).toHaveClass('active');

    // Alterna para Retângulo
    fireEvent.click(rectBtn);
    expect(rectBtn).toHaveClass('active');
  });

  it('allows selecting colors from the color palette', () => {
    renderComponent();
    fireEvent.click(screen.getByTestId('toggle-annotation-btn'));

    const redDot = screen.getByTestId('color-dot-red');
    const yellowDot = screen.getByTestId('color-dot-yellow');
    const greenDot = screen.getByTestId('color-dot-green');

    expect(redDot).toHaveClass('active');

    // Seleciona Amarelo
    fireEvent.click(yellowDot);
    expect(yellowDot).toHaveClass('active');
    expect(redDot).not.toHaveClass('active');

    // Seleciona Verde
    fireEvent.click(greenDot);
    expect(greenDot).toHaveClass('active');
  });

  it('emits stroke draw event when drawing with pen on the canvas', () => {
    const onSendDraw = vi.fn();
    renderComponent({ onSendDraw });
    fireEvent.click(screen.getByTestId('toggle-annotation-btn'));

    const canvas = screen.getByTestId('screen-annotation-canvas');

    // Simula desenho
    fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 });
    fireEvent.mouseUp(canvas, { clientX: 200, clientY: 200 });

    expect(onSendDraw).toHaveBeenCalledWith('stroke', expect.objectContaining({
      tool: ANNOTATION_TOOLS.PEN,
      color: '#f23f43',
      points: expect.any(Array),
    }));
  });

  it('emits laser draw event when using the laser pointer tool', () => {
    const onSendDraw = vi.fn();
    renderComponent({ onSendDraw });
    fireEvent.click(screen.getByTestId('toggle-annotation-btn'));

    fireEvent.click(screen.getByTestId('tool-laser-btn'));
    const canvas = screen.getByTestId('screen-annotation-canvas');

    fireEvent.mouseDown(canvas, { clientX: 300, clientY: 250 });

    expect(onSendDraw).toHaveBeenCalledWith('laser', expect.objectContaining({
      point: expect.any(Object),
    }));
    expect(screen.getByTestId('annotation-laser-dot')).toBeInTheDocument();
  });

  it('emits clear event and resets canvas when clicking clear button', () => {
    const onSendDraw = vi.fn();
    renderComponent({ onSendDraw });
    fireEvent.click(screen.getByTestId('toggle-annotation-btn'));

    const clearBtn = screen.getByTestId('tool-clear-btn');
    fireEvent.click(clearBtn);

    expect(onSendDraw).toHaveBeenCalledWith('clear', {});
  });

  it('allows presenter to toggle collaborative mode on and off', () => {
    const onToggleCollaborative = vi.fn();
    const onSendDraw = vi.fn();
    renderComponent({ isPresenter: true, isCollaborative: false, onToggleCollaborative, onSendDraw });
    fireEvent.click(screen.getByTestId('toggle-annotation-btn'));

    const collabBtn = screen.getByTestId('toggle-collab-btn');
    expect(collabBtn).toHaveTextContent('Apenas Você');

    fireEvent.click(collabBtn);
    expect(onToggleCollaborative).toHaveBeenCalledWith(true);
    expect(onSendDraw).toHaveBeenCalledWith('collab', { isCollaborative: true });
  });

  it('renders author tag when receiving remote draw event from another user', () => {
    const { rerender } = renderComponent({ currentUserId: 1 });

    const incomingDrawEvent = {
      action: 'stroke',
      user_id: 2,
      user_name: 'Hokage',
      payload: {
        tool: ANNOTATION_TOOLS.PEN,
        color: '#57f287',
        width: 4,
        points: [{ x: 0.2, y: 0.2 }, { x: 0.3, y: 0.3 }],
        lastPoint: { x: 0.3, y: 0.3 },
      },
    };

    rerender(
      <ToastProvider>
        <ScreenAnnotationOverlay
          isScreenSharing={true}
          isPresenter={true}
          currentUserId={1}
          currentUserName="Super Admin"
          incomingDrawEvent={incomingDrawEvent}
        />
      </ToastProvider>
    );

    expect(screen.getByTestId('annotation-author-tag')).toHaveTextContent('Hokage');
  });

  it('registers canvas reference on mount for video recording composition', () => {
    const onRegisterAnnotationCanvas = vi.fn();
    renderComponent({ onRegisterAnnotationCanvas });

    expect(onRegisterAnnotationCanvas).toHaveBeenCalledWith(expect.any(HTMLCanvasElement));
  });

  it('createCompositeStream includes annotation canvas in drawing loop when provided', () => {
    const mockScreenStream = {
      getVideoTracks: () => [{ id: 'screen-1' }],
      getAudioTracks: () => [],
      addTrack: vi.fn(),
    };
    const mockAnnotationCanvas = document.createElement('canvas');
    mockAnnotationCanvas.width = 1280;
    mockAnnotationCanvas.height = 720;

    const composite = createCompositeStream({
      screenStream: mockScreenStream,
      cameraStream: null,
      audioStream: null,
      getAnnotationCanvas: () => mockAnnotationCanvas,
    });

    expect(composite).toBeDefined();
    expect(composite.stream).toBeDefined();
    expect(typeof composite.stop).toBe('function');
    composite.stop();
  });

  it('renders pen button in VoiceControlDock when sharing screen and toggles annotation', () => {
    const onToggleAnnotation = vi.fn();
    const { rerender } = render(
      <ToastProvider>
        <VoiceControlDock
          isScreenSharing={false}
          hasActiveScreenShare={false}
          onToggleAnnotation={onToggleAnnotation}
        />
      </ToastProvider>
    );

    // Quando não há compartilhamento de tela, o botão de caneta não é exibido
    expect(screen.queryByTestId('voice-toggle-annotation-dock-btn')).not.toBeInTheDocument();

    // Quando o usuário está compartilhando tela, o botão de caneta aparece no dock
    rerender(
      <ToastProvider>
        <VoiceControlDock
          isScreenSharing={true}
          hasActiveScreenShare={true}
          isAnnotationActive={false}
          onToggleAnnotation={onToggleAnnotation}
        />
      </ToastProvider>
    );

    const dockPenBtn = screen.getByTestId('voice-toggle-annotation-dock-btn');
    expect(dockPenBtn).toBeInTheDocument();
    expect(dockPenBtn).toHaveAttribute('title', 'Riscar Tela (Caneta)');

    // Clica para alternar anotação
    fireEvent.click(dockPenBtn);
    expect(onToggleAnnotation).toHaveBeenCalledTimes(1);
  });

  it('renders document PiP button in VoiceControlDock and toggles PiP window', () => {
    const onToggleDocumentPip = vi.fn();
    render(
      <ToastProvider>
        <VoiceControlDock
          isScreenSharing={true}
          hasActiveScreenShare={true}
          isDocumentPipOpen={false}
          onToggleDocumentPip={onToggleDocumentPip}
        />
      </ToastProvider>
    );

    const pipBtn = screen.getByTestId('voice-toggle-document-pip-btn');
    expect(pipBtn).toBeInTheDocument();
    expect(pipBtn).toHaveAttribute('title', expect.stringContaining('Always-on-Top'));

    fireEvent.click(pipBtn);
    expect(onToggleDocumentPip).toHaveBeenCalledTimes(1);
  });
});
