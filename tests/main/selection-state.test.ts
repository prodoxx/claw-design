import { describe, it, expect } from 'vitest';
import {
  transition,
  INITIAL_STATE,
  MIN_SELECTION_SIZE,
  type SelectionState,
  type SelectionEvent,
  type OverlayMode,
  type SelectionBounds,
} from '../../src/renderer/overlay.js';

describe('selection state machine', () => {
  describe('ACTIVATE_RECT', () => {
    it('transitions from inactive to rect-idle', () => {
      const next = transition(INITIAL_STATE, { type: 'ACTIVATE_RECT' });
      expect(next.mode).toBe('rect-idle');
    });

    it('transitions from rect-committed to rect-idle (new selection)', () => {
      const committed: SelectionState = {
        ...INITIAL_STATE,
        mode: 'rect-committed',
        selectionBounds: { x: 10, y: 10, width: 100, height: 100 },
      };
      const next = transition(committed, { type: 'ACTIVATE_RECT' });
      expect(next.mode).toBe('rect-idle');
      expect(next.selectionBounds).toBeNull();
    });

    it('transitions from elem-committed to rect-idle (switch mode)', () => {
      const committed: SelectionState = {
        ...INITIAL_STATE,
        mode: 'elem-committed',
        selectionBounds: { x: 10, y: 10, width: 100, height: 100 },
      };
      const next = transition(committed, { type: 'ACTIVATE_RECT' });
      expect(next.mode).toBe('rect-idle');
      expect(next.selectionBounds).toBeNull();
    });
  });

  describe('ACTIVATE_ELEM', () => {
    it('transitions from inactive to elem-idle', () => {
      const next = transition(INITIAL_STATE, { type: 'ACTIVATE_ELEM' });
      expect(next.mode).toBe('elem-idle');
    });

    it('transitions from rect-committed to elem-idle (switch mode)', () => {
      const committed: SelectionState = {
        ...INITIAL_STATE,
        mode: 'rect-committed',
        selectionBounds: { x: 10, y: 10, width: 100, height: 100 },
      };
      const next = transition(committed, { type: 'ACTIVATE_ELEM' });
      expect(next.mode).toBe('elem-idle');
      expect(next.selectionBounds).toBeNull();
    });
  });

  describe('Rectangle drawing', () => {
    it('transitions from rect-idle to rect-drawing on MOUSE_DOWN', () => {
      const idle: SelectionState = { ...INITIAL_STATE, mode: 'rect-idle' };
      const next = transition(idle, { type: 'MOUSE_DOWN', x: 100, y: 200 });
      expect(next.mode).toBe('rect-drawing');
      expect(next.startX).toBe(100);
      expect(next.startY).toBe(200);
      expect(next.currentX).toBe(100);
      expect(next.currentY).toBe(200);
    });

    it('updates currentX/currentY on MOUSE_MOVE during rect-drawing', () => {
      const drawing: SelectionState = {
        ...INITIAL_STATE,
        mode: 'rect-drawing',
        startX: 100,
        startY: 200,
        currentX: 100,
        currentY: 200,
      };
      const next = transition(drawing, { type: 'MOUSE_MOVE', x: 250, y: 350 });
      expect(next.mode).toBe('rect-drawing');
      expect(next.currentX).toBe(250);
      expect(next.currentY).toBe(350);
      expect(next.startX).toBe(100);
      expect(next.startY).toBe(200);
    });

    it('commits selection on MOUSE_UP when size >= MIN_SELECTION_SIZE', () => {
      const drawing: SelectionState = {
        ...INITIAL_STATE,
        mode: 'rect-drawing',
        startX: 100,
        startY: 100,
        currentX: 200,
        currentY: 200,
      };
      const next = transition(drawing, { type: 'MOUSE_UP', x: 200, y: 200 });
      expect(next.mode).toBe('rect-committed');
      expect(next.selectionBounds).toEqual({
        x: 100,
        y: 100,
        width: 100,
        height: 100,
      });
    });

    it('returns to rect-idle on MOUSE_UP when selection too small', () => {
      const drawing: SelectionState = {
        ...INITIAL_STATE,
        mode: 'rect-drawing',
        startX: 100,
        startY: 100,
        currentX: 105,
        currentY: 105,
      };
      const next = transition(drawing, { type: 'MOUSE_UP', x: 105, y: 105 });
      expect(next.mode).toBe('rect-idle');
      expect(next.selectionBounds).toBeNull();
    });

    it('computes correct bounds when drawing right-to-left', () => {
      const drawing: SelectionState = {
        ...INITIAL_STATE,
        mode: 'rect-drawing',
        startX: 300,
        startY: 400,
        currentX: 100,
        currentY: 200,
      };
      const next = transition(drawing, { type: 'MOUSE_UP', x: 100, y: 200 });
      expect(next.mode).toBe('rect-committed');
      expect(next.selectionBounds).toEqual({
        x: 100,
        y: 200,
        width: 200,
        height: 200,
      });
    });
  });

  describe('Element selection', () => {
    it('transitions from elem-idle to elem-hovering on ELEMENT_HOVER', () => {
      const idle: SelectionState = { ...INITIAL_STATE, mode: 'elem-idle' };
      const rect: SelectionBounds = { x: 50, y: 50, width: 200, height: 100 };
      const next = transition(idle, { type: 'ELEMENT_HOVER', rect });
      expect(next.mode).toBe('elem-hovering');
      expect(next.hoveredRect).toEqual(rect);
    });

    it('updates hoveredRect on subsequent ELEMENT_HOVER in elem-hovering', () => {
      const hovering: SelectionState = {
        ...INITIAL_STATE,
        mode: 'elem-hovering',
        hoveredRect: { x: 50, y: 50, width: 200, height: 100 },
      };
      const newRect: SelectionBounds = { x: 100, y: 100, width: 300, height: 200 };
      const next = transition(hovering, { type: 'ELEMENT_HOVER', rect: newRect });
      expect(next.mode).toBe('elem-hovering');
      expect(next.hoveredRect).toEqual(newRect);
    });

    it('commits element selection on ELEMENT_CLICK in elem-hovering', () => {
      const hoveredRect: SelectionBounds = { x: 50, y: 50, width: 200, height: 100 };
      const hovering: SelectionState = {
        ...INITIAL_STATE,
        mode: 'elem-hovering',
        hoveredRect,
      };
      const next = transition(hovering, { type: 'ELEMENT_CLICK' });
      expect(next.mode).toBe('elem-committed');
      expect(next.selectionBounds).toEqual(hoveredRect);
    });
  });

  describe('CANCEL', () => {
    it('returns to inactive from any active mode', () => {
      const modes: OverlayMode[] = [
        'rect-idle',
        'rect-drawing',
        'rect-committed',
        'elem-idle',
        'elem-hovering',
        'elem-committed',
      ];
      for (const mode of modes) {
        const state: SelectionState = {
          ...INITIAL_STATE,
          mode,
          selectionBounds: { x: 10, y: 10, width: 100, height: 100 },
          hoveredRect: { x: 10, y: 10, width: 100, height: 100 },
        };
        const next = transition(state, { type: 'CANCEL' });
        expect(next.mode).toBe('inactive');
        expect(next.selectionBounds).toBeNull();
        expect(next.hoveredRect).toBeNull();
      }
    });

    it('clears selectionBounds from rect-committed on CANCEL', () => {
      const committed: SelectionState = {
        ...INITIAL_STATE,
        mode: 'rect-committed',
        selectionBounds: { x: 10, y: 10, width: 100, height: 100 },
      };
      const next = transition(committed, { type: 'CANCEL' });
      expect(next.mode).toBe('inactive');
      expect(next.selectionBounds).toBeNull();
    });

    it('clears selectionBounds from elem-committed on CANCEL', () => {
      const committed: SelectionState = {
        ...INITIAL_STATE,
        mode: 'elem-committed',
        selectionBounds: { x: 10, y: 10, width: 100, height: 100 },
      };
      const next = transition(committed, { type: 'CANCEL' });
      expect(next.mode).toBe('inactive');
      expect(next.selectionBounds).toBeNull();
    });
  });

  describe('Mode switching', () => {
    it('switches from rect-idle to elem-idle on ACTIVATE_ELEM', () => {
      const rectIdle: SelectionState = { ...INITIAL_STATE, mode: 'rect-idle' };
      const next = transition(rectIdle, { type: 'ACTIVATE_ELEM' });
      expect(next.mode).toBe('elem-idle');
    });

    it('switches from elem-idle to rect-idle on ACTIVATE_RECT', () => {
      const elemIdle: SelectionState = { ...INITIAL_STATE, mode: 'elem-idle' };
      const next = transition(elemIdle, { type: 'ACTIVATE_RECT' });
      expect(next.mode).toBe('rect-idle');
    });
  });

  describe('Invalid transitions', () => {
    it('ignores MOUSE_DOWN in inactive mode', () => {
      const next = transition(INITIAL_STATE, { type: 'MOUSE_DOWN', x: 100, y: 200 });
      expect(next).toEqual(INITIAL_STATE);
    });

    it('ignores ELEMENT_CLICK in elem-idle mode', () => {
      const idle: SelectionState = { ...INITIAL_STATE, mode: 'elem-idle' };
      const next = transition(idle, { type: 'ELEMENT_CLICK' });
      expect(next).toEqual(idle);
    });

    it('ignores MOUSE_UP in rect-idle mode', () => {
      const idle: SelectionState = { ...INITIAL_STATE, mode: 'rect-idle' };
      const next = transition(idle, { type: 'MOUSE_UP', x: 100, y: 200 });
      expect(next).toEqual(idle);
    });
  });

  describe('Constants', () => {
    it('MIN_SELECTION_SIZE is 16', () => {
      expect(MIN_SELECTION_SIZE).toBe(16);
    });

    it('INITIAL_STATE has mode inactive and null bounds', () => {
      expect(INITIAL_STATE.mode).toBe('inactive');
      expect(INITIAL_STATE.selectionBounds).toBeNull();
      expect(INITIAL_STATE.hoveredRect).toBeNull();
    });
  });
});
