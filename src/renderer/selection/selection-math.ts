import { MIN_SELECTION_SIZE, RESIZE_HANDLE_SIZE } from '../../shared/constants';
import type { Point, Selection, Rectangle, HandlePosition, ResizeHandle } from '../../shared/types';

/** Normalizes two points into a Selection with positive width/height. */
export function normalizeRect(p1: Point, p2: Point): Selection {
  return {
    x: Math.min(p1.x, p2.x),
    y: Math.min(p1.y, p2.y),
    width: Math.abs(p2.x - p1.x),
    height: Math.abs(p2.y - p1.y),
  };
}

/** Clamps selection so it stays fully within bounds. */
export function constrainToBounds(sel: Selection, bounds: Rectangle): Selection {
  const width = Math.min(sel.width, bounds.width);
  const height = Math.min(sel.height, bounds.height);
  const x = Math.max(bounds.x, Math.min(sel.x, bounds.x + bounds.width - width));
  const y = Math.max(bounds.y, Math.min(sel.y, bounds.y + bounds.height - height));
  return { x, y, width, height };
}

/** Returns true if selection meets minimum size on both axes. */
export function isMinimumSize(sel: Selection, minSize: number = MIN_SELECTION_SIZE): boolean {
  return sel.width >= minSize && sel.height >= minSize;
}

/** Returns 8 resize handles at corners and edge midpoints. */
export function getResizeHandles(sel: Selection): ResizeHandle[] {
  const { x, y, width, height } = sel;
  const cx = x + width / 2, cy = y + height / 2;
  const r = x + width, b = y + height;
  return [
    { position: 'nw', center: { x, y },         cursor: 'nw-resize' },
    { position: 'n',  center: { x: cx, y },      cursor: 'n-resize'  },
    { position: 'ne', center: { x: r, y },        cursor: 'ne-resize' },
    { position: 'e',  center: { x: r, y: cy },    cursor: 'e-resize'  },
    { position: 'se', center: { x: r, y: b },     cursor: 'se-resize' },
    { position: 's',  center: { x: cx, y: b },    cursor: 's-resize'  },
    { position: 'sw', center: { x, y: b },        cursor: 'sw-resize' },
    { position: 'w',  center: { x, y: cy },       cursor: 'w-resize'  },
  ];
}

/** Returns the handle within tolerance of point, or null. */
export function hitTestHandle(point: Point, handles: ResizeHandle[], tolerance: number = RESIZE_HANDLE_SIZE): ResizeHandle | null {
  for (const h of handles) {
    if (Math.abs(point.x - h.center.x) <= tolerance && Math.abs(point.y - h.center.y) <= tolerance) return h;
  }
  return null;
}

/** Returns true if point is inside selection. */
export function hitTestSelection(point: Point, sel: Selection): boolean {
  return point.x >= sel.x && point.x <= sel.x + sel.width && point.y >= sel.y && point.y <= sel.y + sel.height;
}

/** Resizes selection from handle by delta, anchoring opposite corner/edge. */
export function resizeFromHandle(sel: Selection, handle: HandlePosition, delta: Point, bounds: Rectangle): Selection {
  let { x, y, width, height } = sel;
  switch (handle) {
    case 'nw': x += delta.x; y += delta.y; width -= delta.x; height -= delta.y; break;
    case 'n':  y += delta.y; height -= delta.y; break;
    case 'ne': y += delta.y; width += delta.x; height -= delta.y; break;
    case 'e':  width += delta.x; break;
    case 'se': width += delta.x; height += delta.y; break;
    case 's':  height += delta.y; break;
    case 'sw': x += delta.x; width -= delta.x; height += delta.y; break;
    case 'w':  x += delta.x; width -= delta.x; break;
  }
  return constrainToBounds(normalizeRect({ x, y }, { x: x + width, y: y + height }), bounds);
}

/** Moves selection by delta, constrained to bounds. */
export function moveSelection(sel: Selection, delta: Point, bounds: Rectangle): Selection {
  return constrainToBounds({ x: sel.x + delta.x, y: sel.y + delta.y, width: sel.width, height: sel.height }, bounds);
}
