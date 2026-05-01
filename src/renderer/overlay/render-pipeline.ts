import { DIM_MASK_OPACITY, RESIZE_HANDLE_SIZE } from '../../shared/constants';
import type { Annotation, ScreenData, Selection } from '../../shared/types';
import { drawCircle, drawTriangle, drawOctagon, drawLine, drawArrow, drawSquare, drawText, drawDiamond, drawStar, drawPentagon, drawHeart } from '../annotation/shapes';
import { drawFreehand, drawCalligraphy } from '../annotation/freehand';

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

// Reusable temp canvas for pixelateClipped to avoid creating one per frame
let _tmpCanvas: HTMLCanvasElement | null = null;
let _tmpCtx: CanvasRenderingContext2D | null = null;

/** Detect text lines in a region and draw black bars over them.
 *  Uses horizontal edge density to find rows with text-like patterns.
 *  Text has many sharp transitions (letter edges), while images/solid areas are smooth. */
function redactTextLines(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string = '#000000'): void {
  if (w <= 0 || h <= 0) return;
  const t = ctx.getTransform();
  let px = Math.round(t.a * x + t.e);
  let py = Math.round(t.d * y + t.f);
  let pw = Math.round(w * t.a);
  let ph = Math.round(h * t.d);
  if (pw <= 0 || ph <= 0) return;
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  if (px < 0) { pw += px; px = 0; }
  if (py < 0) { ph += py; py = 0; }
  if (px + pw > cw) pw = cw - px;
  if (py + ph > ch) ph = ch - py;
  if (pw <= 0 || ph <= 0) return;

  try {
    const imageData = ctx.getImageData(px, py, pw, ph);
    const data = imageData.data;

    // Convert to grayscale row data for edge detection
    const gray = new Uint8Array(pw * ph);
    for (let i = 0; i < pw * ph; i++) {
      const j = i * 4;
      gray[i] = Math.round(data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114);
    }

    // For each row, count horizontal edges (adjacent pixels with large brightness difference).
    // Text rows have many edges (letter strokes), images/solid colors have few.
    const edgeThreshold = 30; // minimum brightness jump to count as an edge
    const rowInfo: { edgeDensity: number; left: number; right: number }[] = [];

    for (let row = 0; row < ph; row++) {
      let edgeCount = 0;
      let left = pw;
      let right = 0;
      const rowOffset = row * pw;
      for (let col = 1; col < pw; col++) {
        const diff = Math.abs(gray[rowOffset + col] - gray[rowOffset + col - 1]);
        if (diff >= edgeThreshold) {
          edgeCount++;
          if (col < left) left = col;
          if (col > right) right = col;
        }
      }
      rowInfo.push({ edgeDensity: edgeCount / pw, left, right });
    }

    // Determine the edge density threshold adaptively.
    // Sort densities and pick a threshold that separates text from non-text.
    const densities = rowInfo.map(r => r.edgeDensity).filter(d => d > 0).sort((a, b) => a - b);
    if (densities.length === 0) return;
    // Text rows typically have edge density > 0.03 (3% of pixels are edges).
    // Use a minimum floor plus adaptive: at least the 30th percentile of non-zero densities.
    const adaptiveThreshold = Math.max(0.03, densities[Math.floor(densities.length * 0.3)] || 0.03);

    // Mark rows as text-like based on edge density
    const textRows = rowInfo.map(r => r.edgeDensity >= adaptiveThreshold);

    // Group consecutive text rows into bands
    const bands: { top: number; bottom: number; left: number; right: number }[] = [];
    let bandStart = -1;
    let bandLeft = pw;
    let bandRight = 0;
    const gapTolerance = Math.max(3, Math.round(ph * 0.008));

    for (let row = 0; row < ph; row++) {
      if (textRows[row]) {
        if (bandStart < 0) bandStart = row;
        if (rowInfo[row].left < bandLeft) bandLeft = rowInfo[row].left;
        if (rowInfo[row].right > bandRight) bandRight = rowInfo[row].right;
      } else if (bandStart >= 0) {
        let gapEnd = row;
        while (gapEnd < Math.min(row + gapTolerance, ph) && !textRows[gapEnd]) gapEnd++;
        if (gapEnd < ph && textRows[gapEnd] && gapEnd - row <= gapTolerance) {
          row = gapEnd - 1;
          continue;
        }
        // Only keep bands that are a reasonable height for text (not huge image blocks)
        const bandHeight = row - bandStart;
        if (bandHeight < ph * 0.4) {
          bands.push({ top: bandStart, bottom: row - 1, left: bandLeft, right: bandRight });
        }
        bandStart = -1;
        bandLeft = pw;
        bandRight = 0;
      }
    }
    if (bandStart >= 0) {
      const bandHeight = ph - bandStart;
      if (bandHeight < ph * 0.4) {
        bands.push({ top: bandStart, bottom: ph - 1, left: bandLeft, right: bandRight });
      }
    }

    // Draw black bars in logical coordinates
    const scaleX = t.a;
    const scaleY = t.d;
    const padding = 2 / scaleX; // small padding around each bar
    ctx.save();
    ctx.fillStyle = color;
    for (const band of bands) {
      const barX = x + (band.left / scaleX) - padding;
      const barY = y + (band.top / scaleY) - padding;
      const barW = (band.right - band.left + 1) / scaleX + padding * 2;
      const barH = (band.bottom - band.top + 1) / scaleY + padding * 2;
      ctx.fillRect(barX, barY, barW, barH);
    }
    ctx.restore();
  } catch { /* getImageData can fail on tainted canvas */ }
}

/** Pixelate a region and draw it clipped to a shape path.
 *  Since putImageData ignores clip/transform, we pixelate onto a temp canvas
 *  then drawImage it back through the clip path.
 *  Uses getTransform() to correctly map logical coords to pixel buffer coords.
 *  @param dprOverride - override devicePixelRatio for export canvases */
function pixelateClipped(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, blockSize: number = 10, dprOverride?: number): void {
  if (w <= 0 || h <= 0) return;
  // Use the current transform to map logical coords to actual pixel buffer coords
  const t = ctx.getTransform();
  let px = Math.round(t.a * x + t.e);
  let py = Math.round(t.d * y + t.f);
  let pw = Math.round(w * t.a);
  let ph = Math.round(h * t.d);
  if (pw <= 0 || ph <= 0) return;
  // Clamp to canvas bounds to avoid transparent-black fill on edges
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  if (px < 0) { pw += px; px = 0; }
  if (py < 0) { ph += py; py = 0; }
  if (px + pw > cw) pw = cw - px;
  if (py + ph > ch) ph = ch - py;
  if (pw <= 0 || ph <= 0) return;
  const dpr = dprOverride ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  try {
    const imageData = ctx.getImageData(px, py, pw, ph);
    const bs = Math.max(1, Math.round(blockSize * dpr));
    const data = imageData.data;
    for (let by = 0; by < ph; by += bs) {
      for (let bx = 0; bx < pw; bx += bs) {
        const sx = Math.min(bx + Math.floor(bs / 2), pw - 1);
        const sy = Math.min(by + Math.floor(bs / 2), ph - 1);
        const idx = (sy * pw + sx) * 4;
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        for (let dy = by; dy < Math.min(by + bs, ph); dy++) {
          for (let dx = bx; dx < Math.min(bx + bs, pw); dx++) {
            const i = (dy * pw + dx) * 4;
            data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = a;
          }
        }
      }
    }
    // Reuse temp canvas, resize only if needed
    if (!_tmpCanvas) { _tmpCanvas = document.createElement('canvas'); _tmpCtx = _tmpCanvas.getContext('2d'); }
    if (!_tmpCtx) return;
    if (_tmpCanvas.width < pw || _tmpCanvas.height < ph) {
      _tmpCanvas.width = pw; _tmpCanvas.height = ph;
    }
    _tmpCtx.putImageData(imageData, 0, 0);
    // drawImage respects the current clip path and transform on ctx
    ctx.drawImage(_tmpCanvas, 0, 0, pw, ph, x, y, w, h);
  } catch { /* getImageData can fail on tainted canvas */ }
}

/** Renders a single annotation using the shared shape/freehand functions.
 *  @param dprOverride - override devicePixelRatio for export canvases */
function renderAnnotation(ctx: CanvasRenderingContext2D, ann: Annotation, dprOverride?: number): void {
  if (ann.points.length === 0) return;
  const [start, end] = ann.points;
  const isBlur = ann.fillMode === 'blur';
  const isRedact = ann.fillMode === 'redact';

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
      if (start && end) {
        const bx = Math.min(start.x, end.x), by = Math.min(start.y, end.y);
        const bw = Math.abs(end.x - start.x), bh = Math.abs(end.y - start.y);
        if (isBlur || isRedact) {
          ctx.save();
          ctx.beginPath();
          ctx.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
          ctx.clip();
          if (isRedact) redactTextLines(ctx, bx, by, bw, bh, ann.color);
          else pixelateClipped(ctx, bx, by, bw, bh, 10, dprOverride);
          ctx.restore();
        } else {
          drawCircle(ctx, start, end, ann.color, ann.strokeWidth, ann.fillMode === 'solid');
        }
      }
      break;
    case 'triangle':
      if (start && end) {
        const bx = Math.min(start.x, end.x), by = Math.min(start.y, end.y);
        const bw = Math.abs(end.x - start.x), bh = Math.abs(end.y - start.y);
        if (isBlur || isRedact) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(bx + bw / 2, by);
          ctx.lineTo(bx + bw, by + bh);
          ctx.lineTo(bx, by + bh);
          ctx.closePath();
          ctx.clip();
          if (isRedact) redactTextLines(ctx, bx, by, bw, bh, ann.color);
          else pixelateClipped(ctx, bx, by, bw, bh, 10, dprOverride);
          ctx.restore();
        } else {
          drawTriangle(ctx, start, end, ann.color, ann.strokeWidth, ann.fillMode === 'solid');
        }
      }
      break;
    case 'octagon':
      if (start && end) {
        const bx = Math.min(start.x, end.x), by = Math.min(start.y, end.y);
        const bw = Math.abs(end.x - start.x), bh = Math.abs(end.y - start.y);
        if (isBlur || isRedact) {
          const cx = bx + bw / 2, cy = by + bh / 2;
          const rx = bw / 2, ry = bh / 2;
          ctx.save();
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8 - Math.PI / 8;
            const px = cx + rx * Math.cos(angle), py = cy + ry * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.clip();
          if (isRedact) redactTextLines(ctx, bx, by, bw, bh, ann.color);
          else pixelateClipped(ctx, bx, by, bw, bh, 10, dprOverride);
          ctx.restore();
        } else {
          drawOctagon(ctx, start, end, ann.color, ann.strokeWidth, ann.fillMode === 'solid');
        }
      }
      break;
    case 'square':
      if (start && end) {
        const bx = Math.min(start.x, end.x), by = Math.min(start.y, end.y);
        const bw = Math.abs(end.x - start.x), bh = Math.abs(end.y - start.y);
        if (isBlur || isRedact) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(bx, by, bw, bh);
          ctx.clip();
          if (isRedact) redactTextLines(ctx, bx, by, bw, bh, ann.color);
          else pixelateClipped(ctx, bx, by, bw, bh, 10, dprOverride);
          ctx.restore();
        } else {
          drawSquare(ctx, start, end, ann.color, ann.strokeWidth, ann.fillMode === 'solid');
        }
      }
      break;
    case 'text':
      if (start && ann.text) drawText(ctx, start, ann.text, ann.color, ann.textSize ?? 16, ann.textBold, ann.textItalic, ann.textUnderline, ann.textHighlight, ann.textWidth);
      break;
    case 'calligraphy':
      drawCalligraphy(ctx, ann.points, ann.color, ann.strokeWidth);
      break;
    case 'diamond':
      if (start && end) {
        const bx = Math.min(start.x, end.x), by = Math.min(start.y, end.y);
        const bw = Math.abs(end.x - start.x), bh = Math.abs(end.y - start.y);
        if (isBlur || isRedact) {
          ctx.save();
          ctx.beginPath();
          const dcx = bx + bw / 2, dcy = by + bh / 2;
          ctx.moveTo(dcx, by);
          ctx.lineTo(bx + bw, dcy);
          ctx.lineTo(dcx, by + bh);
          ctx.lineTo(bx, dcy);
          ctx.closePath();
          ctx.clip();
          if (isRedact) redactTextLines(ctx, bx, by, bw, bh, ann.color);
          else pixelateClipped(ctx, bx, by, bw, bh, 10, dprOverride);
          ctx.restore();
        } else {
          drawDiamond(ctx, start, end, ann.color, ann.strokeWidth, ann.fillMode === 'solid');
        }
      }
      break;
    case 'star':
      if (start && end) {
        const bx = Math.min(start.x, end.x), by = Math.min(start.y, end.y);
        const bw = Math.abs(end.x - start.x), bh = Math.abs(end.y - start.y);
        if (isBlur || isRedact) {
          const scx = bx + bw / 2, scy = by + bh / 2;
          const srx = bw / 2, sry = bh / 2;
          const sirx = srx * 0.38, siry = sry * 0.38;
          ctx.save();
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const outerAngle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            const ox = scx + srx * Math.cos(outerAngle), oy = scy + sry * Math.sin(outerAngle);
            if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
            const innerAngle = outerAngle + Math.PI / 5;
            ctx.lineTo(scx + sirx * Math.cos(innerAngle), scy + siry * Math.sin(innerAngle));
          }
          ctx.closePath();
          ctx.clip();
          if (isRedact) redactTextLines(ctx, bx, by, bw, bh, ann.color);
          else pixelateClipped(ctx, bx, by, bw, bh, 10, dprOverride);
          ctx.restore();
        } else {
          drawStar(ctx, start, end, ann.color, ann.strokeWidth, ann.fillMode === 'solid');
        }
      }
      break;
    case 'pentagon':
      if (start && end) {
        const bx = Math.min(start.x, end.x), by = Math.min(start.y, end.y);
        const bw = Math.abs(end.x - start.x), bh = Math.abs(end.y - start.y);
        if (isBlur || isRedact) {
          const pcx = bx + bw / 2, pcy = by + bh / 2;
          const prx = bw / 2, pry = bh / 2;
          ctx.save();
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            const px = pcx + prx * Math.cos(angle), py = pcy + pry * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.clip();
          if (isRedact) redactTextLines(ctx, bx, by, bw, bh, ann.color);
          else pixelateClipped(ctx, bx, by, bw, bh, 10, dprOverride);
          ctx.restore();
        } else {
          drawPentagon(ctx, start, end, ann.color, ann.strokeWidth, ann.fillMode === 'solid');
        }
      }
      break;
    case 'heart':
      if (start && end) {
        const bx = Math.min(start.x, end.x), by = Math.min(start.y, end.y);
        const bw = Math.abs(end.x - start.x), bh = Math.abs(end.y - start.y);
        if (isBlur || isRedact) {
          const hcx = bx + bw / 2;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(hcx, by + bh * 0.25);
          ctx.bezierCurveTo(hcx - bw * 0.02, by, bx, by, bx, by + bh * 0.35);
          ctx.bezierCurveTo(bx, by + bh * 0.65, hcx, by + bh * 0.7, hcx, by + bh);
          ctx.bezierCurveTo(hcx, by + bh * 0.7, bx + bw, by + bh * 0.65, bx + bw, by + bh * 0.35);
          ctx.bezierCurveTo(bx + bw, by, hcx + bw * 0.02, by, hcx, by + bh * 0.25);
          ctx.closePath();
          ctx.clip();
          if (isRedact) redactTextLines(ctx, bx, by, bw, bh, ann.color);
          else pixelateClipped(ctx, bx, by, bw, bh, 10, dprOverride);
          ctx.restore();
        } else {
          drawHeart(ctx, start, end, ann.color, ann.strokeWidth, ann.fillMode === 'solid');
        }
      }
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
  private activeTool: import('../../shared/types').ToolType | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
  }

  async setScreens(screens: ScreenData[]): Promise<void> {
    for (const bmp of this.bitmaps.values()) bmp.close();
    this.bitmaps.clear();
    this.screens = screens;
    if (screens.length === 0) return;
    // Each overlay window now covers exactly one screen, so offset to its origin
    this.offsetX = screens[0]?.bounds.x ?? 0;
    this.offsetY = screens[0]?.bounds.y ?? 0;
    await Promise.all(screens.map(async (s) => {
      // Decode base64 data URL directly, avoids fetch() which CSP can block
      const base64 = s.imageDataURL.replace(/^data:image\/\w+;base64,/, '');
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/png' });
      this.bitmaps.set(s.displayId, await createImageBitmap(blob, {
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none',
      }));
    }));
    this.dirty = true;
  }

  setSelection(selection: Selection | null): void { this.selection = selection; this.dirty = true; }

  setActiveTool(tool: import('../../shared/types').ToolType | null): void { this.activeTool = tool; this.dirty = true; }

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
  renderCleanExport(sel: { x: number; y: number; width: number; height: number }, annotations: Annotation[], preview: Annotation | null, forceScale?: number): HTMLCanvasElement | null {
    // Use the highest scale factor for export: either from native capture
    // resolution or from the device pixel ratio, whichever is larger
    const captureScale = this.screens.length > 0
      ? Math.max(...this.screens.map(s => s.nativeWidth / s.bounds.width || 1))
      : 1;
    const maxScale = forceScale ?? Math.max(captureScale, window.devicePixelRatio || 1);
    const w = Math.round(sel.width * maxScale);
    const h = Math.round(sel.height * maxScale);
    if (w <= 0 || h <= 0) return null;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = w;
    exportCanvas.height = h;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(maxScale, maxScale);
    // Disable smoothing for pixel-perfect screenshot export
    ctx.imageSmoothingEnabled = false;

    // Draw each screen bitmap at native resolution by sampling the exact
    // source pixels that correspond to the selection region.
    for (const s of this.screens) {
      const bmp = this.bitmaps.get(s.displayId);
      if (!bmp) continue;

      // Each overlay covers exactly one screen, filling the entire canvas.
      // The screen's logical size is window.innerWidth x window.innerHeight.
      const screenLogicalX = 0;
      const screenLogicalY = 0;
      const screenLogicalW = window.innerWidth;
      const screenLogicalH = window.innerHeight;

      // Intersection of selection with this screen in logical coords
      const ix0 = Math.max(sel.x, screenLogicalX);
      const iy0 = Math.max(sel.y, screenLogicalY);
      const ix1 = Math.min(sel.x + sel.width, screenLogicalX + screenLogicalW);
      const iy1 = Math.min(sel.y + sel.height, screenLogicalY + screenLogicalH);
      if (ix1 <= ix0 || iy1 <= iy0) continue;

      // Map intersection back to source bitmap pixel coordinates
      const bmpScaleX = bmp.width / screenLogicalW;
      const bmpScaleY = bmp.height / screenLogicalH;
      const srcX = (ix0 - screenLogicalX) * bmpScaleX;
      const srcY = (iy0 - screenLogicalY) * bmpScaleY;
      const srcW = (ix1 - ix0) * bmpScaleX;
      const srcH = (iy1 - iy0) * bmpScaleY;

      // Destination in the export canvas (logical coords, ctx is already scaled)
      const dstX = ix0 - sel.x;
      const dstY = iy0 - sel.y;
      const dstW = ix1 - ix0;
      const dstH = iy1 - iy0;

      ctx.drawImage(bmp, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH);
    }

    // Draw annotations offset
    if (annotations.length > 0 || preview) {
      ctx.save();
      ctx.translate(-sel.x, -sel.y);
      ctx.beginPath();
      ctx.rect(sel.x, sel.y, sel.width, sel.height);
      ctx.clip();
      for (const ann of annotations) renderAnnotation(ctx, ann, maxScale);
      if (preview) renderAnnotation(ctx, preview, maxScale);
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
    ctx.imageSmoothingEnabled = false;
    // Use logical (CSS) dimensions since context is scaled by devicePixelRatio
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    // Layer 0: frozen screen bitmaps — fill the entire canvas
    for (const s of this.screens) {
      const bmp = this.bitmaps.get(s.displayId);
      if (bmp) {
        ctx.drawImage(bmp, 0, 0, w, h);
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
          ctx.drawImage(bmp, 0, 0, w, h);
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
      // Layer 3.5: resize dots on shape endpoints when hand tool is active
      if (this.activeTool === 'hand') {
        for (const ann of this.annotations) {
          if (ann.tool === 'pencil' || ann.tool === 'sharpie' || ann.tool === 'calligraphy' || ann.tool === 'text') continue;
          if (ann.points.length < 2) continue;
          const [s, e] = ann.points;
          for (const pt of [s, e]) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'black';
            ctx.stroke();
          }
        }
      }
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
    const padding = 4, fontSize = 12, gap = 4;
    ctx.save();
    ctx.font = `${fontSize}px sans-serif`;
    const boxWidth = ctx.measureText(label).width + padding * 2;
    const boxHeight = fontSize + padding * 2;
    // Default: outside, just above the top-left corner
    let bx = sel.x;
    let by = sel.y - boxHeight - gap;
    // If it goes above the screen, put it inside the selection
    if (by < 0) {
      bx = sel.x + gap;
      by = sel.y + gap;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(bx, by, boxWidth, boxHeight);
    ctx.fillStyle = 'white';
    ctx.textBaseline = 'top';
    ctx.fillText(label, bx + padding, by + padding);
    ctx.restore();
  }
}
