import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { UndoRedoStack } from '../../src/renderer/state/undo-redo';
import type { Annotation } from '../../src/shared/types';

const annotationArb: fc.Arbitrary<Annotation> = fc.record({
  id: fc.uuid(),
  tool: fc.constantFrom('pencil', 'line', 'sharpie', 'circle', 'triangle', 'octagon' as const),
  color: fc.constant('#FF0000'),
  strokeWidth: fc.integer({ min: 1, max: 10 }),
  points: fc.array(fc.record({ x: fc.integer(), y: fc.integer() }), { minLength: 1, maxLength: 5 }),
});

describe('Undo/Redo Property Tests', () => {
  /**
   * Property 6: Undo followed by redo restores original state
   * Validates: Requirements 7.4, 7.5
   */
  it('Property 6: undo followed by redo restores original state', () => {
    fc.assert(fc.property(fc.array(annotationArb, { minLength: 1, maxLength: 10 }), (annotations) => {
      const stack = new UndoRedoStack();
      for (const ann of annotations) stack.push(ann);

      const before = stack.getAnnotations();
      stack.undo();
      stack.redo();
      const after = stack.getAnnotations();

      expect(after).toEqual(before);
    }));
  });

  /**
   * Property 7: New annotation after undo clears redo stack
   * Validates: Requirement 7.11
   */
  it('Property 7: new annotation after undo clears redo stack', () => {
    fc.assert(fc.property(
      fc.array(annotationArb, { minLength: 2, maxLength: 10 }),
      annotationArb,
      (annotations, newAnn) => {
        const stack = new UndoRedoStack();
        for (const ann of annotations) stack.push(ann);
        stack.undo();
        expect(stack.canRedo()).toBe(true);
        stack.push(newAnn);
        expect(stack.canRedo()).toBe(false);
      }
    ));
  });
});
