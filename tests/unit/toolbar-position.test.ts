import { describe, it, expect } from 'vitest';
import { computeToolbarPositions, computeDrawingToolbarPosition, computeActionToolbarPosition, computeTextFormatBarPosition } from '../../src/renderer/toolbar/toolbar-position';
import { DRAWING_TOOLBAR_WIDTH, DRAWING_TOOLBAR_HEIGHT, ACTION_TOOLBAR_WIDTH, ACTION_TOOLBAR_HEIGHT, TEXT_FORMAT_BAR_WIDTH, TEXT_FORMAT_BAR_HEIGHT } from '../../src/shared/constants';

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

describe('computeToolbarPositions - overlap prevention', () => {
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

function rectsOverlap(
  a: { x: number; y: number }, aw: number, ah: number,
  b: { x: number; y: number }, bw: number, bh: number,
): boolean {
  return a.x < b.x + bw && a.x + aw > b.x && a.y < b.y + bh && a.y + ah > b.y;
}

describe('computeTextFormatBarPosition', () => {
  it('places the bar above the selection when there is room', () => {
    const sel = { x: 700, y: 400, width: 400, height: 300 };
    const action = computeActionToolbarPosition(sel, SCREEN, computeDrawingToolbarPosition(sel, SCREEN));
    const pos = computeTextFormatBarPosition(sel, SCREEN, action);
    expect(pos.edge).toBe('top');
    expect(pos.y + TEXT_FORMAT_BAR_HEIGHT).toBeLessThanOrEqual(sel.y);
  });

  it('never overlaps the action toolbar, even for a small selection near the top edge', () => {
    // This selection is short and sits flush against the top of the screen, so
    // there's no room for the text bar above the selection, and "below the
    // selection" is exactly where the action toolbar also lands. Regression
    // test: the text bar used to land directly on top of the action toolbar here.
    const sel = { x: 700, y: 0, width: 400, height: 100 };
    const action = computeActionToolbarPosition(sel, SCREEN, computeDrawingToolbarPosition(sel, SCREEN));
    const pos = computeTextFormatBarPosition(sel, SCREEN, action);
    expect(rectsOverlap(pos, TEXT_FORMAT_BAR_WIDTH, TEXT_FORMAT_BAR_HEIGHT, action, ACTION_TOOLBAR_WIDTH, ACTION_TOOLBAR_HEIGHT)).toBe(false);
    // And it should stay within screen bounds.
    expect(pos.y).toBeGreaterThanOrEqual(SCREEN.y);
    expect(pos.y + TEXT_FORMAT_BAR_HEIGHT).toBeLessThanOrEqual(SCREEN.y + SCREEN.height);
  });

  it('falls back to appending next to the action toolbar when the selection fills the screen', () => {
    // Selection spans the full screen height, so there's no room above or below it.
    const sel = { x: 0, y: 0, width: 400, height: SCREEN.height };
    const action = computeActionToolbarPosition(sel, SCREEN, computeDrawingToolbarPosition(sel, SCREEN));
    const pos = computeTextFormatBarPosition(sel, SCREEN, action);
    expect(rectsOverlap(pos, TEXT_FORMAT_BAR_WIDTH, TEXT_FORMAT_BAR_HEIGHT, action, ACTION_TOOLBAR_WIDTH, ACTION_TOOLBAR_HEIGHT)).toBe(false);
  });

  it('never overlaps the action toolbar for a range of small selections near screen edges', () => {
    const positions = [
      { x: 0, y: 0, width: 300, height: 60 },
      { x: 1600, y: 0, width: 300, height: 60 },
      { x: 700, y: 1020, width: 300, height: 60 },
      { x: 0, y: 1020, width: 300, height: 60 },
    ];
    for (const sel of positions) {
      const drawing = computeDrawingToolbarPosition(sel, SCREEN);
      const action = computeActionToolbarPosition(sel, SCREEN, drawing);
      const pos = computeTextFormatBarPosition(sel, SCREEN, action);
      expect(rectsOverlap(pos, TEXT_FORMAT_BAR_WIDTH, TEXT_FORMAT_BAR_HEIGHT, action, ACTION_TOOLBAR_WIDTH, ACTION_TOOLBAR_HEIGHT)).toBe(false);
    }
  });
});
