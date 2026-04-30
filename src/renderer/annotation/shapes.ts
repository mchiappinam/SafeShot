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

  // Use bounding box like other shapes
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const w = Math.abs(end.x - start.x);
  const h = Math.abs(end.y - start.y);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;

  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8 - Math.PI / 8;
    const px = cx + rx * Math.cos(angle);
    const py = cy + ry * Math.sin(angle);
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

  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLen = Math.max(14, strokeWidth * 6);
  const headAngle = Math.PI / 8;

  // Shorten the line so it ends at the base of the arrowhead
  const lineEndX = end.x - headLen * Math.cos(angle);
  const lineEndY = end.y - headLen * Math.sin(angle);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw the line (stops at arrowhead base)
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(lineEndX, lineEndY);
  ctx.stroke();

  // Draw pointy arrowhead
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - headLen * Math.cos(angle - headAngle), end.y - headLen * Math.sin(angle - headAngle));
  ctx.lineTo(end.x - headLen * 0.6 * Math.cos(angle), end.y - headLen * 0.6 * Math.sin(angle));
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
 * Draw a diamond (rotated square) bounded by the drag rectangle.
 */
export function drawDiamond(
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
  const cx = x + w / 2;
  const cy = y + h / 2;

  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(cx, y);        // top
  ctx.lineTo(x + w, cy);    // right
  ctx.lineTo(cx, y + h);    // bottom
  ctx.lineTo(x, cy);        // left
  ctx.closePath();
  if (solid) { ctx.fillStyle = color; ctx.fill(); }
  else { ctx.strokeStyle = color; ctx.stroke(); }

  ctx.restore();
}

/**
 * Draw a 5-pointed star inscribed in the bounding box.
 */
export function drawStar(
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
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const innerRx = rx * 0.38;
  const innerRy = ry * 0.38;

  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    // Outer point
    const outerAngle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const ox = cx + rx * Math.cos(outerAngle);
    const oy = cy + ry * Math.sin(outerAngle);
    if (i === 0) ctx.moveTo(ox, oy); else ctx.lineTo(ox, oy);
    // Inner point
    const innerAngle = outerAngle + Math.PI / 5;
    const ix = cx + innerRx * Math.cos(innerAngle);
    const iy = cy + innerRy * Math.sin(innerAngle);
    ctx.lineTo(ix, iy);
  }
  ctx.closePath();
  if (solid) { ctx.fillStyle = color; ctx.fill(); }
  else { ctx.strokeStyle = color; ctx.stroke(); }

  ctx.restore();
}

/**
 * Draw a regular pentagon inscribed in the bounding box.
 */
export function drawPentagon(
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
  const cx = x + w / 2;
  const cy = y + h / 2;
  const rx = w / 2;
  const ry = h / 2;

  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const px = cx + rx * Math.cos(angle);
    const py = cy + ry * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (solid) { ctx.fillStyle = color; ctx.fill(); }
  else { ctx.strokeStyle = color; ctx.stroke(); }

  ctx.restore();
}

/**
 * Draw a heart shape using bezier curves inscribed in the bounding box.
 */
export function drawHeart(
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
  const cx = x + w / 2;

  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  // Start at the top center dip
  ctx.moveTo(cx, y + h * 0.25);
  // Left bump: curve up to top-left, then down to bottom point
  ctx.bezierCurveTo(
    cx - w * 0.02, y,       // pull toward center-top
    x, y,                    // top-left corner
    x, y + h * 0.35         // left side midpoint
  );
  ctx.bezierCurveTo(
    x, y + h * 0.65,        // left side lower
    cx, y + h * 0.7,        // pull toward center
    cx, y + h               // bottom point
  );
  // Right bump: curve from bottom back up to top-right, then to center dip
  ctx.bezierCurveTo(
    cx, y + h * 0.7,        // pull toward center
    x + w, y + h * 0.65,    // right side lower
    x + w, y + h * 0.35     // right side midpoint
  );
  ctx.bezierCurveTo(
    x + w, y,                // top-right corner
    cx + w * 0.02, y,       // pull toward center-top
    cx, y + h * 0.25        // back to center dip
  );
  ctx.closePath();
  if (solid) { ctx.fillStyle = color; ctx.fill(); }
  else { ctx.strokeStyle = color; ctx.stroke(); }

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

