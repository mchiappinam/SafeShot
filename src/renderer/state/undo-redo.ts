import type { Annotation } from '../../shared/types';

/**
 * Immutable undo/redo stack for annotations.
 * Requirements: 7.4, 7.5, 7.9, 7.10, 7.11
 */
export class UndoRedoStack {
  private done: Annotation[] = [];
  private undone: Annotation[] = [];

  /** Push a new annotation. Clears the redo buffer (Req 7.11). */
  push(annotation: Annotation): void {
    this.done = [...this.done, annotation];
    this.undone = [];
  }

  /** Undo the last annotation. Returns false if nothing to undo (Req 7.4, 7.9). */
  undo(): boolean {
    if (this.done.length === 0) return false;
    const last = this.done[this.done.length - 1];
    this.done = this.done.slice(0, -1);
    this.undone = [last, ...this.undone];
    return true;
  }

  /** Redo the last undone annotation. Returns false if nothing to redo (Req 7.5, 7.10). */
  redo(): boolean {
    if (this.undone.length === 0) return false;
    const next = this.undone[0];
    this.undone = this.undone.slice(1);
    this.done = [...this.done, next];
    return true;
  }

  canUndo(): boolean { return this.done.length > 0; }
  canRedo(): boolean { return this.undone.length > 0; }

  getAnnotations(): Annotation[] { return [...this.done]; }

  /** Move an annotation by delta. */
  moveAnnotation(id: string, dx: number, dy: number): void {
    this.done = this.done.map(ann => {
      if (ann.id !== id) return ann;
      return { ...ann, points: ann.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
    });
  }

  clear(): void { this.done = []; this.undone = []; }
}
