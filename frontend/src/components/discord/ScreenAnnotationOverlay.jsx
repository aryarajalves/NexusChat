import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Pen, Zap, ArrowUpRight, Square, Eraser, Trash2, Undo2,
  Users, Lock, Eye, EyeOff, X, PictureInPicture2
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const ANNOTATION_TOOLS = { PEN: 'pen', LASER: 'laser', ARROW: 'arrow', RECT: 'rect', ERASER: 'eraser' };

export const ANNOTATION_COLORS = [
  { id: 'red', hex: '#f23f43', label: 'Vermelho' },
  { id: 'yellow', hex: '#fee75c', label: 'Amarelo' },
  { id: 'green', hex: '#57f287', label: 'Verde' },
  { id: 'blue', hex: '#5865f2', label: 'Azul' },
  { id: 'white', hex: '#ffffff', label: 'Branco' },
];

const TOOLS_CONFIG = [
  { id: ANNOTATION_TOOLS.PEN, icon: Pen, title: 'Caneta Livre', testId: 'tool-pen-btn' },
  { id: ANNOTATION_TOOLS.LASER, icon: Zap, title: 'Ponteiro Laser (Desaparece em 2s)', testId: 'tool-laser-btn', isLaser: true },
  { id: ANNOTATION_TOOLS.ARROW, icon: ArrowUpRight, title: 'Seta Indicativa', testId: 'tool-arrow-btn' },
  { id: ANNOTATION_TOOLS.RECT, icon: Square, title: 'Retângulo de Destaque', testId: 'tool-rect-btn' },
];

export default function ScreenAnnotationOverlay({
  isScreenSharing = false,
  isRemoteScreen = false,
  isPresenter = false,
  currentUserId,
  currentUserName = 'Você',
  isCollaborative = false,
  onToggleCollaborative,
  onSendDraw,
  incomingDrawEvent,
  onRegisterAnnotationCanvas,
  isAnnotationActive,
  onToggleAnnotation,
  onOpenDocumentPip,
}) {
  const [internalActive, setInternalActive] = useState(false);
  const isActive = isAnnotationActive !== undefined ? isAnnotationActive : internalActive;

  const [currentTool, setCurrentTool] = useState(ANNOTATION_TOOLS.PEN);
  const [currentColor, setCurrentColor] = useState(ANNOTATION_COLORS[0].hex);
  const [lineWidth, setLineWidth] = useState(4);
  const [strokes, setStrokes] = useState([]);
  const [activeAuthorTag, setActiveAuthorTag] = useState(null);
  const [laserPoint, setLaserPoint] = useState(null);
  const [isVisible, setIsVisible] = useState(true);

  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentPathRef = useRef([]);
  const startPointRef = useRef(null);
  const authorTagTimeoutRef = useRef(null);
  const laserTimeoutRef = useRef(null);

  const { addToast } = useToast();

  const canDraw = isPresenter || isCollaborative;

  const toggleActive = () => {
    if (!isActive && !canDraw) {
      addToast('O apresentador não liberou anotações colaborativas.', 'warning');
      return;
    }
    if (onToggleAnnotation) {
      onToggleAnnotation(!isActive);
    } else {
      setInternalActive(!internalActive);
    }
  };

  // Registra referência do canvas para composição de vídeo
  useEffect(() => {
    if (canvasRef.current && onRegisterAnnotationCanvas) {
      onRegisterAnnotationCanvas(canvasRef.current);
    }
  }, [onRegisterAnnotationCanvas]);

  // Função para desenhar seta
  const drawArrow = (ctx, fromX, fromY, toX, toY, color, width) => {
    const headLen = width * 3.5, angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(toX, toY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath(); ctx.fill(); ctx.restore();
  };

  // Redesenha todos os traços persistidos
  const redrawAll = useCallback((customStrokes = strokes) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!isVisible) return;

    customStrokes.forEach((st) => {
      ctx.save();
      ctx.strokeStyle = st.color;
      ctx.fillStyle = st.color;
      ctx.lineWidth = st.width * (canvas.width / 1000);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (st.tool === ANNOTATION_TOOLS.PEN) {
        if (st.points.length < 2) return;
        ctx.beginPath();
        const p0 = st.points[0];
        ctx.moveTo(p0.x * canvas.width, p0.y * canvas.height);
        for (let i = 1; i < st.points.length; i++) {
          const pt = st.points[i];
          ctx.lineTo(pt.x * canvas.width, pt.y * canvas.height);
        }
        ctx.stroke();
      } else if (st.tool === ANNOTATION_TOOLS.ARROW && st.from && st.to) {
        drawArrow(
          ctx,
          st.from.x * canvas.width,
          st.from.y * canvas.height,
          st.to.x * canvas.width,
          st.to.y * canvas.height,
          st.color,
          st.width * (canvas.width / 1000)
        );
      } else if (st.tool === ANNOTATION_TOOLS.RECT && st.from && st.to) {
        const x = Math.min(st.from.x, st.to.x) * canvas.width;
        const y = Math.min(st.from.y, st.to.y) * canvas.height;
        const w = Math.abs(st.to.x - st.from.x) * canvas.width;
        const h = Math.abs(st.to.y - st.from.y) * canvas.height;
        ctx.strokeRect(x, y, w, h);
      }
      ctx.restore();
    });
  }, [strokes, isVisible]);

  // Redimensiona o canvas interno para resolução nítida
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      redrawAll();
    }
  }, [redrawAll]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  useEffect(() => {
    redrawAll();
  }, [strokes, isVisible, redrawAll]);

  // Processa eventos remotos recebidos via WebSocket
  useEffect(() => {
    if (!incomingDrawEvent) return;
    const { action, payload, user_name, user_id } = incomingDrawEvent;

    if (action === 'stroke' && payload) {
      setStrokes((prev) => [...prev, payload]);
      if (user_name && user_id !== currentUserId) {
        showAuthorTag(user_name, payload.lastPoint || payload.to || { x: 0.5, y: 0.5 });
      }
    } else if (action === 'laser' && payload) {
      triggerLaser(payload.point, user_name);
    } else if (action === 'clear') {
      setStrokes([]);
      addToast(`${user_name || 'Alguém'} limpou a tela.`, 'info');
    } else if (action === 'collab' && payload?.isCollaborative !== undefined) {
      onToggleCollaborative && onToggleCollaborative(payload.isCollaborative);
    }
  }, [incomingDrawEvent]);

  const showAuthorTag = (name, normalizedPoint) => {
    if (authorTagTimeoutRef.current) clearTimeout(authorTagTimeoutRef.current);
    setActiveAuthorTag({ name, point: normalizedPoint });
    authorTagTimeoutRef.current = setTimeout(() => {
      setActiveAuthorTag(null);
    }, 2400);
  };

  const triggerLaser = (point, userName) => {
    if (laserTimeoutRef.current) clearTimeout(laserTimeoutRef.current);
    setLaserPoint({ point, userName });
    laserTimeoutRef.current = setTimeout(() => {
      setLaserPoint(null);
    }, 1800);
  };

  // Coordenadas relativas (0 a 1)
  const getNormalizedPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y };
  };

  // Handlers de Desenho
  const handleMouseDown = (e) => {
    if (!isActive || !canDraw) return;
    const p = getNormalizedPoint(e);
    isDrawingRef.current = true;
    startPointRef.current = p;

    if (currentTool === ANNOTATION_TOOLS.LASER) {
      triggerLaser(p, currentUserName);
      onSendDraw && onSendDraw('laser', { point: p });
      return;
    }

    if (currentTool === ANNOTATION_TOOLS.PEN) {
      currentPathRef.current = [p];
    }
  };

  const handleMouseMove = (e) => {
    if (!isActive || !canDraw) return;
    const p = getNormalizedPoint(e);

    if (currentTool === ANNOTATION_TOOLS.LASER && isDrawingRef.current) {
      triggerLaser(p, currentUserName);
      onSendDraw && onSendDraw('laser', { point: p });
      return;
    }

    if (!isDrawingRef.current) return;

    if (currentTool === ANNOTATION_TOOLS.PEN) {
      currentPathRef.current.push(p);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        const pts = currentPathRef.current;
        if (ctx && pts.length >= 2) {
          ctx.save();
          ctx.strokeStyle = currentColor;
          ctx.lineWidth = lineWidth * (canvas.width / 1000);
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          const pPrev = pts[pts.length - 2];
          ctx.moveTo(pPrev.x * canvas.width, pPrev.y * canvas.height);
          ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  };

  const handleMouseUp = (e) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const endPoint = getNormalizedPoint(e);

    if (currentTool === ANNOTATION_TOOLS.PEN) {
      if (currentPathRef.current.length > 1) {
        const strokeData = {
          tool: ANNOTATION_TOOLS.PEN,
          points: currentPathRef.current,
          color: currentColor,
          width: lineWidth,
          lastPoint: endPoint,
        };
        setStrokes((prev) => [...prev, strokeData]);
        onSendDraw && onSendDraw('stroke', strokeData);
      }
      currentPathRef.current = [];
    } else if (currentTool === ANNOTATION_TOOLS.ARROW && startPointRef.current) {
      const strokeData = {
        tool: ANNOTATION_TOOLS.ARROW,
        from: startPointRef.current,
        to: endPoint,
        color: currentColor,
        width: lineWidth,
      };
      setStrokes((prev) => [...prev, strokeData]);
      onSendDraw && onSendDraw('stroke', strokeData);
      startPointRef.current = null;
    } else if (currentTool === ANNOTATION_TOOLS.RECT && startPointRef.current) {
      const strokeData = {
        tool: ANNOTATION_TOOLS.RECT,
        from: startPointRef.current,
        to: endPoint,
        color: currentColor,
        width: lineWidth,
      };
      setStrokes((prev) => [...prev, strokeData]);
      onSendDraw && onSendDraw('stroke', strokeData);
      startPointRef.current = null;
    }
  };

  const handleClear = () => {
    setStrokes([]);
    redrawAll([]);
    onSendDraw && onSendDraw('clear', {});
    addToast('Tela limpa!', 'info');
  };

  const handleUndo = () => {
    setStrokes((prev) => {
      const next = prev.slice(0, -1);
      redrawAll(next);
      return next;
    });
  };

  const handleToggleCollabClick = () => {
    if (!isPresenter) {
      addToast('Apenas o apresentador pode alternar o modo colaborativo.', 'warning');
      return;
    }
    const nextVal = !isCollaborative;
    onToggleCollaborative && onToggleCollaborative(nextVal);
    onSendDraw && onSendDraw('collab', { isCollaborative: nextVal });
    addToast(
      nextVal ? 'Modo Colaborativo ativado: todos podem riscar!' : 'Modo Colaborativo desativado.',
      nextVal ? 'success' : 'info'
    );
  };

  return (
    <div
      className={`screen-annotation-container ${isActive && canDraw ? 'drawing-active' : ''}`}
      data-testid="screen-annotation-container"
    >
      {/* Canvas Transparente Sobreposto ao Vídeo */}
      <canvas
        ref={canvasRef}
        className={`screen-annotation-canvas cursor-${currentTool}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
        data-testid="screen-annotation-canvas"
      />

      {/* Indicador de Laser Temporário */}
      {laserPoint && (
        <div
          className="annotation-laser-dot"
          style={{
            left: `${laserPoint.point.x * 100}%`,
            top: `${laserPoint.point.y * 100}%`,
          }}
          data-testid="annotation-laser-dot"
        />
      )}

      {/* Etiqueta com Nome de Quem Está Riscando */}
      {activeAuthorTag && (
        <div
          className="annotation-author-tag"
          style={{
            left: `${activeAuthorTag.point.x * 100}%`,
            top: `${activeAuthorTag.point.y * 100}%`,
          }}
          data-testid="annotation-author-tag"
        >
          {activeAuthorTag.name}
        </div>
      )}

      {/* Botão de Ativação Rápida no Canto Superior */}
      <button
        type="button"
        className={`annotation-quick-toggle-btn ${isActive ? 'active' : ''}`}
        onClick={toggleActive}
        title={isActive ? 'Fechar ferramentas de desenho' : 'Riscar a tela compartilhada (Caneta)'}
        data-testid="toggle-annotation-btn"
      >
        <Pen size={15} />
        <span>{isActive ? 'Anotando' : 'Riscar Tela (Caneta)'}</span>
      </button>

      {/* Barra de Ferramentas Flutuante de Desenho */}
      {isActive && (
        <div className="screen-annotation-toolbar" data-testid="screen-annotation-toolbar">
          {TOOLS_CONFIG.map((t) => {
            const Icon = t.icon;
            const isToolActive = currentTool === t.id;
            const activeClass = isToolActive ? (t.isLaser ? 'laser-active' : 'active') : '';
            return (
              <button
                key={t.id}
                type="button"
                className={`annotation-tool-btn ${activeClass}`}
                onClick={() => setCurrentTool(t.id)}
                title={t.title}
                data-testid={t.testId}
              >
                <Icon size={17} />
              </button>
            );
          })}

          <div className="annotation-divider" />

          {/* Paleta de Cores */}
          <div className="annotation-colors-wrap" data-testid="annotation-colors-wrap">
            {ANNOTATION_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`annotation-color-dot ${currentColor === c.hex ? 'active' : ''}`}
                style={{ backgroundColor: c.hex }}
                onClick={() => setCurrentColor(c.hex)}
                title={c.label}
                data-testid={`color-dot-${c.id}`}
              />
            ))}
          </div>

          <div className="annotation-divider" />

          <button
            type="button"
            className="annotation-tool-btn"
            onClick={handleUndo}
            title="Desfazer último traço"
            disabled={strokes.length === 0}
            data-testid="tool-undo-btn"
          ><Undo2 size={16} /></button>

          <button
            type="button"
            className="annotation-tool-btn"
            onClick={handleClear}
            title="Limpar todos os desenhos"
            data-testid="tool-clear-btn"
          ><Trash2 size={16} /></button>

          <button
            type="button"
            className="annotation-tool-btn"
            onClick={() => setIsVisible(!isVisible)}
            title={isVisible ? 'Ocultar riscos' : 'Mostrar riscos'}
            data-testid="tool-visibility-btn"
          >{isVisible ? <Eye size={16} /> : <EyeOff size={16} />}</button>

          {isPresenter && (
            <>
              <div className="annotation-divider" />
              <button
                type="button"
                className={`annotation-collab-btn ${isCollaborative ? 'collab-on' : ''}`}
                onClick={handleToggleCollabClick}
                title={isCollaborative ? 'Outros podem riscar (Clique para bloquear)' : 'Apenas você pode riscar (Clique para liberar)'}
                data-testid="toggle-collab-btn"
              >
                {isCollaborative ? <Users size={14} /> : <Lock size={14} />}
                <span>{isCollaborative ? 'Colaborativo' : 'Apenas Você'}</span>
              </button>
            </>
          )}

          {onOpenDocumentPip && (
            <>
              <div className="annotation-divider" />
              <button
                type="button"
                className="annotation-tool-btn"
                onClick={onOpenDocumentPip}
                title="Janela Flutuante Always-on-Top (Riscar enquanto usa Google/outros apps)"
                data-testid="open-document-pip-toolbar-btn"
              ><PictureInPicture2 size={16} /></button>
            </>
          )}

          <div className="annotation-divider" />
          <button
            type="button"
            className="annotation-tool-btn close-toolbar-btn"
            onClick={toggleActive}
            title="Fechar barra de desenho"
            data-testid="close-annotation-toolbar-btn"
          ><X size={16} /></button>
        </div>
      )}
    </div>
  );
}
