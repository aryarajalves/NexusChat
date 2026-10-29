import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PIP_CORNERS,
  getNormalizedPipCoords,
  createCompositeStream,
} from './videoCompositeUtils';

describe('videoCompositeUtils', () => {
  describe('getNormalizedPipCoords', () => {
    it('returns bottom-right coordinates as default', () => {
      const coords = getNormalizedPipCoords();
      expect(coords.width).toBeCloseTo(0.23);
      expect(coords.height).toBeCloseTo(0.27);
      expect(coords.x).toBeGreaterThan(0.7);
      expect(coords.y).toBeGreaterThan(0.6);
    });

    it('returns correct coordinates for bottom-left corner', () => {
      const coords = getNormalizedPipCoords({ corner: PIP_CORNERS.BOTTOM_LEFT });
      expect(coords.x).toBeCloseTo(0.03);
      expect(coords.y).toBeGreaterThan(0.6);
    });

    it('returns correct coordinates for top-right corner', () => {
      const coords = getNormalizedPipCoords({ corner: PIP_CORNERS.TOP_RIGHT });
      expect(coords.x).toBeGreaterThan(0.7);
      expect(coords.y).toBeCloseTo(0.04);
    });

    it('returns correct coordinates for top-left corner', () => {
      const coords = getNormalizedPipCoords({ corner: PIP_CORNERS.TOP_LEFT });
      expect(coords.x).toBeCloseTo(0.03);
      expect(coords.y).toBeCloseTo(0.04);
    });

    it('clamps custom pixel coordinates properly within normalized 0-1 bounds', () => {
      const coords = getNormalizedPipCoords(
        {
          corner: PIP_CORNERS.CUSTOM,
          customCoords: { x: 500, y: 300 },
        },
        1000,
        600
      );
      expect(coords.x).toBeCloseTo(0.5);
      expect(coords.y).toBeCloseTo(0.5);
    });
  });

  describe('createCompositeStream', () => {
    let mockScreenStream;
    let mockAudioStream;
    let mockCameraStream;

    beforeEach(() => {
      mockScreenStream = {
        getVideoTracks: () => [{ id: 'screen-v1' }],
        getAudioTracks: () => [{ id: 'screen-a1' }],
        addTrack: vi.fn(),
      };
      mockAudioStream = {
        getAudioTracks: () => [{ id: 'mic-a1' }],
      };
      mockCameraStream = {
        getVideoTracks: () => [{ id: 'cam-v1' }],
        getAudioTracks: () => [],
      };
    });

    it('returns screenStream directly when cameraStream is not provided', () => {
      const result = createCompositeStream({
        screenStream: mockScreenStream,
        cameraStream: null,
        audioStream: mockAudioStream,
      });

      expect(result.stream).toBe(mockScreenStream);
      expect(mockScreenStream.addTrack).toHaveBeenCalled();
      expect(typeof result.stop).toBe('function');
    });

    it('handles environment fallback when canvas captureStream is unavailable', () => {
      const result = createCompositeStream({
        screenStream: mockScreenStream,
        cameraStream: mockCameraStream,
        audioStream: mockAudioStream,
      });

      expect(result.stream).toBeDefined();
      expect(typeof result.stop).toBe('function');
      result.stop();
    });

    it('creates composite stream when canvas captureStream is supported', () => {
      const mockCanvasStream = {
        addTrack: vi.fn(),
        getAudioTracks: () => [],
      };

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        const el = originalCreateElement(tag);
        if (tag === 'canvas') {
          el.captureStream = vi.fn(() => mockCanvasStream);
          el.getContext = vi.fn(() => ({
            drawImage: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            rect: vi.fn(),
            clip: vi.fn(),
            stroke: vi.fn(),
            fillRect: vi.fn(),
          }));
        }
        return el;
      });

      const result = createCompositeStream({
        screenStream: mockScreenStream,
        cameraStream: mockCameraStream,
        audioStream: mockAudioStream,
        getPipPosition: () => ({ corner: PIP_CORNERS.BOTTOM_RIGHT }),
      });

      expect(result.stream).toBe(mockCanvasStream);
      expect(mockCanvasStream.addTrack).toHaveBeenCalled();
      expect(typeof result.stop).toBe('function');
      result.stop();
    });
  });
});
