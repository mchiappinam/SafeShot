/**
 * IPC channel name constants for communication between main and renderer processes.
 *
 * Direction notation:
 *   M→R  Main process → Renderer process
 *   R→M  Renderer process → Main process
 */

/** M→R  Deliver captured screen bitmaps to overlay. Payload: { screens: ScreenData[] } */
export const CAPTURE_START = 'capture:start';

/** R→M  User cancelled capture; clean up resources. Payload: {} */
export const CAPTURE_CANCEL = 'capture:cancel';

/** R→M  Request save (quick or save-as). Payload: { imageDataURL: string, shiftHeld: boolean } */
export const SAVE_REQUEST = 'save:request';

/** M→R  Save outcome. Payload: { success: boolean, error?: string, path?: string } */
export const SAVE_RESULT = 'save:result';

/** R→M  Copy selection to clipboard. Payload: { imageDataURL: string } */
export const COPY_REQUEST = 'copy:request';

/** R→M  Send selection to print dialog. Payload: { imageDataURL: string } */
export const PRINT_REQUEST = 'print:request';

/** R→M  Close the overlay window. Payload: {} */
export const OVERLAY_CLOSE = 'overlay:close';

/** M→R  Open the About dialog. Payload: {} */
export const ABOUT_OPEN = 'about:open';

/** M→R  Forward a tray menu action to the renderer. Payload: { action: string } */
export const TRAY_ACTION = 'tray:action';
