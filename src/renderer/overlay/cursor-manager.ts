import type { CaptureState, HandlePosition, Selection, ToolType } from '../../shared/types';

export interface CursorManagerState {
  captureState: CaptureState;
  selection: Selection | null;
  activeTool: ToolType | null;
  mouseX: number;
  mouseY: number;
  hoveredHandle: HandlePosition | null;
  isOverToolbar: boolean;
}

const HANDLE_CURSOR_MAP: Record<HandlePosition, string> = {
  nw: 'nw-resize',
  n:  'n-resize',
  ne: 'ne-resize',
  e:  'e-resize',
  se: 'se-resize',
  s:  's-resize',
  sw: 'sw-resize',
  w:  'w-resize',
};

function isPointInSelection(x: number, y: number, sel: Selection): boolean {
  return x >= sel.x && x <= sel.x + sel.width && y >= sel.y && y <= sel.y + sel.height;
}

export class CursorManager {
  private container: HTMLElement;
  private tooltip: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.container = container;

    this.tooltip = document.createElement('div');
    Object.assign(this.tooltip.style, {
      position: 'fixed',
      background: 'rgba(0,0,0,0.75)',
      color: '#fff',
      fontSize: '12px',
      padding: '4px 8px',
      borderRadius: '4px',
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
      display: 'none',
      zIndex: '9999',
    });
    this.tooltip.textContent = 'Select area';
    document.body.appendChild(this.tooltip);
  }

  update(state: CursorManagerState): void {
    const { captureState, selection, activeTool, mouseX, mouseY, hoveredHandle, isOverToolbar } = state;

    // Determine cursor style
    let cursor: string;

    if (isOverToolbar) {
      cursor = 'default';
    } else if (hoveredHandle !== null) {
      cursor = HANDLE_CURSOR_MAP[hoveredHandle];
    } else if (captureState === 'selecting' || captureState === 'annotating') {
      cursor = 'crosshair';
    } else if (selection !== null && activeTool !== null) {
      cursor = 'crosshair';
    } else if (selection !== null && activeTool === null && isPointInSelection(mouseX, mouseY, selection)) {
      cursor = 'move';
    } else {
      cursor = 'crosshair';
    }

    this.container.style.cursor = cursor;

    // Show tooltip only when no selection exists and not over toolbar
    const showTooltip = selection === null && !isOverToolbar;
    if (showTooltip) {
      this.tooltip.style.display = 'block';
      this.tooltip.style.left = `${mouseX + 16}px`;
      this.tooltip.style.top = `${mouseY + 16}px`;
    } else {
      this.tooltip.style.display = 'none';
    }
  }

  destroy(): void {
    if (this.tooltip.parentNode) {
      this.tooltip.parentNode.removeChild(this.tooltip);
    }
  }
}
