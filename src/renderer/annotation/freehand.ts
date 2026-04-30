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
 * Draw a calligraphy stroke with an angled nib effect.
 * Simulates a flat pen held at 45 degrees, creating thick/thin variation
 * based on stroke direction, similar to Paint's calligraphy brush.
 */
export function drawCalligraphy(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  baseStrokeWidth: number
): void {
  if (points.length === 0) return;

  ctx.save();
  ctx.fillStyle = color;

  // Nib angle (45 degrees) and half-width
  const nibAngle = Math.PI / 4;
  const hw = baseStrokeWidth * 0.8;
  const dx = Math.cos(nibAngle) * hw;
  const dy = Math.sin(nibAngle) * hw;

  if (points.length === 1) {
    // Single dot: draw an angled ellipse
    ctx.beginPath();
    ctx.ellipse(points[0].x, points[0].y, hw, hw * 0.3, nibAngle, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Draw filled quadrilaterals between consecutive points
    // Each point expands into two corners based on the nib angle
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];

      ctx.beginPath();
      ctx.moveTo(prev.x - dx, prev.y - dy);
      ctx.lineTo(prev.x + dx, prev.y + dy);
      ctx.lineTo(curr.x + dx, curr.y + dy);
      ctx.lineTo(curr.x - dx, curr.y - dy);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}
