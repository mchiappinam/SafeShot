import type { Point } from '../../shared/types';

/**
 * Draw an ellipse bounded by the drag rectangle defined by start and end points.
 * Requirements: 6.7, 6.16
 */
export function drawCircle(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  strokeWidth: number,
  solid: boolean = false
): void {
  ctx.save();

  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  if (solid) { ctx.fillStyle = color; ctx.fill(); }
  else { ctx.strokeStyle = color; ctx.stroke(); }

  ctx.restore();
}

/**
 * Draw a triangle bounded by the drag rectangle.
 * Apex at top-center, base at bottom-left and bottom-right.
 * Requirements: 6.8, 6.17
 */
export function drawTriangle(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  strokeWidth: number,
  solid: boolean = false
): void {
  ctx.save();

  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  if (solid) { ctx.fillStyle = color; ctx.fill(); }
  else { ctx.strokeStyle = color; ctx.stroke(); }

  ctx.restore();
}

/**
 * Draw a regular octagon bounded by the drag rectangle.
 * Requirements: 6.9, 6.18
 */
export function drawOctagon(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  strokeWidth: number,
  solid: boolean = false
): void {
  ctx.save();

  // Use bounding box like other shapes, with radius from the smaller dimension
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.max(w, h) / 2;

  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8 - Math.PI / 8;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (solid) { ctx.fillStyle = color; ctx.fill(); }
  else { ctx.strokeStyle = color; ctx.stroke(); }

  ctx.restore();
}

/**
 * Draw a straight line from start to end with an arrowhead at the end.
 */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  strokeWidth: number
): void {
  ctx.save();

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw the line
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  // Draw arrowhead
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLen = Math.max(10, strokeWidth * 5);
  const headAngle = Math.PI / 6;

  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - headLen * Math.cos(angle - headAngle), end.y - headLen * Math.sin(angle - headAngle));
  ctx.lineTo(end.x - headLen * Math.cos(angle + headAngle), end.y - headLen * Math.sin(angle + headAngle));
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/**
 * Draw a straight line from start to end.
 * Requirements: 6.5, 6.6
 */
export function drawLine(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  strokeWidth: number
): void {
  ctx.save();

  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  ctx.restore();
}

/**
 * Draw a rectangle (square) bounded by the drag rectangle.
 */
export function drawSquare(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string,
  strokeWidth: number,
  solid: boolean = false
): void {
  ctx.save();

  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (solid) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  else { ctx.strokeStyle = color; ctx.beginPath(); ctx.rect(x, y, w, h); ctx.stroke(); }

  ctx.restore();
}

/**
 * Draw text at the given position with transparent background.
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  position: Point,
  text: string,
  color: string,
  fontSize: number,
  bold?: boolean,
  italic?: boolean,
  underline?: boolean,
  highlight?: boolean
): void {
  if (!text) return;
  ctx.save();

  const style = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px sans-serif`;
  ctx.font = style;
  ctx.textBaseline = 'top';

  const lines = text.split('\n');
  const lineHeight = fontSize + 4;

  for (let i = 0; i < lines.length; i++) {
    const lx = position.x;
    const ly = position.y + i * lineHeight;

    // Highlight background (Instagram-style)
    if (highlight) {
      const metrics = ctx.measureText(lines[i]);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(lx - 2, ly - 1, metrics.width + 4, lineHeight);
      ctx.globalAlpha = 1;
    }

    // Text
    ctx.fillStyle = color;
    ctx.fillText(lines[i], lx, ly);

    // Underline
    if (underline) {
      const metrics = ctx.measureText(lines[i]);
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, fontSize / 12);
      ctx.beginPath();
      ctx.moveTo(lx, ly + fontSize + 1);
      ctx.lineTo(lx + metrics.width, ly + fontSize + 1);
      ctx.stroke();
    }
  }

  ctx.restore();
}

