import { describe, it, expect } from 'vitest';
import { computeToolbarPositions, computeDrawingToolbarPosition, computeActionToolbarPosition } from '../../src/renderer/toolbar/toolbar-position';
import { DRAWING_TOOLBAR_WIDTH, DRAWING_TOOLBAR_HEIGHT, ACTION_TOOLBAR_WIDTH, ACTION_TOOLBAR_HEIGHT } from '../../src/shared/constants';

const SCREEN = { x: 0, y: 0, width: 1920, height: 1080 };

describe('computeDrawingToolbarPosition', () => {
  it('places toolbar to the right by default', () => {
    const sel = { x: 100, y: 100, width: 400, height: 300 };
    const pos = computeDrawingToolbarPosition(sel, SCREEN);
    expect(pos.side).toBe('right');
    expect(pos.x).toBeGreaterThan(sel.x + sel.width);
  });

  it('flips to left when near right edge', () => {
    const sel = { x: 1800, y: 100, width: 100, height: 300 };
    const pos = computeDrawingToolbarPosition(sel, SCREEN);
    expect(pos.side).toBe('left');
    expect(pos.x).toBeLessThan(sel.x);
  });

  it('y is clamped within screen bounds', () => {
    const sel = { x: 100, y: 0, width: 200, height: 100 };
    const pos = computeDrawingToolbarPosition(sel, SCREEN);
    expect(pos.y).toBeGreaterThanOrEqual(SCREEN.y);
  });
});

describe('computeActionToolbarPosition', () => {
  it('places toolbar below by default', () => {
    const sel = { x: 100, y: 100, width: 400, height: 300 };
    const drawing = computeDrawingToolbarPosition(sel, SCREEN);
    const pos = computeActionToolbarPosition(sel, SCREEN, drawing);
    expect(pos.edge).toBe('bottom');
    expect(pos.y).toBeGreaterThan(sel.y + sel.height);
  });

  it('flips above when near bottom edge', () => {
    const sel = { x: 100, y: 1000, width: 400, height: 60 };
    const drawing = computeDrawingToolbarPosition(sel, SCREEN);
    const pos = computeActionToolbarPosition(sel, SCREEN, drawing);
    expect(pos.edge).toBe('top');
    expect(pos.y).toBeLessThan(sel.y);
  });
});

describe('computeToolbarPositions — overlap prevention', () => {
  it('drawing and action toolbars do not overlap for centered selection', () => {
    const sel = { x: 760, y: 390, width: 400, height: 300 };
    const { drawing, action } = computeToolbarPositions(sel, SCREEN);
    const dRight = drawing.x + DRAWING_TOOLBAR_WIDTH;
    const dBottom = drawing.y + DRAWING_TOOLBAR_HEIGHT;
    const aRight = action.x + ACTION_TOOLBAR_WIDTH;
    const aBottom = action.y + ACTION_TOOLBAR_HEIGHT;
    const overlapsX = drawing.x < aRight && dRight > action.x;
    const overlapsY = drawing.y < aBottom && dBottom > action.y;
    expect(overlapsX && overlapsY).toBe(false);
  });
});
