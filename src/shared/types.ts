// Application State

export type CaptureState =
  | 'idle'
  | 'capturing'       // Overlay shown, awaiting selection
  | 'selecting'       // User is dragging to create selection
  | 'area-finalized'  // Selection complete, toolbars visible
  | 'annotating'      // User is drawing an annotation
  | 'resizing'        // User is dragging a resize handle
  | 'moving'          // User is dragging the selection area
  | 'saving'          // Save in progress
  | 'copying'         // Copy in progress
  | 'printing';       // Print dialog open

export type CursorStyle =
  | 'crosshair'
  | 'default'
  | 'move'
  | 'nw-resize' | 'n-resize' | 'ne-resize' | 'e-resize'
  | 'se-resize' | 's-resize' | 'sw-resize' | 'w-resize';

// Selection

export interface Selection {
  x: number;          // Top-left X in logical pixels
  y: number;          // Top-left Y in logical pixels
  width: number;      // Width in logical pixels
  height: number;     // Height in logical pixels
}

export interface Point {
  x: number;
  y: number;
}

export type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface ResizeHandle {
  position: HandlePosition;
  center: Point;       // Center of the 8x8 handle square
  cursor: CursorStyle;
}

// Annotations

export type ToolType = 'pencil' | 'line' | 'arrow' | 'sharpie' | 'circle' | 'triangle' | 'octagon';

export interface Annotation {
  id: string;                   // UUID
  tool: ToolType;
  color: string;                // Hex color
  strokeWidth: number;          // 2 for pencil, 8 for sharpie, 2 for shapes/line
  points: Point[];              // Freehand: all sampled points. Shapes/line: [start, end]
}

// Screen Data

export interface ScreenData {
  displayId: string;
  bounds: Rectangle;            // Position in virtual screen space
  scaleFactor: number;          // DPI scale factor
  imageDataURL: string;         // base64 PNG
  nativeWidth: number;
  nativeHeight: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Toolbar

export interface ToolbarPositions {
  drawing: ToolbarPosition;
  action: ToolbarPosition;
}

export interface ToolbarPosition {
  x: number;
  y: number;
  side: 'left' | 'right';
  edge: 'top' | 'bottom';
}
