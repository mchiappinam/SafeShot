import type { Point } from '../../shared/types';

/**
 * Draw a freehand stroke through the given points.
 * Used for both pencil (strokeWidth=2) and sharpie (strokeWidth=8).
 * Requirements: 6.10, 6.11, 6.12
 */
export function drawFreehand(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  strokeWidth: number,
  opacity: number = 1.0
): void {
  if (points.length === 0) return;

  ctx.save();
  ctx.globalAlpha = opacity;

  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();

  if (points.length === 1) {
    // Single point, draw a dot
    ctx.arc(points[0].x, points[0].y, strokeWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw a calligraphy stroke with variable width based on speed.
 * Shorter distance between points = thicker stroke, longer distance = thinner stroke.
 */
export function drawCalligraphy(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  baseStrokeWidth: number
): void {
  if (points.length === 0) return;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, baseStrokeWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
      // Shorter distance = thicker (slow movement), longer distance = thinner (fast movement)
      // Clamp between 0.5x and 2.5x the base width
      const widthFactor = Math.max(0.5, Math.min(2.5, 1.0 + (10 - dist) / 10));
      ctx.lineWidth = baseStrokeWidth * widthFactor;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(curr.x, curr.y);
      ctx.stroke();
    }
  }

  ctx.restore();
}
