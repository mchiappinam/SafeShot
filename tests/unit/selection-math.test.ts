import { describe, it, expect } from 'vitest';
import {
  normalizeRect, constrainToBounds, isMinimumSize,
  getResizeHandles, resizeFromHandle, moveSelection,
} from '../../src/renderer/selection/selection-math';

const BOUNDS = { x: 0, y: 0, width: 1920, height: 1080 };

describe('normalizeRect', () => {
  it('produces positive width/height when p2 < p1', () => {
    const r = normalizeRect({ x: 100, y: 100 }, { x: 50, y: 50 });
    expect(r.width).toBe(50);
    expect(r.height).toBe(50);
    expect(r.x).toBe(50);
    expect(r.y).toBe(50);
  });

  it('handles equal points', () => {
    const r = normalizeRect({ x: 10, y: 10 }, { x: 10, y: 10 });
    expect(r.width).toBe(0);
    expect(r.height).toBe(0);
  });
});

describe('constrainToBounds', () => {
  it('clamps selection within bounds', () => {
    const r = constrainToBounds({ x: -10, y: -10, width: 100, height: 100 }, BOUNDS);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
  });

  it('clamps width/height to bounds size', () => {
    const r = constrainToBounds({ x: 0, y: 0, width: 3000, height: 2000 }, BOUNDS);
    expect(r.width).toBeLessThanOrEqual(BOUNDS.width);
    expect(r.height).toBeLessThanOrEqual(BOUNDS.height);
  });
});

describe('isMinimumSize', () => {
  it('returns true for 5x5', () => expect(isMinimumSize({ x: 0, y: 0, width: 5, height: 5 })).toBe(true));
  it('returns false for 4x5', () => expect(isMinimumSize({ x: 0, y: 0, width: 4, height: 5 })).toBe(false));
  it('returns false for 5x4', () => expect(isMinimumSize({ x: 0, y: 0, width: 5, height: 4 })).toBe(false));
});

describe('getResizeHandles', () => {
  it('returns 8 handles', () => {
    const handles = getResizeHandles({ x: 10, y: 10, width: 100, height: 100 });
    expect(handles).toHaveLength(8);
  });

  it('nw handle is at top-left corner', () => {
    const handles = getResizeHandles({ x: 10, y: 20, width: 100, height: 80 });
    const nw = handles.find((h) => h.position === 'nw');
    expect(nw?.center).toEqual({ x: 10, y: 20 });
  });

  it('se handle is at bottom-right corner', () => {
    const handles = getResizeHandles({ x: 10, y: 20, width: 100, height: 80 });
    const se = handles.find((h) => h.position === 'se');
    expect(se?.center).toEqual({ x: 110, y: 100 });
  });
});

describe('resizeFromHandle', () => {
  const sel = { x: 100, y: 100, width: 200, height: 150 };

  it('se handle moves bottom-right, anchors top-left', () => {
    const r = resizeFromHandle(sel, 'se', { x: 10, y: 10 }, BOUNDS);
    expect(r.x).toBe(100);
    expect(r.y).toBe(100);
    expect(r.width).toBe(210);
    expect(r.height).toBe(160);
  });

  it('nw handle moves top-left, anchors bottom-right', () => {
    const r = resizeFromHandle(sel, 'nw', { x: 10, y: 10 }, BOUNDS);
    expect(r.x + r.width).toBeCloseTo(300, 5);
    expect(r.y + r.height).toBeCloseTo(250, 5);
  });

  it('n handle only changes height', () => {
    const r = resizeFromHandle(sel, 'n', { x: 0, y: -10 }, BOUNDS);
    expect(r.width).toBe(200);
    expect(r.y + r.height).toBeCloseTo(250, 5);
  });
});

describe('moveSelection', () => {
  it('moves by delta', () => {
    const r = moveSelection({ x: 100, y: 100, width: 200, height: 150 }, { x: 50, y: 30 }, BOUNDS);
    expect(r.x).toBe(150);
    expect(r.y).toBe(130);
    expect(r.width).toBe(200);
    expect(r.height).toBe(150);
  });

  it('preserves dimensions', () => {
    const sel = { x: 100, y: 100, width: 200, height: 150 };
    const r = moveSelection(sel, { x: 500, y: 500 }, BOUNDS);
    expect(r.width).toBe(sel.width);
    expect(r.height).toBe(sel.height);
  });
});
