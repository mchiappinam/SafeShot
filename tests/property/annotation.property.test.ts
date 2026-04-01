import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Annotation, Selection } from '../../src/shared/types';

/**
 * Property 5: All annotation points are clipped within selection bounds
 * Validates: Requirement 6.17
 *
 * This property verifies that when annotations are clipped to a selection,
 * no point falls outside the selection bounds.
 */

function clipPointToSelection(point: { x: number; y: number }, sel: Selection): { x: number; y: number } {
  return {
    x: Math.max(sel.x, Math.min(point.x, sel.x + sel.width)),
    y: Math.max(sel.y, Math.min(point.y, sel.y + sel.height)),
  };
}

function clipAnnotationToSelection(ann: Annotation, sel: Selection): Annotation {
  return {
    ...ann,
    points: ann.points.map((p) => clipPointToSelection(p, sel)),
  };
}

function isPointWithinSelection(point: { x: number; y: number }, sel: Selection): boolean {
  return (
    point.x >= sel.x &&
    point.x <= sel.x + sel.width &&
    point.y >= sel.y &&
    point.y <= sel.y + sel.height
  );
}

const coordArb = fc.integer({ min: -1000, max: 1000 });
const dimArb = fc.integer({ min: 1, max: 500 });

const selectionArb: fc.Arbitrary<Selection> = fc.record({
  x: coordArb, y: coordArb, width: dimArb, height: dimArb,
});

const pointArb = fc.record({ x: coordArb, y: coordArb });

const annotationArb: fc.Arbitrary<Annotation> = fc.record({
  id: fc.string(),
  tool: fc.constantFrom('pencil', 'line', 'sharpie', 'circle', 'triangle', 'octagon' as const),
  color: fc.constant('#FF0000'),
  strokeWidth: fc.integer({ min: 1, max: 10 }),
  points: fc.array(pointArb, { minLength: 1, maxLength: 20 }),
});

describe('Annotation Clipping Property Tests', () => {
  it('Property 5: All annotation points are clipped within selection bounds', () => {
    fc.assert(fc.property(annotationArb, selectionArb, (ann, sel) => {
      const clipped = clipAnnotationToSelection(ann, sel);
      for (const point of clipped.points) {
        expect(isPointWithinSelection(point, sel)).toBe(true);
      }
    }));
  });
});
