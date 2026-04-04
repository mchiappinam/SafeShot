// Annotation Defaults

/** Default annotation color (Requirement 6.15) */
export const DEFAULT_COLOR = '#2322F0';

/** Stroke widths per tool (Requirements 6.5, 6.8) */
export const STROKE_WIDTH = {
  pencil: 4,
  sharpie: 8,
  shapes: 2,   // line, circle, triangle, octagon
} as const;

// Selection

/** Minimum selection size in pixels (Requirement 5.11) */
export const MIN_SELECTION_SIZE = 5;

// Rendering

/** Dim mask opacity outside selection area (Requirement 13.2) */
export const DIM_MASK_OPACITY = 0.5;

/** Resize handle size in pixels (Requirement 13.4) */
export const RESIZE_HANDLE_SIZE = 8;

// Toolbar

/** Toolbar fade-in/out duration in milliseconds (Requirements 9.3, 9.8) */
export const TOOLBAR_FADE_DURATION_MS = 150;

/** Toolbar dimensions for positioning calculations (Requirements 9.4-9.7) */
export const DRAWING_TOOLBAR_WIDTH = 80;
export const DRAWING_TOOLBAR_HEIGHT = 228;
export const ACTION_TOOLBAR_WIDTH = 280;
export const ACTION_TOOLBAR_HEIGHT = 40;
export const TOOLBAR_GAP = 8;

// Color Picker

/** Preset color palette, at least 12 colors (Requirement 6.13) */
export const PRESET_COLORS: string[] = [
  '#2322F0', // Blue (default)
  '#FF0000', // Red
  '#FF6600', // Orange
  '#FFFF00', // Yellow
  '#00FF00', // Lime
  '#00FFFF', // Cyan
  '#0000FF', // Blue
  '#8800FF', // Violet
  '#FF00FF', // Magenta
  '#FFFFFF', // White
  '#AAAAAA', // Light grey
  '#555555', // Dark grey
  '#000000', // Black
  '#FF4488', // Pink
];
