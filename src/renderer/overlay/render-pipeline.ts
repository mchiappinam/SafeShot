import { DIM_MASK_OPACITY, RESIZE_HANDLE_SIZE } from '../../shared/constants';
import type { Annotation, ScreenData, Selection } from '../../shared/types';
import { drawCircle, drawTriangle, drawOctagon, drawLine } from '../annotation/shapes';
import { drawFreehand } from '../annotation/freehand';

interface HandlePoint { x: number; y: number; }

function getHandlePoints(sel: Selection): HandlePoint[] {
  const { x, y, width, height } = sel;
  const cx = x + width / 2, cy = y + height / 2;
  return [
    { x, y }, { x: cx, y }, { x: x + width, y }, { x: x + width, y: cy },
    { x: x + width, y: y + height }, { x: cx, y: y + height },
    { x, y: y + height }, { x, y: cy },
  ];
}

/** Renders a single annotation using the shared shape/freehand functions. */
function renderAnnotation(ctx: CanvasRenderingContext2D, ann: Annotation): void {
  if (ann.points.length === 0) return;
  const [start, end] = ann.points;
  switch (ann.tool) {
    case 'pencil': case 'sharpie':
      drawFreehand(ctx, ann.points, ann.color, ann.strokeWidth);
      break;
    case 'line':
      if (start && end) drawLine(ctx, start, end, ann.color, ann.strokeWidth);
      break;
    case 'circle':
      if (start && end) drawCircle(ctx, start, end, ann.color, ann.strokeWidth);
      break;
    case 'triangle':
      if (start && end) drawTriangle(ctx, start, end, ann.color, ann.strokeWidth);
      break;
    case 'octagon':
      if (start && end) drawOctagon(ctx, start, end, ann.color, ann.strokeWidth);
      break;
  }
}

export class RenderPipeline {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private screens: ScreenData[] = [];
  private bitmaps: Map<string, ImageBitmap> = new Map();
  private selection: Selection | null = null;
  private annotations: Annotation[] = [];
  private preview: Annotation | null = null;
  private rafId: number | null = null;
  private running = false;
  private dirty = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
  }

  async setScreens(screens: ScreenData[]): Promise<void> {
    for (const bmp of this.bitmaps.values()) bmp.close();
    this.bitmaps.clear();
    this.screens = screens;
    if (screens.length === 0) return;
    await Promise.all(screens.map(async (s) => {
      // Decode base64 data URL directly — avoids fetch() which CSP can block
      const base64 = s.imageDataURL.replace(/^data:image\/\w+;base64,/, '');
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/png' });
      this.bitmaps.set(s.displayId, await createImageBitmap(blob));
    }));
    this.dirty = true;
  }

  setSelection(selection: Selection | null): void { this.selection = selection; this.dirty = true; }

  setAnnotations(annotations: Annotation[], preview: Annotation | null): void {
    this.annotations = annotations; this.preview = preview; this.dirty = true;
  }

  start(): void { this.running = true; this.scheduleFrame(); }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    // Release GPU resources
    for (const bmp of this.bitmaps.values()) bmp.close();
    this.bitmaps.clear();
  }

  requestRender(): void { this.dirty = true; if (!this.running) this.renderFrame(); }

  private scheduleFrame(): void {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(() => {
      if (this.dirty) { this.renderFrame(); this.dirty = false; }
      this.scheduleFrame();
    });
  }

  private renderFrame(): void {
    const { ctx, canvas } = this;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Layer 0: frozen screen bitmaps
    for (const s of this.screens) {
      const bmp = this.bitmaps.get(s.displayId);
      if (bmp) ctx.drawImage(bmp, s.bounds.x, s.bounds.y, s.bounds.width, s.bounds.height);
    }

    // Layer 1: dim mask with selection cutout
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(0,0,0,${DIM_MASK_OPACITY})`;
    ctx.fillRect(0, 0, w, h);
    if (this.selection) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(this.selection.x, this.selection.y, this.selection.width, this.selection.height);
    }
    ctx.restore();

    if (!this.selection) return;
    const sel = this.selection;

    // Layer 2: annotations clipped to selection
    if (this.annotations.length > 0 || this.preview) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(sel.x, sel.y, sel.width, sel.height);
      ctx.clip();
      for (const ann of this.annotations) renderAnnotation(ctx, ann);
      if (this.preview) renderAnnotation(ctx, this.preview);
      ctx.restore();
    }

    // Layer 3: selection border
    this.drawSelectionBorder(sel);
    // Layer 4: resize handles
    this.drawResizeHandles(sel);
    // Layer 5: dimension label
    this.drawDimensionLabel(sel);
  }

  private drawSelectionBorder(sel: Selection): void {
    const ctx = this.ctx;
    const dashLen = 6;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'black';
    ctx.setLineDash([dashLen, dashLen]);
    ctx.lineDashOffset = 0;
    ctx.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.width - 1, sel.height - 1);
    ctx.strokeStyle = 'white';
    ctx.lineDashOffset = dashLen;
    ctx.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.width - 1, sel.height - 1);
    ctx.restore();
  }

  private drawResizeHandles(sel: Selection): void {
    const ctx = this.ctx;
    const half = RESIZE_HANDLE_SIZE / 2;
    ctx.save();
    for (const h of getHandlePoints(sel)) {
      ctx.fillStyle = 'white';
      ctx.fillRect(h.x - half, h.y - half, RESIZE_HANDLE_SIZE, RESIZE_HANDLE_SIZE);
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.strokeRect(h.x - half + 0.5, h.y - half + 0.5, RESIZE_HANDLE_SIZE - 1, RESIZE_HANDLE_SIZE - 1);
    }
    ctx.restore();
  }

  private drawDimensionLabel(sel: Selection): void {
    const ctx = this.ctx;
    const label = `${Math.round(sel.width)} × ${Math.round(sel.height)}`;
    const padding = 4, fontSize = 12;
    ctx.save();
    ctx.font = `${fontSize}px sans-serif`;
    const boxWidth = ctx.measureText(label).width + padding * 2;
    const boxHeight = fontSize + padding * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(sel.x + 4, sel.y + 4, boxWidth, boxHeight);
    ctx.fillStyle = 'white';
    ctx.textBaseline = 'top';
    ctx.fillText(label, sel.x + 4 + padding, sel.y + 4 + padding);
    ctx.restore();
  }
}
