import type { Annotation, Point, ToolType } from '../../shared/types';
import { DEFAULT_COLOR, STROKE_WIDTH } from '../../shared/constants';
import { UndoRedoStack } from '../state/undo-redo';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function strokeWidthForTool(tool: ToolType): number {
  if (tool === 'pencil') return STROKE_WIDTH.pencil;
  if (tool === 'sharpie') return STROKE_WIDTH.sharpie;
  return STROKE_WIDTH.shapes;
}

export class AnnotationEngine {
  private tool: ToolType | null = null;
  private color: string = DEFAULT_COLOR;
  private stack = new UndoRedoStack();
  private preview: Annotation | null = null;
  private currentPoints: Point[] = [];

  setTool(tool: ToolType | null): void { this.tool = tool; }
  setColor(color: string): void { this.color = color; }
  getColor(): string { return this.color; }

  startStroke(point: Point): void {
    if (!this.tool) return;
    this.currentPoints = [point];
    this.preview = {
      id: generateId(),
      tool: this.tool,
      color: this.color,
      strokeWidth: strokeWidthForTool(this.tool),
      points: [point],
    };
  }

  updateStroke(point: Point): void {
    if (!this.tool || !this.preview) return;
    if (this.tool === 'pencil' || this.tool === 'sharpie') {
      this.currentPoints = [...this.currentPoints, point];
    } else {
      this.currentPoints = [this.currentPoints[0], point];
    }
    this.preview = { ...this.preview, points: [...this.currentPoints] };
  }

  finalizeStroke(): void {
    if (!this.preview) return;
    this.stack.push({ ...this.preview });
    this.preview = null;
    this.currentPoints = [];
  }

  undo(): boolean { return this.stack.undo(); }
  redo(): boolean { return this.stack.redo(); }
  canUndo(): boolean { return this.stack.canUndo(); }
  canRedo(): boolean { return this.stack.canRedo(); }
  getAnnotations(): Annotation[] { return this.stack.getAnnotations(); }
  getPreview(): Annotation | null { return this.preview; }
  clear(): void { this.stack.clear(); this.preview = null; this.currentPoints = []; }
}
