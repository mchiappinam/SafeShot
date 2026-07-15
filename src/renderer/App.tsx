import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptureState, FillMode, Rectangle, ScreenData, ToolType } from '../shared/types';
import { DEFAULT_COLOR } from '../shared/constants';
import { computeToolbarPositions } from './toolbar/toolbar-position';
import OverlayCanvas from './overlay/OverlayCanvas';
import type { OverlayCanvasHandle } from './overlay/OverlayCanvas';
import DrawingToolbar from './toolbar/DrawingToolbar';
import ActionToolbar from './toolbar/ActionToolbar';
import ColorPicker from './toolbar/ColorPicker';
import SettingsPopup from './toolbar/SettingsPopup';
import type { SelectionPreset } from './toolbar/SettingsPopup';
import TextFormatBar from './toolbar/TextFormatBar';
import './toolbar/toolbar.css';

declare global {
  interface Window {
    __TAURI__: {
      core: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> };
      event: {
        listen: (event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>;
      };
    };
  }
}

function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return window.__TAURI__.core.invoke(cmd, args) as Promise<T>;
}

/** Read the screen index from the URL query string (?screen=N). */
function getScreenIndex(): number {
  const params = new URLSearchParams(window.location.search);
  return parseInt(params.get('screen') ?? '0', 10);
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
  const screenIndex = useRef(getScreenIndex()).current;
  const overlayRef = useRef<OverlayCanvasHandle>(null);
  const [screens, setScreens] = useState<ScreenData[]>([]);
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [activeColor, setActiveColor] = useState(DEFAULT_COLOR);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [fillMode, setFillMode] = useState<FillMode>('hollow');
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textUnderline, setTextUnderline] = useState(false);
  const [textHighlight, setTextHighlight] = useState(false);
  const [textSize, setTextSize] = useState(16);
  const [selection, setSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [initialSelection, setInitialSelection] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [selectionPreset, setSelectionPreset] = useState<SelectionPreset>('custom');

  // Flag to prevent broadcast loops when receiving state from another overlay
  const receivingRef = useRef(false);

  // Broadcast tool state to other overlay windows
  const broadcastToolState = useCallback((overrides?: Record<string, unknown>) => {
    if (receivingRef.current) return;
    invoke('sync_tool_state', { state: { screenIndex, ...overrides } }).catch(() => {});
  }, [screenIndex]);

  // Listen for tool state changes from other overlays
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    if (window.__TAURI__?.event) {
      window.__TAURI__.event.listen('tool-state-changed', (event: { payload: unknown }) => {
        const s = event.payload as Record<string, unknown>;
        if (s.screenIndex === screenIndex) return; // ignore our own broadcasts
        receivingRef.current = true;
        if (s.activeTool !== undefined) setActiveTool(s.activeTool as ToolType | null);
        if (s.activeColor !== undefined) setActiveColor(s.activeColor as string);
        if (s.strokeWidth !== undefined) setStrokeWidth(s.strokeWidth as number);
        if (s.fillMode !== undefined) setFillMode(s.fillMode as FillMode);
        if (s.textBold !== undefined) setTextBold(s.textBold as boolean);
        if (s.textItalic !== undefined) setTextItalic(s.textItalic as boolean);
        if (s.textUnderline !== undefined) setTextUnderline(s.textUnderline as boolean);
        if (s.textHighlight !== undefined) setTextHighlight(s.textHighlight as boolean);
        if (s.textSize !== undefined) setTextSize(s.textSize as number);
        if (s.selectionPreset !== undefined) setSelectionPreset(s.selectionPreset as SelectionPreset);
        receivingRef.current = false;
      }).then(fn => { unlisten = fn; });
    }
    return () => { unlisten?.(); };
  }, [screenIndex]);

  /** Resolve a preset string to a selection rect, or null for 'custom'/'last'. */
  const resolvePreset = useCallback((preset: string): { x: number; y: number; width: number; height: number } | null => {
    const sw = window.innerWidth;
    const sh = window.innerHeight;
    if (preset === 'fullscreen') {
      return { x: 0, y: 0, width: sw, height: sh };
    }
    const match = preset.match(/^(\d+)x(\d+)$/);
    if (match) {
      const pw = Math.min(parseInt(match[1], 10), sw);
      const ph = Math.min(parseInt(match[2], 10), sh);
      return { x: Math.round((sw - pw) / 2), y: Math.round((sh - ph) / 2), width: pw, height: ph };
    }
    return null;
  }, []);

  useEffect(() => {
    invoke<TauriScreenData[]>('capture_screens').then(raw => {
      const all = mapScreenData(raw);
      // Each overlay window only shows its own screen
      const myScreen = all[screenIndex];
      if (myScreen) {
        setScreens([myScreen]);
      } else {
        console.error(`Screen index ${screenIndex} not found in ${all.length} screens`);
        setScreens(all.length > 0 ? [all[0]] : []);
      }
    }).catch(err => console.error('capture_screens failed:', err));
    // Load last used color and thickness
    invoke<string>('get_last_color').then(color => {
      if (color) setActiveColor(color);
    }).catch(() => {});
    invoke<number>('get_last_thickness').then(t => {
      if (t > 0) setStrokeWidth(t);
    }).catch(() => {});
    invoke<string>('get_fill_mode').then(mode => {
      if (mode === 'hollow' || mode === 'solid' || mode === 'blur' || mode === 'redact') setFillMode(mode);
    }).catch(() => {});
    invoke<string>('get_last_tool').then(tool => {
      if (tool === 'move') { setActiveTool(null); return; }
      const valid: ToolType[] = ['pencil', 'line', 'arrow', 'sharpie', 'circle', 'triangle', 'octagon', 'square', 'text', 'hand', 'eyedropper', 'eraser', 'calligraphy', 'diamond', 'star', 'pentagon', 'heart'];
      if (tool && valid.includes(tool as ToolType)) setActiveTool(tool as ToolType);
    }).catch(() => {});
    invoke<Record<string, unknown>>('get_text_settings').then(ts => {
      if (ts.bold !== undefined) setTextBold(ts.bold as boolean);
      if (ts.italic !== undefined) setTextItalic(ts.italic as boolean);
      if (ts.underline !== undefined) setTextUnderline(ts.underline as boolean);
      if (ts.highlight !== undefined) setTextHighlight(ts.highlight as boolean);
      if (ts.size !== undefined) setTextSize(ts.size as number);
    }).catch(() => {});
    // Load selection preset setting
    invoke<Record<string, unknown>>('get_settings').then(s => {
      const preset = (s.selectionPreset as string) || 'custom';
      setSelectionPreset(preset as SelectionPreset);
      if (preset === 'last') {
        invoke<Record<string, unknown> | null>('get_last_selection').then(sel => {
          if (sel && typeof sel.x === 'number' && typeof sel.width === 'number' && sel.width > 0 && sel.height as number > 0) {
            setInitialSelection({ x: sel.x as number, y: sel.y as number, width: sel.width as number, height: sel.height as number });
          }
        }).catch(() => {});
      } else if (preset !== 'custom') {
        const rect = resolvePreset(preset);
        if (rect) setInitialSelection(rect);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Close overlay only, don't exit the app
  const handleClose = useCallback(() => {
    invoke('close_overlay').catch(console.error);
  }, []);

  const handleSave = useCallback((dataURL: string, shiftHeld: boolean) => {
    invoke<{ success: boolean; file_path?: string; error?: string }>('save_screenshot', {
      imageDataUrl: dataURL, showDialog: shiftHeld,
    }).then(result => {
      if (result.success && !shiftHeld) {
        invoke('close_overlay').catch(console.error);
      } else if (!result.success && result.error !== 'Cancelled') {
        console.error('Save failed:', result.error);
      }
    });
  }, []);

  const handleCopy = useCallback((dataURL: string) => {
    invoke('copy_to_clipboard', { imageDataUrl: dataURL })
      .then(() => {
        invoke('close_overlay').catch(console.error);
      })
      .catch(console.error);
  }, []);

  const handleStateChange = useCallback((state: CaptureState) => {
    setCaptureState(state);
    // Close popups when leaving area-finalized (e.g., starting a new selection)
    if (state !== 'area-finalized') {
      setColorPickerOpen(false);
      setSettingsOpen(false);
    }
  }, []);

  // Auto-save text settings when any change
  useEffect(() => {
    invoke('set_text_settings', { settings: { bold: textBold, italic: textItalic, underline: textUnderline, highlight: textHighlight, size: textSize } }).catch(() => {});
  }, [textBold, textItalic, textUnderline, textHighlight, textSize]);

  const handleAnnotationsChange = useCallback((undo: boolean, redo: boolean) => { setCanUndo(undo); setCanRedo(redo); }, []);
  const handleSelectionChange = useCallback((sel: { x: number; y: number; width: number; height: number } | null) => {
    setSelection(sel);
  }, []);

  // Save selection to disk only when capture state transitions to finalized
  useEffect(() => {
    if (captureState === 'area-finalized' && selection) {
      invoke('set_last_selection', { x: selection.x, y: selection.y, width: selection.width, height: selection.height }).catch(() => {});
    }
  }, [captureState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Use window dimensions as bounds for toolbar clamping
  const bounds: Rectangle = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  const showToolbars = captureState === 'area-finalized' && selection !== null;
  const toolbarPositions = selection ? computeToolbarPositions(selection, bounds) : null;

  return (
    <>
      <OverlayCanvas
        ref={overlayRef}
        screens={screens}
        screenIndex={screenIndex}
        activeTool={activeTool}
        activeColor={activeColor}
        strokeWidth={strokeWidth}
        fillMode={fillMode}
        textBold={textBold} textItalic={textItalic} textUnderline={textUnderline}
        textHighlight={textHighlight} textSize={textSize}
        initialSelection={initialSelection}
        onStateChange={handleStateChange}
        onAnnotationsChange={handleAnnotationsChange}
        onSelectionChange={handleSelectionChange}
        onClose={handleClose}
        onSave={handleSave}
        onCopy={handleCopy}
        onColorPick={(c) => { setActiveColor(c); invoke('set_last_color', { color: c }).catch(() => {}); broadcastToolState({ activeColor: c }); }}
      />

      {showToolbars && toolbarPositions && (
        <div className={captureState === 'area-finalized' ? 'toolbar' : 'toolbar--hidden'}>
          <DrawingToolbar activeTool={activeTool} onToolSelect={(t) => { setActiveTool(t); invoke('set_last_tool', { tool: t ?? 'move' }).catch(() => {}); broadcastToolState({ activeTool: t }); }}
            onColorPickerOpen={() => { setColorPickerOpen(v => !v); setSettingsOpen(false); }}
            onSettingsOpen={() => { setSettingsOpen(v => !v); setColorPickerOpen(false); }}
            activeColor={activeColor}
            fillMode={fillMode}
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
          onColorChange={(c) => { setActiveColor(c); setColorPickerOpen(false); invoke('set_last_color', { color: c }).catch(() => {}); broadcastToolState({ activeColor: c }); }}
          onClose={() => setColorPickerOpen(false)}
          position={{ x: toolbarPositions.drawing.x + 90, y: toolbarPositions.drawing.y }} />
      )}

      {settingsOpen && toolbarPositions && (
        <SettingsPopup strokeWidth={strokeWidth} fillMode={fillMode} selectionPreset={selectionPreset}
          onStrokeWidthChange={(v) => { setStrokeWidth(v); invoke('set_last_thickness', { thickness: v }).catch(() => {}); broadcastToolState({ strokeWidth: v }); }}
          onFillModeChange={(m) => { setFillMode(m); invoke('set_fill_mode', { mode: m }).catch(() => {}); broadcastToolState({ fillMode: m }); }}
          onSelectionPresetChange={(p) => {
            setSelectionPreset(p);
            invoke('set_setting', { key: 'selectionPreset', value: p }).catch(() => {});
            broadcastToolState({ selectionPreset: p });
            // Apply immediately
            if (p === 'custom') return;
            if (p === 'last') {
              invoke<Record<string, unknown> | null>('get_last_selection').then(sel => {
                if (sel && typeof sel.x === 'number' && typeof sel.width === 'number' && sel.width > 0 && sel.height as number > 0) {
                  overlayRef.current?.applySelection({ x: sel.x as number, y: sel.y as number, width: sel.width as number, height: sel.height as number });
                }
              }).catch(() => {});
            } else {
              const rect = resolvePreset(p);
              if (rect) overlayRef.current?.applySelection(rect);
            }
          }}
          onClose={() => setSettingsOpen(false)}
          position={{ x: toolbarPositions.drawing.x + 90, y: toolbarPositions.drawing.y }} />
      )}

      {activeTool === 'text' && showToolbars && toolbarPositions && (
        <div className={captureState === 'area-finalized' ? 'toolbar' : 'toolbar--hidden'}>
          <TextFormatBar
            bold={textBold} italic={textItalic} underline={textUnderline}
            highlight={textHighlight} size={textSize}
            onBoldToggle={() => { setTextBold(v => { broadcastToolState({ textBold: !v }); return !v; }); }}
            onItalicToggle={() => { setTextItalic(v => { broadcastToolState({ textItalic: !v }); return !v; }); }}
            onUnderlineToggle={() => { setTextUnderline(v => { broadcastToolState({ textUnderline: !v }); return !v; }); }}
            onHighlightToggle={() => { setTextHighlight(v => { broadcastToolState({ textHighlight: !v }); return !v; }); }}
            onSizeChange={(s) => { setTextSize(s); broadcastToolState({ textSize: s }); }}
            position={{ x: toolbarPositions.text.x, y: toolbarPositions.text.y }} />
        </div>
      )}
    </>
  );
}
