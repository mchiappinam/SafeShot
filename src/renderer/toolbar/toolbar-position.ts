import type { Selection, Rectangle, ToolbarPosition, ToolbarPositions } from '../../shared/types';
import {
  DRAWING_TOOLBAR_WIDTH, DRAWING_TOOLBAR_HEIGHT,
  ACTION_TOOLBAR_WIDTH, ACTION_TOOLBAR_HEIGHT, TOOLBAR_GAP,
} from '../../shared/constants';

export function computeToolbarPositions(
  selection: Selection,
  screenBounds: Rectangle,
): ToolbarPositions {
  const drawing = computeDrawingToolbarPosition(selection, screenBounds);
  const action = computeActionToolbarPosition(selection, screenBounds, drawing);
  return { drawing, action };
}

export function computeDrawingToolbarPosition(sel: Selection, bounds: Rectangle): ToolbarPosition {
  const rightX = sel.x + sel.width + TOOLBAR_GAP;
  const leftX = sel.x - DRAWING_TOOLBAR_WIDTH - TOOLBAR_GAP;
  const fitsRight = rightX + DRAWING_TOOLBAR_WIDTH <= bounds.x + bounds.width;
  const fitsLeft = leftX >= bounds.x;
  let side: 'left' | 'right';
  let x: number;
  if (fitsRight) { side = 'right'; x = rightX; }
  else if (fitsLeft) { side = 'left'; x = leftX; }
  else { side = 'right'; x = sel.x + sel.width - DRAWING_TOOLBAR_WIDTH - TOOLBAR_GAP; } // inside selection
  const y = Math.max(bounds.y, Math.min(sel.y, bounds.y + bounds.height - DRAWING_TOOLBAR_HEIGHT));
  return { x, y, side, edge: 'bottom' };
}

export function computeActionToolbarPosition(
  sel: Selection, bounds: Rectangle, drawing: ToolbarPosition,
): ToolbarPosition {
  const belowY = sel.y + sel.height + TOOLBAR_GAP;
  const aboveY = sel.y - ACTION_TOOLBAR_HEIGHT - TOOLBAR_GAP;
  const fitsBelow = belowY + ACTION_TOOLBAR_HEIGHT <= bounds.y + bounds.height;
  const fitsAbove = aboveY >= bounds.y;
  let edge: 'top' | 'bottom';
  let y: number;
  if (fitsBelow) { edge = 'bottom'; y = belowY; }
  else if (fitsAbove) { edge = 'top'; y = aboveY; }
  else { edge = 'bottom'; y = sel.y + sel.height - ACTION_TOOLBAR_HEIGHT - TOOLBAR_GAP; } // inside selection
  const x = Math.max(bounds.x, Math.min(sel.x, bounds.x + bounds.width - ACTION_TOOLBAR_WIDTH));

  const drawingRight = drawing.x + DRAWING_TOOLBAR_WIDTH;
  const actionRight = x + ACTION_TOOLBAR_WIDTH;
  const drawingBottom = drawing.y + DRAWING_TOOLBAR_HEIGHT;
  const actionBottom = y + ACTION_TOOLBAR_HEIGHT;
  const overlapsX = x < drawingRight && actionRight > drawing.x;
  const overlapsY = y < drawingBottom && actionBottom > drawing.y;

  if (overlapsX && overlapsY) {
    // Slide action toolbar to the left of the drawing toolbar
    const leftX = drawing.x - ACTION_TOOLBAR_WIDTH - TOOLBAR_GAP;
    if (leftX >= bounds.x) {
      return { x: leftX, y, side: 'left', edge };
    }
    // If no room to the left, try right of drawing toolbar
    const rightX = drawing.x + DRAWING_TOOLBAR_WIDTH + TOOLBAR_GAP;
    if (rightX + ACTION_TOOLBAR_WIDTH <= bounds.x + bounds.width) {
      return { x: rightX, y, side: 'left', edge };
    }
    // Last resort: push below drawing toolbar
    y = drawing.y + DRAWING_TOOLBAR_HEIGHT + TOOLBAR_GAP;
  }

  return { x, y, side: 'left', edge };
}
