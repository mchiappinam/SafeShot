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
  private textInput: { point: Point; text: string } | null = null;
  private onTextChange: (() => void) | null = null;

  setTool(tool: ToolType | null): void { this.tool = tool; }
  setColor(color: string): void { this.color = color; }
  getColor(): string { return this.color; }
  setOnTextChange(cb: (() => void) | null): void { this.onTextChange = cb; }

  getTextInput(): { point: Point; text: string } | null { return this.textInput; }

  startStroke(point: Point): void {
    if (!this.tool) return;

    // Finalize any pending text input first
    if (this.textInput) {
      this.finalizeText();
    }

    if (this.tool === 'text') {
      this.textInput = { point, text: '' };
      this.onTextChange?.();
      return;
    }

    this.currentPoints = [point];
    this.preview = {
      id: generateId(),
      tool: this.tool,
      color: this.color,
      strokeWidth: strokeWidthForTool(this.tool),
      points: [point],
    };
  }

  updateText(text: string): void {
    if (!this.textInput) return;
    this.textInput = { ...this.textInput, text };
    this.preview = {
      id: generateId(),
      tool: 'text',
      color: this.color,
      strokeWidth: 16,
      points: [this.textInput.point],
      text,
    };
    this.onTextChange?.();
  }

  finalizeText(): void {
    if (!this.textInput || !this.textInput.text) {
      this.textInput = null;
      this.preview = null;
      return;
    }
    this.stack.push({
      id: generateId(),
      tool: 'text',
      color: this.color,
      strokeWidth: 16,
      points: [this.textInput.point],
      text: this.textInput.text,
    });
    this.textInput = null;
    this.preview = null;
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
