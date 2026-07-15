import type { Selection, Rectangle, ToolbarPosition, ToolbarPositions } from '../../shared/types';
import {
  DRAWING_TOOLBAR_WIDTH, DRAWING_TOOLBAR_HEIGHT,
  ACTION_TOOLBAR_WIDTH, ACTION_TOOLBAR_HEIGHT,
  TEXT_FORMAT_BAR_WIDTH, TEXT_FORMAT_BAR_HEIGHT, TOOLBAR_GAP,
} from '../../shared/constants';

export function computeToolbarPositions(
  selection: Selection,
  screenBounds: Rectangle,
): ToolbarPositions {
  const drawing = computeDrawingToolbarPosition(selection, screenBounds);
  const action = computeActionToolbarPosition(selection, screenBounds, drawing);
  const text = computeTextFormatBarPosition(selection, screenBounds, action);
  return { drawing, action, text };
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

/**
 * Position the text format bar outside the selection box, preferring the
 * opposite edge from the action toolbar so the two don't compete for the
 * same space. Explicitly checks for overlap against the action toolbar's
 * actual rectangle (not just whether it "fits" on screen), since both bars
 * can independently land on the same side of the selection. Falls back to
 * appending next to the action toolbar when neither side of the selection
 * works without overlapping it or running off screen.
 */
export function computeTextFormatBarPosition(
  sel: Selection, bounds: Rectangle, action: ToolbarPosition,
): ToolbarPosition {
  const x = Math.max(bounds.x, Math.min(sel.x, bounds.x + bounds.width - TEXT_FORMAT_BAR_WIDTH));

  const actionRight = action.x + ACTION_TOOLBAR_WIDTH;
  const actionBottom = action.y + ACTION_TOOLBAR_HEIGHT;
  const overlapsAction = (y: number): boolean => {
    const right = x + TEXT_FORMAT_BAR_WIDTH;
    const bottom = y + TEXT_FORMAT_BAR_HEIGHT;
    return x < actionRight && right > action.x && y < actionBottom && bottom > action.y;
  };

  const aboveY = sel.y - TEXT_FORMAT_BAR_HEIGHT - TOOLBAR_GAP;
  const belowY = sel.y + sel.height + TOOLBAR_GAP;
  const fitsAbove = aboveY >= bounds.y && !overlapsAction(aboveY);
  const fitsBelow = belowY + TEXT_FORMAT_BAR_HEIGHT <= bounds.y + bounds.height && !overlapsAction(belowY);

  // Prefer whichever side of the selection is opposite the action toolbar,
  // since that's the side least likely to already be occupied.
  const preferTop = action.edge !== 'top';
  if (preferTop && fitsAbove) return { x, y: aboveY, side: 'left', edge: 'top' };
  if (!preferTop && fitsBelow) return { x, y: belowY, side: 'left', edge: 'bottom' };
  if (fitsAbove) return { x, y: aboveY, side: 'left', edge: 'top' };
  if (fitsBelow) return { x, y: belowY, side: 'left', edge: 'bottom' };

  // Neither side of the selection works (off screen or overlapping the
  // action toolbar): append next to the action toolbar instead, on
  // whichever of its edges actually leaves room on screen.
  const aboveActionY = action.y - TEXT_FORMAT_BAR_HEIGHT - TOOLBAR_GAP;
  const belowActionY = actionBottom + TOOLBAR_GAP;
  if (aboveActionY >= bounds.y) return { x, y: aboveActionY, side: 'left', edge: 'top' };
  if (belowActionY + TEXT_FORMAT_BAR_HEIGHT <= bounds.y + bounds.height) {
    return { x, y: belowActionY, side: 'left', edge: 'bottom' };
  }

  // Last resort: clamp inside bounds. This only happens when the screen is
  // too small to fit both bars anywhere without touching the selection or
  // each other, an extreme edge case.
  const y = Math.max(bounds.y, Math.min(belowActionY, bounds.y + bounds.height - TEXT_FORMAT_BAR_HEIGHT));
  return { x, y, side: 'left', edge: 'bottom' };
}
