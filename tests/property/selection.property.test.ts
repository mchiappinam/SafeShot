import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  normalizeRect, constrainToBounds, resizeFromHandle, moveSelection,
} from '../../src/renderer/selection/selection-math';
import type { Selection, Rectangle, HandlePosition } from '../../src/shared/types';

const coordArb = fc.integer({ min: -1000, max: 1000 });
const dimArb = fc.integer({ min: 1, max: 500 });
const handleArb = fc.constantFrom<HandlePosition>('nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w');
const selectionArb: fc.Arbitrary<Selection> = fc.record({ x: coordArb, y: coordArb, width: dimArb, height: dimArb });
const boundsArb: fc.Arbitrary<Rectangle> = fc.record({ x: coordArb, y: coordArb, width: dimArb, height: dimArb });

describe('Selection Math Property Tests', () => {
  it('Property 1: normalizeRect always produces non-negative width and height', () => {
    fc.assert(fc.property(coordArb, coordArb, coordArb, coordArb, (x1, y1, x2, y2) => {
      const r = normalizeRect({ x: x1, y: y1 }, { x: x2, y: y2 });
      expect(r.width).toBeGreaterThanOrEqual(0);
      expect(r.height).toBeGreaterThanOrEqual(0);
    }));
  });

  it('Property 2: constrainToBounds result is always fully within bounds', () => {
    fc.assert(fc.property(selectionArb, boundsArb, (sel, bounds) => {
      const r = constrainToBounds(sel, bounds);
      expect(r.x).toBeGreaterThanOrEqual(bounds.x);
      expect(r.y).toBeGreaterThanOrEqual(bounds.y);
      expect(r.x + r.width).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(r.y + r.height).toBeLessThanOrEqual(bounds.y + bounds.height);
    }));
  });

  it('Property 3: resizeFromHandle preserves the opposite anchor point', () => {
    const largeBounds: Rectangle = { x: -2000, y: -2000, width: 4000, height: 4000 };
    fc.assert(fc.property(
      fc.record({ x: fc.integer({ min: -500, max: 500 }), y: fc.integer({ min: -500, max: 500 }), width: fc.integer({ min: 50, max: 200 }), height: fc.integer({ min: 50, max: 200 }) }),
      handleArb,
      fc.record({ x: fc.integer({ min: -20, max: 20 }), y: fc.integer({ min: -20, max: 20 }) }),
      (sel, handle, delta) => {
        const origRight = sel.x + sel.width, origBottom = sel.y + sel.height;
        const r = resizeFromHandle(sel, handle, delta, largeBounds);
        switch (handle) {
          case 'nw': expect(r.x + r.width).toBeCloseTo(origRight, 5); expect(r.y + r.height).toBeCloseTo(origBottom, 5); break;
          case 'ne': expect(r.x).toBeCloseTo(sel.x, 5); expect(r.y + r.height).toBeCloseTo(origBottom, 5); break;
          case 'sw': expect(r.x + r.width).toBeCloseTo(origRight, 5); expect(r.y).toBeCloseTo(sel.y, 5); break;
          case 'se': expect(r.x).toBeCloseTo(sel.x, 5); expect(r.y).toBeCloseTo(sel.y, 5); break;
          case 'n':  expect(r.y + r.height).toBeCloseTo(origBottom, 5); break;
          case 's':  expect(r.y).toBeCloseTo(sel.y, 5); break;
          case 'e':  expect(r.x).toBeCloseTo(sel.x, 5); break;
          case 'w':  expect(r.x + r.width).toBeCloseTo(origRight, 5); break;
        }
      }
    ));
  });

  it('Property 4: moveSelection preserves width and height', () => {
    fc.assert(fc.property(selectionArb, fc.record({ x: coordArb, y: coordArb }), boundsArb, (sel, delta, bounds) => {
      const fittingBounds: Rectangle = { x: bounds.x, y: bounds.y, width: Math.max(bounds.width, sel.width), height: Math.max(bounds.height, sel.height) };
      const r = moveSelection(sel, delta, fittingBounds);
      expect(r.width).toBe(sel.width);
      expect(r.height).toBe(sel.height);
    }));
  });
});
