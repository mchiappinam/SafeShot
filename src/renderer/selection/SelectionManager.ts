import type { Point, Selection, Rectangle, HandlePosition } from '../../shared/types';
import { normalizeRect, constrainToBounds, isMinimumSize, resizeFromHandle, moveSelection } from './selection-math';

export class SelectionManager {
  private bounds: Rectangle;
  private selection: Selection | null = null;
  private selectionOrigin: Point | null = null;
  private selectionPreview: Selection | null = null;
  private resizeHandle: HandlePosition | null = null;
  private resizeLastPoint: Point | null = null;
  private moveLastPoint: Point | null = null;

  constructor(bounds: Rectangle) { this.bounds = bounds; }

  startSelection(origin: Point): void {
    this.selectionOrigin = origin;
    this.selectionPreview = normalizeRect(origin, origin);
  }

  updateSelection(current: Point): void {
    if (!this.selectionOrigin) return;
    this.selectionPreview = constrainToBounds(normalizeRect(this.selectionOrigin, current), this.bounds);
  }

  finalizeSelection(): Selection | null {
    const preview = this.selectionPreview;
    this.selectionOrigin = null;
    this.selectionPreview = null;
    if (!preview || !isMinimumSize(preview)) { this.selection = null; return null; }
    this.selection = preview;
    return this.selection;
  }

  startResize(handle: HandlePosition): void {
    if (!this.selection) return;
    this.resizeHandle = handle;
    this.resizeLastPoint = null;
  }

  updateResize(current: Point): void {
    if (!this.selection || !this.resizeHandle) return;
    const last = this.resizeLastPoint ?? current;
    const delta: Point = { x: current.x - last.x, y: current.y - last.y };
    this.resizeLastPoint = current;
    this.selection = resizeFromHandle(this.selection, this.resizeHandle, delta, this.bounds);
  }

  finalizeResize(): void { this.resizeHandle = null; this.resizeLastPoint = null; }

  startMove(origin: Point): void { if (!this.selection) return; this.moveLastPoint = origin; }

  updateMove(current: Point): void {
    if (!this.selection || !this.moveLastPoint) return;
    const delta: Point = { x: current.x - this.moveLastPoint.x, y: current.y - this.moveLastPoint.y };
    this.moveLastPoint = current;
    this.selection = moveSelection(this.selection, delta, this.bounds);
  }

  finalizeMove(): void { this.moveLastPoint = null; }

  discardSelection(): void {
    this.selection = null; this.selectionOrigin = null; this.selectionPreview = null;
    this.resizeHandle = null; this.resizeLastPoint = null; this.moveLastPoint = null;
  }

  getSelection(): Selection | null { return this.selection; }
  getPreviewSelection(): Selection | null { return this.selectionPreview; }

  setBounds(bounds: Rectangle): void {
    this.bounds = bounds;
    if (this.selection) this.selection = constrainToBounds(this.selection, bounds);
  }
}
