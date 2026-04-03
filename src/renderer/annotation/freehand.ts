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
  strokeWidth: number
): void {
  if (points.length === 0) return;

  ctx.save();

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
