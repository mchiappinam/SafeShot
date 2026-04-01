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
  // Fix 4: selection state is now set by OverlayCanvas via callback
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const api = (window as Window & { electronAPI?: {
      onCaptureStart: (cb: (payload: { screens: ScreenData[] }) => void) => void;
      onAboutOpen?: (cb: () => void) => void;
    } }).electronAPI;
    if (!api) return;
    api.onCaptureStart(({ screens: s }) => setScreens(s));
    api.onAboutOpen?.(() => setAboutOpen(true));
  }, []);

  const handleStateChange = useCallback((state: CaptureState) => setCaptureState(state), []);
  const handleAnnotationsChange = useCallback((undo: boolean, redo: boolean) => {
    setCanUndo(undo); setCanRedo(redo);
  }, []);
  // Fix 4: receive selection from OverlayCanvas
  const handleSelectionChange = useCallback((sel: { x: number; y: number; width: number; height: number } | null) => {
    setSelection(sel);
  }, []);
  const handleToolSelect = useCallback((tool: ToolType | null) => setActiveTool(tool), []);
  const handleColorChange = useCallback((color: string) => {
    setActiveColor(color); setColorPickerOpen(false);
  }, []);
  const getImageDataURL = useCallback(() => {
    const canvas = document.querySelector('canvas');
    return canvas?.toDataURL('image/png') ?? '';
  }, []);

  // Fix 5: undo/redo via imperative ref instead of synthetic keyboard events
  const handleUndo = useCallback(() => overlayRef.current?.undo(), []);
  const handleRedo = useCallback(() => overlayRef.current?.redo(), []);

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
      />

      {showToolbars && toolbarPositions && (
        <div className={captureState === 'area-finalized' ? 'toolbar' : 'toolbar--hidden'}>
          <DrawingToolbar
            activeTool={activeTool}
            onToolSelect={handleToolSelect}
            onColorPickerOpen={() => setColorPickerOpen(true)}
            activeColor={activeColor}
            position={{ x: toolbarPositions.drawing.x, y: toolbarPositions.drawing.y }}
          />
        </div>
      )}

      {showToolbars && toolbarPositions && (
        <div className={captureState === 'area-finalized' ? 'toolbar' : 'toolbar--hidden'}>
          <ActionToolbar
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            getImageDataURL={getImageDataURL}
            position={{ x: toolbarPositions.action.x, y: toolbarPositions.action.y }}
          />
        </div>
      )}

      {colorPickerOpen && toolbarPositions && (
        <ColorPicker
          selectedColor={activeColor}
          onColorChange={handleColorChange}
          onClose={() => setColorPickerOpen(false)}
          position={{ x: toolbarPositions.drawing.x + 50, y: toolbarPositions.drawing.y }}
        />
      )}

      {aboutOpen && (
        <AboutDialog version="1.0.0" onClose={() => setAboutOpen(false)} />
      )}
    </>
  );
}
