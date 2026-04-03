import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptureState, Rectangle, ScreenData, ToolType } from '../shared/types';
import { DEFAULT_COLOR } from '../shared/constants';
import { computeToolbarPositions } from './toolbar/toolbar-position';
import OverlayCanvas from './overlay/OverlayCanvas';
import type { OverlayCanvasHandle } from './overlay/OverlayCanvas';
import DrawingToolbar from './toolbar/DrawingToolbar';
import ActionToolbar from './toolbar/ActionToolbar';
import ColorPicker from './toolbar/ColorPicker';
import AboutDialog from './about/AboutDialog';
import './toolbar/toolbar.css';

declare global {
  interface Window {
    __TAURI__: {
      core: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> };
    };
  }
}

function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return window.__TAURI__.core.invoke(cmd, args) as Promise<T>;
}

function computeTotalBounds(screens: ScreenData[]): Rectangle {
  if (screens.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of screens) {
    minX = Math.min(minX, s.bounds.x); minY = Math.min(minY, s.bounds.y);
    maxX = Math.max(maxX, s.bounds.x + s.bounds.width);
    maxY = Math.max(maxY, s.bounds.y + s.bounds.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

interface TauriScreenData {
  display_id: string;
  x: number; y: number; width: number; height: number;
  scale_factor: number;
  image_data_url: string;
}

function mapScreenData(raw: TauriScreenData[]): ScreenData[] {
  return raw.map(s => ({
    displayId: s.display_id,
    bounds: { x: s.x, y: s.y, width: s.width, height: s.height },
    scaleFactor: s.scale_factor,
    imageDataURL: s.image_data_url,
    nativeWidth: s.width,
    nativeHeight: s.height,
  }));
}

export default function App(): React.ReactElement {
  const overlayRef = useRef<OverlayCanvasHandle>(null);
  const [screens, setScreens] = useState<ScreenData[]>([]);
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [activeColor, setActiveColor] = useState(DEFAULT_COLOR);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    invoke<TauriScreenData[]>('capture_screens').then(raw => {
      setScreens(mapScreenData(raw));
    }).catch(err => console.error('capture_screens failed:', err));
  }, []);

  // Fix 1: use window.close() which Tauri intercepts
  const handleClose = useCallback(() => { window.close(); }, []);

  const handleSave = useCallback((dataURL: string, shiftHeld: boolean) => {
    invoke<{ success: boolean; file_path?: string; error?: string }>('save_screenshot', {
      imageDataUrl: dataURL, showDialog: shiftHeld,
    }).then(result => {
      if (result.success) handleClose();
      else console.error('Save failed:', result.error);
    });
  }, [handleClose]);

  const handleCopy = useCallback((dataURL: string) => {
    invoke('copy_to_clipboard', { imageDataUrl: dataURL }).catch(console.error);
  }, []);

  const handleStateChange = useCallback((state: CaptureState) => setCaptureState(state), []);
  const handleAnnotationsChange = useCallback((undo: boolean, redo: boolean) => { setCanUndo(undo); setCanRedo(redo); }, []);
  const handleSelectionChange = useCallback((sel: { x: number; y: number; width: number; height: number } | null) => setSelection(sel), []);

  const bounds = computeTotalBounds(screens);
  const showToolbars = captureState === 'area-finalized' && selection !== null;
  const toolbarPositions = selection ? computeToolbarPositions(selection, bounds) : null;

  return (
    <>
      <OverlayCanvas
        ref={overlayRef}
        screens={screens}
        activeTool={activeTool}
        activeColor={activeColor}
        onStateChange={handleStateChange}
        onAnnotationsChange={handleAnnotationsChange}
        onSelectionChange={handleSelectionChange}
        onClose={handleClose}
        onSave={handleSave}
        onCopy={handleCopy}
      />

      {showToolbars && toolbarPositions && (
        <div className={captureState === 'area-finalized' ? 'toolbar' : 'toolbar--hidden'}>
          <DrawingToolbar activeTool={activeTool} onToolSelect={setActiveTool}
            onColorPickerOpen={() => setColorPickerOpen(true)} activeColor={activeColor}
            position={{ x: toolbarPositions.drawing.x, y: toolbarPositions.drawing.y }} />
        </div>
      )}

      {showToolbars && toolbarPositions && (
        <div className={captureState === 'area-finalized' ? 'toolbar' : 'toolbar--hidden'}>
          <ActionToolbar canUndo={canUndo} canRedo={canRedo}
            onUndo={() => overlayRef.current?.undo()} onRedo={() => overlayRef.current?.redo()}
            onSave={() => { const c = document.querySelector('canvas'); if (c) handleSave(c.toDataURL('image/png'), false); }}
            onCopy={() => { const c = document.querySelector('canvas'); if (c) handleCopy(c.toDataURL('image/png')); }}
            onCancel={handleClose}
            position={{ x: toolbarPositions.action.x, y: toolbarPositions.action.y }} />
        </div>
      )}

      {colorPickerOpen && toolbarPositions && (
        <ColorPicker selectedColor={activeColor}
          onColorChange={(c) => { setActiveColor(c); setColorPickerOpen(false); }}
          onClose={() => setColorPickerOpen(false)}
          position={{ x: toolbarPositions.drawing.x + 50, y: toolbarPositions.drawing.y }} />
      )}

      {aboutOpen && <AboutDialog version="1.1.0" onClose={() => setAboutOpen(false)} />}
    </>
  );
}
