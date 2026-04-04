import { DIM_MASK_OPACITY, RESIZE_HANDLE_SIZE } from '../../shared/constants';
import type { Annotation, ScreenData, Selection } from '../../shared/types';
import { drawCircle, drawTriangle, drawOctagon, drawLine, drawArrow, drawSquare, drawText } from '../annotation/shapes';
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
    case 'pencil':
      drawFreehand(ctx, ann.points, ann.color, ann.strokeWidth);
      break;
    case 'sharpie':
      drawFreehand(ctx, ann.points, ann.color, ann.strokeWidth, 0.4);
      break;
    case 'line':
      if (start && end) drawLine(ctx, start, end, ann.color, ann.strokeWidth);
      break;
    case 'arrow':
      if (start && end) drawArrow(ctx, start, end, ann.color, ann.strokeWidth);
      break;
    case 'circle':
      if (start && end) drawCircle(ctx, start, end, ann.color, ann.strokeWidth, ann.solid ?? false);
      break;
    case 'triangle':
      if (start && end) drawTriangle(ctx, start, end, ann.color, ann.strokeWidth, ann.solid ?? false);
      break;
    case 'octagon':
      if (start && end) drawOctagon(ctx, start, end, ann.color, ann.strokeWidth, ann.solid ?? false);
      break;
    case 'square':
      if (start && end) drawSquare(ctx, start, end, ann.color, ann.strokeWidth, ann.solid ?? false);
      break;
    case 'text':
      if (start && ann.text) drawText(ctx, start, ann.text, ann.color, 16);
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
  private offsetX = 0;
  private offsetY = 0;
  private totalWidth = 1;
  private totalHeight = 1;

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
    // Compute offset so virtual screen coords map to canvas 0,0
    this.offsetX = Math.min(...screens.map(s => s.bounds.x));
    this.offsetY = Math.min(...screens.map(s => s.bounds.y));
    const maxX = Math.max(...screens.map(s => s.bounds.x + s.bounds.width));
    const maxY = Math.max(...screens.map(s => s.bounds.y + s.bounds.height));
    this.totalWidth = maxX - this.offsetX || 1;
    this.totalHeight = maxY - this.offsetY || 1;
    await Promise.all(screens.map(async (s) => {
      // Decode base64 data URL directly, avoids fetch() which CSP can block
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

  /** Get the color of a pixel at the given logical coordinates. */
  getPixelColor(x: number, y: number): string | null {
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(x * dpr);
    const py = Math.round(y * dpr);
    try {
      const data = this.ctx.getImageData(px, py, 1, 1).data;
      const hex = '#' + [data[0], data[1], data[2]].map(v => v.toString(16).padStart(2, '0')).join('');
      return hex.toUpperCase();
    } catch { return null; }
  }

  /** Render only the screen bitmaps + annotations for the selection region (no dim, no border, no handles, no label). */
  renderCleanExport(sel: { x: number; y: number; width: number; height: number }, annotations: Annotation[], preview: Annotation | null): HTMLCanvasElement | null {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(sel.width * dpr);
    const h = Math.round(sel.height * dpr);
    if (w <= 0 || h <= 0) return null;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = w;
    exportCanvas.height = h;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(dpr, dpr);

    // Use logical dimensions for coordinate math
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    for (const s of this.screens) {
      const bmp = this.bitmaps.get(s.displayId);
      if (bmp) {
        const sx = (s.bounds.x - this.offsetX) / this.totalWidth * cw;
        const sy = (s.bounds.y - this.offsetY) / this.totalHeight * ch;
        const sw = s.bounds.width / this.totalWidth * cw;
        const sh = s.bounds.height / this.totalHeight * ch;
        ctx.drawImage(bmp, sx - sel.x, sy - sel.y, sw, sh);
      }
    }

    // Draw annotations offset
    if (annotations.length > 0 || preview) {
      ctx.save();
      ctx.translate(-sel.x, -sel.y);
      ctx.beginPath();
      ctx.rect(sel.x, sel.y, sel.width, sel.height);
      ctx.clip();
      for (const ann of annotations) renderAnnotation(ctx, ann);
      if (preview) renderAnnotation(ctx, preview);
      ctx.restore();
    }

    return exportCanvas;
  }

  private scheduleFrame(): void {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(() => {
      if (this.dirty) { this.renderFrame(); this.dirty = false; }
      this.scheduleFrame();
    });
  }

  private renderFrame(): void {
    const { ctx } = this;
    // Use logical (CSS) dimensions since context is scaled by devicePixelRatio
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    // Layer 0: frozen screen bitmaps, scale to fill canvas
    for (const s of this.screens) {
      const bmp = this.bitmaps.get(s.displayId);
      if (bmp) {
        const sx = (s.bounds.x - this.offsetX) / this.totalWidth * w;
        const sy = (s.bounds.y - this.offsetY) / this.totalHeight * h;
        const sw = s.bounds.width / this.totalWidth * w;
        const sh = s.bounds.height / this.totalHeight * h;
        ctx.drawImage(bmp, sx, sy, sw, sh);
      }
    }

    // Layer 1: dim mask over entire canvas, then redraw the selection area
    // on top so it appears clear (not punched out, which would show the background)
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${DIM_MASK_OPACITY})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Layer 2: redraw the selection region from bitmaps so it appears undimmed
    if (this.selection) {
      const sel = this.selection;
      ctx.save();
      ctx.beginPath();
      ctx.rect(sel.x, sel.y, sel.width, sel.height);
      ctx.clip();
      for (const s of this.screens) {
        const bmp = this.bitmaps.get(s.displayId);
        if (bmp) {
          const sx = (s.bounds.x - this.offsetX) / this.totalWidth * w;
          const sy = (s.bounds.y - this.offsetY) / this.totalHeight * h;
          const sw = s.bounds.width / this.totalWidth * w;
          const sh = s.bounds.height / this.totalHeight * h;
          ctx.drawImage(bmp, sx, sy, sw, sh);
        }
      }
      ctx.restore();
    }

    if (!this.selection) return;
    const sel = this.selection;

    // Layer 3: annotations clipped to selection
    if (this.annotations.length > 0 || this.preview) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(sel.x, sel.y, sel.width, sel.height);
      ctx.clip();
      for (const ann of this.annotations) renderAnnotation(ctx, ann);
      if (this.preview) renderAnnotation(ctx, this.preview);
      ctx.restore();
    }

    // Layer 4: selection border
    this.drawSelectionBorder(sel);
    // Layer 5: resize handles
    this.drawResizeHandles(sel);
    // Layer 6: dimension label
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
