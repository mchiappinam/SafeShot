import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptureState, FillMode, Rectangle, ScreenData, ToolType } from '../shared/types';
import { DEFAULT_COLOR } from '../shared/constants';
import { computeToolbarPositions } from './toolbar/toolbar-position';
import OverlayCanvas from './overlay/OverlayCanvas';
import type { OverlayCanvasHandle } from './overlay/OverlayCanvas';
import DrawingToolbar from './toolbar/DrawingToolbar';
import ActionToolbar from './toolbar/ActionToolbar';
import ColorPicker from './toolbar/ColorPicker';
import ThicknessPicker from './toolbar/ThicknessPicker';
import TextFormatBar from './toolbar/TextFormatBar';
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

interface TauriScreenData {
  display_id: string;
  x: number; y: number; width: number; height: number;
  scale_factor: number;
  native_width: number;
  native_height: number;
  image_data_url: string;
}

function mapScreenData(raw: TauriScreenData[]): ScreenData[] {
  return raw.map(s => ({
    displayId: s.display_id,
    bounds: { x: s.x, y: s.y, width: s.width, height: s.height },
    scaleFactor: s.scale_factor,
    imageDataURL: s.image_data_url,
    nativeWidth: s.native_width,
    nativeHeight: s.native_height,
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
  const [thicknessOpen, setThicknessOpen] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [fillMode, setFillMode] = useState<FillMode>('hollow');
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textUnderline, setTextUnderline] = useState(false);
  const [textHighlight, setTextHighlight] = useState(false);
  const [textSize, setTextSize] = useState(16);
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  useEffect(() => {
    invoke<TauriScreenData[]>('capture_screens').then(raw => {
      setScreens(mapScreenData(raw));
    }).catch(err => console.error('capture_screens failed:', err));
    // Load last used color and thickness
    invoke<string>('get_last_color').then(color => {
      if (color) setActiveColor(color);
    }).catch(() => {});
    invoke<number>('get_last_thickness').then(t => {
      if (t > 0) setStrokeWidth(t);
    }).catch(() => {});
    invoke<string>('get_fill_mode').then(mode => {
      if (mode === 'hollow' || mode === 'solid' || mode === 'blur') setFillMode(mode);
    }).catch(() => {});
    invoke<string>('get_last_tool').then(tool => {
      if (tool) setActiveTool(tool as ToolType);
    }).catch(() => {});
    invoke<Record<string, unknown>>('get_text_settings').then(ts => {
      if (ts.bold !== undefined) setTextBold(ts.bold as boolean);
      if (ts.italic !== undefined) setTextItalic(ts.italic as boolean);
      if (ts.underline !== undefined) setTextUnderline(ts.underline as boolean);
      if (ts.highlight !== undefined) setTextHighlight(ts.highlight as boolean);
      if (ts.size !== undefined) setTextSize(ts.size as number);
    }).catch(() => {});
  }, []);

  // Close overlay only, don't exit the app
  const handleClose = useCallback(() => {
    invoke('close_overlay').catch(console.error);
  }, []);

  const handleSave = useCallback((dataURL: string, shiftHeld: boolean) => {
    invoke<{ success: boolean; file_path?: string; error?: string }>('save_screenshot', {
      imageDataUrl: dataURL, showDialog: shiftHeld,
    }).then(result => {
      // When showDialog=true, Rust handles closing the overlay itself
      // When showDialog=false (quick save), close overlay on success
      if (result.success && !shiftHeld) invoke('close_overlay').catch(console.error);
      else if (!result.success && result.error !== 'Cancelled') console.error('Save failed:', result.error);
    });
  }, []);

  const handleCopy = useCallback((dataURL: string) => {
    invoke('copy_to_clipboard', { imageDataUrl: dataURL })
      .then(() => invoke('close_overlay').catch(console.error))
      .catch(console.error);
  }, []);

  const handleStateChange = useCallback((state: CaptureState) => setCaptureState(state), []);

  // Auto-save text settings when any change
  useEffect(() => {
    invoke('set_text_settings', { settings: { bold: textBold, italic: textItalic, underline: textUnderline, highlight: textHighlight, size: textSize } }).catch(() => {});
  }, [textBold, textItalic, textUnderline, textHighlight, textSize]);

  const handleAnnotationsChange = useCallback((undo: boolean, redo: boolean) => { setCanUndo(undo); setCanRedo(redo); }, []);
  const handleSelectionChange = useCallback((sel: { x: number; y: number; width: number; height: number } | null) => setSelection(sel), []);

  // Use window dimensions as bounds for toolbar clamping
  const bounds: Rectangle = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  const showToolbars = captureState === 'area-finalized' && selection !== null;
  const toolbarPositions = selection ? computeToolbarPositions(selection, bounds) : null;

  return (
    <>
      <OverlayCanvas
        ref={overlayRef}
        screens={screens}
        activeTool={activeTool}
        activeColor={activeColor}
        strokeWidth={strokeWidth}
        fillMode={fillMode}
        textBold={textBold} textItalic={textItalic} textUnderline={textUnderline}
        textHighlight={textHighlight} textSize={textSize}
        onStateChange={handleStateChange}
        onAnnotationsChange={handleAnnotationsChange}
        onSelectionChange={handleSelectionChange}
        onClose={handleClose}
        onSave={handleSave}
        onCopy={handleCopy}
        onColorPick={(c) => { setActiveColor(c); invoke('set_last_color', { color: c }).catch(() => {}); }}
      />

      {showToolbars && toolbarPositions && (
        <div className={captureState === 'area-finalized' ? 'toolbar' : 'toolbar--hidden'}>
          <DrawingToolbar activeTool={activeTool} onToolSelect={(t) => { setActiveTool(t); if (t) invoke('set_last_tool', { tool: t }).catch(() => {}); }}
            onColorPickerOpen={() => { setColorPickerOpen(true); setThicknessOpen(false); }}
            onThicknessOpen={() => { setThicknessOpen(true); setColorPickerOpen(false); }}
            activeColor={activeColor} strokeWidth={strokeWidth}
            fillMode={fillMode} onFillModeChange={(m) => { setFillMode(m); invoke('set_fill_mode', { mode: m }).catch(() => {}); }}
            position={{ x: toolbarPositions.drawing.x, y: toolbarPositions.drawing.y }} />
        </div>
      )}

      {showToolbars && toolbarPositions && (
        <div className={captureState === 'area-finalized' ? 'toolbar' : 'toolbar--hidden'}>
          <ActionToolbar canUndo={canUndo} canRedo={canRedo}
            onUndo={() => overlayRef.current?.undo()} onRedo={() => overlayRef.current?.redo()}
            onSave={() => { const d = overlayRef.current?.getSelectionDataURL(); if (d) handleSave(d, false); }}
            onSaveAs={() => { const d = overlayRef.current?.getSelectionDataURL(); if (d) handleSave(d, true); }}
            onCopy={() => { const d = overlayRef.current?.getSelectionDataURL(); if (d) handleCopy(d); }}
            onCancel={handleClose}
            position={{ x: toolbarPositions.action.x, y: toolbarPositions.action.y }} />
        </div>
      )}

      {colorPickerOpen && toolbarPositions && (
        <ColorPicker selectedColor={activeColor}
          onColorChange={(c) => { setActiveColor(c); setColorPickerOpen(false); invoke('set_last_color', { color: c }).catch(() => {}); }}
          onClose={() => setColorPickerOpen(false)}
          position={{ x: toolbarPositions.drawing.x + 90, y: toolbarPositions.drawing.y }} />
      )}

      {thicknessOpen && toolbarPositions && (
        <ThicknessPicker value={strokeWidth}
          onChange={(v) => { setStrokeWidth(v); invoke('set_last_thickness', { thickness: v }).catch(() => {}); }}
          onClose={() => setThicknessOpen(false)}
          position={{ x: toolbarPositions.drawing.x + 90, y: toolbarPositions.drawing.y }} />
      )}

      {activeTool === 'text' && toolbarPositions && (
        <TextFormatBar
          bold={textBold} italic={textItalic} underline={textUnderline}
          highlight={textHighlight} size={textSize}
          onBoldToggle={() => setTextBold(v => !v)}
          onItalicToggle={() => setTextItalic(v => !v)}
          onUnderlineToggle={() => setTextUnderline(v => !v)}
          onHighlightToggle={() => setTextHighlight(v => !v)}
          onSizeChange={setTextSize}
          position={{ x: toolbarPositions.action.x, y: toolbarPositions.action.y - 50 }} />
      )}
    </>
  );
}
