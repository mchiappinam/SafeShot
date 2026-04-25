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

const CUSTOM_CROSSHAIR = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19">
    <line x1="9.5" y1="0" x2="9.5" y2="7" stroke="white" stroke-width="2"/>
    <line x1="9.5" y1="12" x2="9.5" y2="19" stroke="white" stroke-width="2"/>
    <line x1="0" y1="9.5" x2="7" y2="9.5" stroke="white" stroke-width="2"/>
    <line x1="12" y1="9.5" x2="19" y2="9.5" stroke="white" stroke-width="2"/>
    <line x1="9.5" y1="0" x2="9.5" y2="7" stroke="black" stroke-width="1"/>
    <line x1="9.5" y1="12" x2="9.5" y2="19" stroke="black" stroke-width="1"/>
    <line x1="0" y1="9.5" x2="7" y2="9.5" stroke="black" stroke-width="1"/>
    <line x1="12" y1="9.5" x2="19" y2="9.5" stroke="black" stroke-width="1"/>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 9 9, crosshair`;
})();

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
      cursor = activeTool === 'hand' ? 'grabbing' : CUSTOM_CROSSHAIR;
    } else if (selection !== null && activeTool === 'hand') {
      cursor = 'grab';
    } else if (selection !== null && activeTool === 'eyedropper') {
      cursor = CUSTOM_CROSSHAIR;
    } else if (selection !== null && activeTool !== null) {
      cursor = CUSTOM_CROSSHAIR;
    } else if (selection !== null && activeTool === null && isPointInSelection(mouseX, mouseY, selection)) {
      cursor = 'move';
    } else {
      cursor = CUSTOM_CROSSHAIR;
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
