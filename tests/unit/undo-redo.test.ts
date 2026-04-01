import { describe, it, expect } from 'vitest';
import { UndoRedoStack } from '../../src/renderer/state/undo-redo';
import type { Annotation } from '../../src/shared/types';

function makeAnn(id: string): Annotation {
  return { id, tool: 'pencil', color: '#FF0000', strokeWidth: 2, points: [{ x: 0, y: 0 }] };
}

describe('UndoRedoStack', () => {
  it('starts empty', () => {
    const s = new UndoRedoStack();
    expect(s.canUndo()).toBe(false);
    expect(s.canRedo()).toBe(false);
    expect(s.getAnnotations()).toEqual([]);
  });

  it('push adds annotation', () => {
    const s = new UndoRedoStack();
    s.push(makeAnn('a'));
    expect(s.getAnnotations()).toHaveLength(1);
    expect(s.canUndo()).toBe(true);
  });

  it('undo removes last annotation', () => {
    const s = new UndoRedoStack();
    s.push(makeAnn('a'));
    s.push(makeAnn('b'));
    s.undo();
    expect(s.getAnnotations()).toHaveLength(1);
    expect(s.getAnnotations()[0].id).toBe('a');
    expect(s.canRedo()).toBe(true);
  });

  it('redo restores undone annotation', () => {
    const s = new UndoRedoStack();
    s.push(makeAnn('a'));
    s.push(makeAnn('b'));
    s.undo();
    s.redo();
    expect(s.getAnnotations()).toHaveLength(2);
    expect(s.canRedo()).toBe(false);
  });

  it('new annotation after undo clears redo stack', () => {
    const s = new UndoRedoStack();
    s.push(makeAnn('a'));
    s.push(makeAnn('b'));
    s.undo();
    expect(s.canRedo()).toBe(true);
    s.push(makeAnn('c'));
    expect(s.canRedo()).toBe(false);
    expect(s.getAnnotations().map((a) => a.id)).toEqual(['a', 'c']);
  });

  it('undo returns false on empty stack', () => {
    const s = new UndoRedoStack();
    expect(s.undo()).toBe(false);
  });

  it('redo returns false when nothing undone', () => {
    const s = new UndoRedoStack();
    s.push(makeAnn('a'));
    expect(s.redo()).toBe(false);
  });

  it('clear empties both stacks', () => {
    const s = new UndoRedoStack();
    s.push(makeAnn('a'));
    s.undo();
    s.clear();
    expect(s.canUndo()).toBe(false);
    expect(s.canRedo()).toBe(false);
  });
});
