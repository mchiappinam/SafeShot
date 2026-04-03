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
  strokeWidth: number
): void {
  ctx.save();

  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.stroke();

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
  strokeWidth: number
): void {
  ctx.save();

  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);       // apex top-center
  ctx.lineTo(x + w, y + h);       // bottom-right
  ctx.lineTo(x, y + h);           // bottom-left
  ctx.closePath();
  ctx.stroke();

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
  strokeWidth: number
): void {
  ctx.save();

  // Use the smaller dimension to make a regular octagon
  const cx = (start.x + end.x) / 2;
  const cy = (start.y + end.y) / 2;
  const r = Math.min(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) / 2;

  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    // Start rotated so the top edge is flat (like a stop sign)
    const angle = (Math.PI * 2 * i) / 8 - Math.PI / 8;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();

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
  strokeWidth: number
): void {
  ctx.save();

  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.stroke();

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
  fontSize: number
): void {
  if (!text) return;
  ctx.save();

  ctx.font = `${fontSize}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], position.x, position.y + i * (fontSize + 2));
  }

  ctx.restore();
}

/**
 * Fill a rectangular area with a solid color.
 */
export function drawFill(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  color: string
): void {
  ctx.save();

  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);

  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);

  ctx.restore();
}
