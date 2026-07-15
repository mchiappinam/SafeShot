import type { Annotation, FillMode, Point, ToolType } from '../../shared/types';
import { DEFAULT_COLOR, STROKE_WIDTH } from '../../shared/constants';
import { UndoRedoStack } from '../state/undo-redo';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function strokeWidthForTool(tool: ToolType, customWidth?: number): number {
  const w = customWidth ?? STROKE_WIDTH.pencil;
  if (tool === 'sharpie') return w * 2;
  return w;
}

export class AnnotationEngine {
  private tool: ToolType | null = null;
  private color: string = DEFAULT_COLOR;
  private customStrokeWidth: number = STROKE_WIDTH.pencil;
  private fillMode: FillMode = 'hollow';
  private stack = new UndoRedoStack();
  private preview: Annotation | null = null;
  private currentPoints: Point[] = [];
  private textInput: { point: Point; text: string } | null = null;
  private movingAnnotationId: string | null = null;
  private moveLastPoint: Point | null = null;
  private lastInteractedId: string | null = null;
  private textBold = false;
  private textItalic = false;
  private textUnderline = false;
  private textHighlight = false;
  private textSize = 16;

  setTool(tool: ToolType | null): void { this.tool = tool; }
  setColor(color: string): void { this.color = color; }
  setCustomStrokeWidth(w: number): void { this.customStrokeWidth = w; }
  setFillMode(mode: FillMode): void { this.fillMode = mode; }
  setTextBold(v: boolean): void { this.textBold = v; }
  setTextItalic(v: boolean): void { this.textItalic = v; }
  setTextUnderline(v: boolean): void { this.textUnderline = v; }
  setTextHighlight(v: boolean): void { this.textHighlight = v; }
  setTextSize(v: number): void { this.textSize = v; }
  getTextFormatting() { return { bold: this.textBold, italic: this.textItalic, underline: this.textUnderline, highlight: this.textHighlight, size: this.textSize }; }
  getColor(): string { return this.color; }

  getTextInput(): { point: Point; text: string } | null { return this.textInput; }

  startStroke(point: Point): void {
    if (!this.tool) return;

    // Finalize any pending text input first
    if (this.textInput) {
      this.finalizeText();
    }

    if (this.tool === 'text') {
      this.textInput = { point, text: '' };
      return;
    }

    // Eraser: hit-test and remove annotation at point
    if (this.tool === 'eraser') {
      this.eraseAt(point);
      return;
    }

    this.currentPoints = [point];
    this.preview = {
      id: generateId(),
      tool: this.tool,
      color: this.color,
      strokeWidth: strokeWidthForTool(this.tool, this.customStrokeWidth),
      points: [point],
      fillMode: this.fillMode,
    };
  }

  updateText(text: string): void {
    if (!this.textInput) return;
    this.textInput = { ...this.textInput, text };
    this.preview = {
      id: generateId(),
      tool: 'text',
      color: this.color,
      strokeWidth: this.textSize,
      points: [this.textInput.point],
      text,
      textBold: this.textBold,
      textItalic: this.textItalic,
      textUnderline: this.textUnderline,
      textHighlight: this.textHighlight,
      textSize: this.textSize,
    };
  }

  private textWrapWidth: number | undefined = undefined;

  setTextWrapWidth(w: number | undefined): void { this.textWrapWidth = w; }

  finalizeText(): void {
    if (!this.textInput || !this.textInput.text) {
      this.textInput = null;
      this.preview = null;
      return;
    }
    // Offset by textarea padding (2px) + border (1px) so rendered text matches textarea position
    const offset = 3;
    const adjustedPoint = { x: this.textInput.point.x + offset, y: this.textInput.point.y + offset };
    this.stack.push({
      id: generateId(),
      tool: 'text',
      color: this.color,
      strokeWidth: this.textSize,
      points: [adjustedPoint],
      text: this.textInput.text,
      textBold: this.textBold,
      textItalic: this.textItalic,
      textUnderline: this.textUnderline,
      textHighlight: this.textHighlight,
      textSize: this.textSize,
      textWidth: this.textWrapWidth,
    });
    this.textInput = null;
    this.preview = null;
    this.textWrapWidth = undefined;
  }

  updateStroke(point: Point): void {
    if (!this.tool || !this.preview) {
      // Eraser during drag: continuously erase
      if (this.tool === 'eraser') {
        this.eraseAt(point);
        return;
      }
      return;
    }
    if (this.tool === 'pencil' || this.tool === 'sharpie' || this.tool === 'calligraphy') {
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

  /** Hit-test annotations at a point (topmost first). Returns the annotation id or null. */
  hitTestAnnotation(point: Point): string | null {
    const anns = this.stack.getAnnotations();
    for (let i = anns.length - 1; i >= 0; i--) {
      const ann = anns[i];
      if (this.isPointNearAnnotation(point, ann)) return ann.id;
    }
    return null;
  }

  private isPointNearAnnotation(p: Point, ann: Annotation): boolean {
    const tolerance = Math.max(ann.strokeWidth, 8);
    if (ann.tool === 'text') {
      const [start] = ann.points;
      if (!start) return false;
      const fontSize = ann.textSize ?? 16;
      const lines = (ann.text ?? '').split('\n');
      const longestLine = lines.reduce((max, line) => Math.max(max, line.length), 0);
      const textW = ann.textWidth ?? longestLine * fontSize * 0.6;
      const lineHeight = fontSize + 4;
      const textH = lines.length * lineHeight;
      return p.x >= start.x && p.x <= start.x + textW && p.y >= start.y && p.y <= start.y + textH;
    }
    if (ann.tool === 'pencil' || ann.tool === 'sharpie' || ann.tool === 'calligraphy') {
      return ann.points.some(pt => Math.hypot(p.x - pt.x, p.y - pt.y) <= tolerance);
    }
    // For shapes with 2 points (start, end), check bounding box
    if (ann.points.length >= 2) {
      const [s, e] = ann.points;
      const minX = Math.min(s.x, e.x) - tolerance;
      const maxX = Math.max(s.x, e.x) + tolerance;
      const minY = Math.min(s.y, e.y) - tolerance;
      const maxY = Math.max(s.y, e.y) + tolerance;
      return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
    }
    return false;
  }

  startMoveAnnotation(id: string, point: Point): void {
    this.movingAnnotationId = id;
    this.moveLastPoint = point;
    this.lastInteractedId = id;
  }

  updateMoveAnnotation(point: Point): void {
    if (!this.movingAnnotationId || !this.moveLastPoint) return;
    const dx = point.x - this.moveLastPoint.x;
    const dy = point.y - this.moveLastPoint.y;
    this.moveLastPoint = point;
    this.stack.moveAnnotation(this.movingAnnotationId, dx, dy);
  }

  finalizeMoveAnnotation(): void {
    this.movingAnnotationId = null;
    this.moveLastPoint = null;
  }

  isMovingAnnotation(): boolean { return this.movingAnnotationId !== null; }

  // --- Text editing ---

  /** Remove an annotation from the stack and return it (for editing). */
  editAnnotation(id: string): Annotation | null {
    return this.stack.removeAnnotation(id);
  }

  // --- Resize annotations ---

  private resizingAnnotationId: string | null = null;
  private resizeCorner: string | null = null;
  private resizeOriginalPoints: Point[] = [];

  /** Check if a point is near a corner of any shape annotation's bounding box.
   *  Returns { id, corner } or null. Only works for 2-point shapes (not pencil/sharpie/text). */
  hitTestAnnotationCorner(point: Point): { id: string; corner: string } | null {
    const anns = this.stack.getAnnotations();
    const threshold = 10;
    for (let i = anns.length - 1; i >= 0; i--) {
      const ann = anns[i];
      // Only resize 2-point shapes
      if (ann.tool === 'pencil' || ann.tool === 'sharpie' || ann.tool === 'calligraphy' || ann.tool === 'text') continue;
      if (ann.points.length < 2) continue;
      const [s, e] = ann.points;
      // Check near start point
      if (Math.hypot(point.x - s.x, point.y - s.y) <= threshold) {
        return { id: ann.id, corner: 'start' };
      }
      // Check near end point
      if (Math.hypot(point.x - e.x, point.y - e.y) <= threshold) {
        return { id: ann.id, corner: 'end' };
      }
    }
    return null;
  }

  startResizeAnnotation(id: string, corner: string, point: Point): void {
    const anns = this.stack.getAnnotations();
    const ann = anns.find(a => a.id === id);
    if (!ann || ann.points.length < 2) return;
    this.resizingAnnotationId = id;
    this.resizeCorner = corner;
    this.resizeOriginalPoints = ann.points.map(p => ({ ...p }));
    this.lastInteractedId = id;
  }

  updateResizeAnnotation(point: Point): void {
    if (!this.resizingAnnotationId || !this.resizeCorner) return;
    const [s, e] = this.resizeOriginalPoints;
    let newPoints: Point[];
    if (this.resizeCorner === 'start') {
      newPoints = [{ x: point.x, y: point.y }, { ...e }];
    } else {
      newPoints = [{ ...s }, { x: point.x, y: point.y }];
    }
    this.stack.resizeAnnotation(this.resizingAnnotationId, newPoints);
  }

  finalizeResizeAnnotation(): void {
    this.resizingAnnotationId = null;
    this.resizeCorner = null;
    this.resizeOriginalPoints = [];
  }

  isResizingAnnotation(): boolean { return this.resizingAnnotationId !== null; }

  /** Erase the topmost annotation at the given point. Returns true if something was removed. */
  eraseAt(point: Point): boolean {
    const hitId = this.hitTestAnnotation(point);
    if (!hitId) return false;
    this.stack.removeAnnotation(hitId);
    return true;
  }

  /** Delete the last annotation that was moved or resized. Returns true if something was removed. */
  deleteLastInteracted(): boolean {
    if (!this.lastInteractedId) return false;
    const removed = this.stack.removeAnnotation(this.lastInteractedId);
    if (removed) {
      this.lastInteractedId = null;
      return true;
    }
    return false;
  }

  undo(): boolean { return this.stack.undo(); }
  redo(): boolean { return this.stack.redo(); }
  canUndo(): boolean { return this.stack.canUndo(); }
  canRedo(): boolean { return this.stack.canRedo(); }
  getAnnotations(): Annotation[] { return this.stack.getAnnotations(); }
  getPreview(): Annotation | null { return this.preview; }
  clear(): void { this.stack.clear(); this.preview = null; this.currentPoints = []; this.textInput = null; }
}
