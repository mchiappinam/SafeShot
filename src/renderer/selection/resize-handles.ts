import type { Point, Selection, ResizeHandle } from '../../shared/types';
import { getResizeHandles, hitTestHandle } from './selection-math';

/** Returns the 8 resize handles for the given selection. */
export function getHandles(sel: Selection): ResizeHandle[] {
  return getResizeHandles(sel);
}

/** Tests whether a point hits any resize handle. Returns the handle or null. */
export function hitTest(point: Point, sel: Selection): ResizeHandle | null {
  return hitTestHandle(point, getResizeHandles(sel));
}
