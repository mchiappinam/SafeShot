import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeToolbarPositions } from '../../src/renderer/toolbar/toolbar-position';
import {
  DRAWING_TOOLBAR_WIDTH, DRAWING_TOOLBAR_HEIGHT,
  ACTION_TOOLBAR_WIDTH, ACTION_TOOLBAR_HEIGHT,
} from '../../src/shared/constants';
import type { Selection, Rectangle } from '../../src/shared/types';

const dimArb = fc.integer({ min: 1, max: 500 });
const selectionArb: fc.Arbitrary<Selection> = fc.record({
  x: fc.integer({ min: 0, max: 800 }),
  y: fc.integer({ min: 0, max: 600 }),
  width: dimArb,
  height: dimArb,
});
const boundsArb: fc.Arbitrary<Rectangle> = fc.record({
  x: fc.constant(0),
  y: fc.constant(0),
  width: fc.integer({ min: 400, max: 2560 }),
  height: fc.integer({ min: 300, max: 1440 }),
});

describe('Toolbar Positioning Property Tests', () => {
  it('Property 8: toolbar positions are always within screen bounds', () => {
    fc.assert(fc.property(selectionArb, boundsArb, (sel, bounds) => {
      const clampedSel: Selection = {
        x: Math.min(sel.x, bounds.width - 1),
        y: Math.min(sel.y, bounds.height - 1),
        width: Math.min(sel.width, bounds.width),
        height: Math.min(sel.height, bounds.height),
      };
      const { drawing, action } = computeToolbarPositions(clampedSel, bounds);
      expect(drawing.y).toBeGreaterThanOrEqual(bounds.y);
      expect(action.x).toBeGreaterThanOrEqual(bounds.x);
    }));
  });

  it('Property 9: drawing and action toolbars do not overlap', () => {
    fc.assert(fc.property(
      fc.record({
        x: fc.integer({ min: 100, max: 400 }),
        y: fc.integer({ min: 100, max: 300 }),
        width: fc.integer({ min: 50, max: 200 }),
        height: fc.integer({ min: 50, max: 200 }),
      }),
      fc.record({ x: fc.constant(0), y: fc.constant(0), width: fc.constant(1920), height: fc.constant(1080) }),
      (sel, bounds) => {
        const { drawing, action } = computeToolbarPositions(sel, bounds);
        const dRight = drawing.x + DRAWING_TOOLBAR_WIDTH;
        const dBottom = drawing.y + DRAWING_TOOLBAR_HEIGHT;
        const aRight = action.x + ACTION_TOOLBAR_WIDTH;
        const aBottom = action.y + ACTION_TOOLBAR_HEIGHT;
        const overlapsX = drawing.x < aRight && dRight > action.x;
        const overlapsY = drawing.y < aBottom && dBottom > action.y;
        expect(overlapsX && overlapsY).toBe(false);
      }
    ));
  });
});
