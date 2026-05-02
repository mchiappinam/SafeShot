import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import type { CaptureState, FillMode, HandlePosition, ScreenData, ToolType } from '../../shared/types';
import { RenderPipeline } from './render-pipeline';
import { CursorManager } from './cursor-manager';
import { SelectionManager } from '../selection/SelectionManager';
import { AnnotationEngine } from '../annotation/AnnotationEngine';
import { hitTest } from '../selection/resize-handles';
import { hitTestSelection } from '../selection/selection-math';

export interface OverlayCanvasProps {
  screens: ScreenData[];
  screenIndex: number;
  activeTool: ToolType | null;
  activeColor: string;
  strokeWidth: number;
  fillMode: FillMode;
  textBold: boolean;
  textItalic: boolean;
  textUnderline: boolean;
  textHighlight: boolean;
  textSize: number;
  initialSelection?: { x: number; y: number; width: number; height: number } | null;
  onStateChange: (state: CaptureState) => void;
  onAnnotationsChange: (canUndo: boolean, canRedo: boolean) => void;
  onSelectionChange: (sel: { x: number; y: number; width: number; height: number } | null) => void;
  onClose: () => void;
  onSave: (dataURL: string, shiftHeld: boolean) => void;
  onCopy: (dataURL: string) => void;
  onColorPick?: (color: string) => void;
}

export interface OverlayCanvasHandle {
  undo: () => void;
  redo: () => void;
  getSelectionDataURL: (forceScale?: number) => string | null;
  applySelection: (sel: { x: number; y: number; width: number; height: number }) => void;
}

export const OverlayCanvas = forwardRef<OverlayCanvasHandle, OverlayCanvasProps>(({
  screens, screenIndex, activeTool, activeColor, strokeWidth, fillMode, textBold, textItalic, textUnderline, textHighlight, textSize, initialSelection, onStateChange, onAnnotationsChange, onSelectionChange,
  onClose, onSave, onCopy, onColorPick,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipelineRef = useRef<RenderPipeline | null>(null);
  const cursorRef = useRef<CursorManager | null>(null);
  const selMgrRef = useRef<SelectionManager | null>(null);
  const annEngRef = useRef<AnnotationEngine | null>(null);

  const [captureState, setCaptureState] = useState<CaptureState>('capturing');
  const captureStateRef = useRef(captureState);
  captureStateRef.current = captureState;
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const [textInput, setTextInput] = useState<{ x: number; y: number; text: string; width?: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => { annEngRef.current?.setTool(activeTool); syncPipeline(); }, [activeTool]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { annEngRef.current?.setColor(activeColor); }, [activeColor]);
  useEffect(() => { annEngRef.current?.setCustomStrokeWidth(strokeWidth); }, [strokeWidth]);
  useEffect(() => { annEngRef.current?.setFillMode(fillMode); }, [fillMode]);
  useEffect(() => { annEngRef.current?.setTextBold(textBold); }, [textBold]);
  useEffect(() => { annEngRef.current?.setTextItalic(textItalic); }, [textItalic]);
  useEffect(() => { annEngRef.current?.setTextUnderline(textUnderline); }, [textUnderline]);
  useEffect(() => { annEngRef.current?.setTextHighlight(textHighlight); }, [textHighlight]);
  useEffect(() => { annEngRef.current?.setTextSize(textSize); }, [textSize]);
  // Finalize text input when switching tools
  useEffect(() => {
    if (textInput && activeTool !== 'text') {
      annEngRef.current?.updateText(textInput.text);
      captureAndFinalizeText();
      restoreEngineState();
      setTextInput(null);
      notifyAnnotations();
      syncPipeline();
    }
  }, [activeTool]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { onStateChange(captureState); }, [captureState, onStateChange]);

  const notifyAnnotations = useCallback(() => {
    const eng = annEngRef.current;
    onAnnotationsChange(eng?.canUndo() ?? false, eng?.canRedo() ?? false);
  }, [onAnnotationsChange]);

  const notifySelection = useCallback(() => {
    const sel = selMgrRef.current?.getSelection() ?? selMgrRef.current?.getPreviewSelection() ?? null;
    onSelectionChange(sel ? { x: sel.x, y: sel.y, width: sel.width, height: sel.height } : null);
  }, [onSelectionChange]);

  const syncPipeline = useCallback(() => {
    const pipeline = pipelineRef.current;
    const selMgr = selMgrRef.current;
    const annEng = annEngRef.current;
    if (!pipeline) return;
    const sel = selMgr?.getSelection() ?? selMgr?.getPreviewSelection() ?? null;
    pipeline.setSelection(sel);
    pipeline.setActiveTool(activeToolRef.current);
    // Don't render text preview while textarea is open (avoids duplicate text)
    const preview = annEng?.getPreview() ?? null;
    const filteredPreview = preview?.tool === 'text' ? null : preview;
    pipeline.setAnnotations(annEng?.getAnnotations() ?? [], filteredPreview);
    pipeline.requestRender();
    notifySelection();
  }, [notifySelection]);

  // Capture textarea width and finalize text
  const captureAndFinalizeText = useCallback(() => {
    const eng = annEngRef.current;
    if (!eng) return;
    const el = textareaRef.current;
    if (el) {
      // Subtract padding (2px) and border (1px) on each side
      eng.setTextWrapWidth(el.offsetWidth - 6);
    }
    eng.finalizeText();
  }, []);

  // Restore engine state to match React state (after text editing changes it)
  const restoreEngineState = useCallback(() => {
    const eng = annEngRef.current;
    if (!eng) return;
    eng.setColor(activeColor);
    eng.setTextBold(textBold);
    eng.setTextItalic(textItalic);
    eng.setTextUnderline(textUnderline);
    eng.setTextHighlight(textHighlight);
    eng.setTextSize(textSize);
  }, [activeColor, textBold, textItalic, textUnderline, textHighlight, textSize]);

  // Listen for overlay-activated events from other overlay windows.
  // When another overlay becomes active, clear our selection and reset to idle.
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    if (window.__TAURI__?.event) {
      window.__TAURI__.event.listen('overlay-activated', (event: { payload: unknown }) => {
        const activeIndex = event.payload as number;
        if (activeIndex !== screenIndex) {
          // Another overlay became active — clear our selection and annotations
          selMgrRef.current?.discardSelection();
          annEngRef.current?.clear();
          setCaptureState('capturing');
          syncPipeline();
        }
      }).then(fn => { unlisten = fn; });
    }
    return () => { unlisten?.(); };
  }, [screenIndex, syncPipeline]);

  // Export only the selected region (frozen screen + annotations, no UI chrome)
  const getSelectionDataURL = useCallback((forceScale?: number): string | null => {
    const pipeline = pipelineRef.current;
    const sel = selMgrRef.current?.getSelection();
    if (!pipeline || !sel) return null;

    const annEng = annEngRef.current;
    const annotations = annEng?.getAnnotations() ?? [];
    const preview = annEng?.getPreview() ?? null;
    const exportCanvas = pipeline.renderCleanExport(sel, annotations, preview, forceScale);
    if (!exportCanvas) return null;

    return exportCanvas.toDataURL('image/png');
  }, []);

  // Relay a shortcut to other overlay windows when this one doesn't have a selection
  const relayShortcut = useCallback((key: string) => {
    if (window.__TAURI__) {
      window.__TAURI__.core.invoke('relay_shortcut', { key }).catch(() => {});
    }
  }, []);

  // Listen for relayed shortcuts from other overlay windows
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    if (window.__TAURI__?.event) {
      window.__TAURI__.event.listen('shortcut-relay', (event: { payload: unknown }) => {
        const key = event.payload as string;
        const d = getSelectionDataURL();
        if (!d) return; // this overlay doesn't have a selection either
        if (key === 'b') onSave(d, true);
        else if (key === 's') onSave(d, false);
        else if (key === 'c') onCopy(d);
      }).then(fn => { unlisten = fn; });
    }
    return () => { unlisten?.(); };
  }, [getSelectionDataURL, onSave, onCopy]);

  const applySelection = useCallback((sel: { x: number; y: number; width: number; height: number }) => {
    const selMgr = selMgrRef.current;
    if (!selMgr) return;
    selMgr.discardSelection();
    selMgr.startSelection({ x: sel.x, y: sel.y });
    selMgr.updateSelection({ x: sel.x + sel.width, y: sel.y + sel.height });
    selMgr.finalizeSelection();
    setCaptureState('area-finalized');
    syncPipeline();
  }, [syncPipeline]);

  useImperativeHandle(ref, () => ({
    undo: () => { annEngRef.current?.undo(); notifyAnnotations(); syncPipeline(); },
    redo: () => { annEngRef.current?.redo(); notifyAnnotations(); syncPipeline(); },
    getSelectionDataURL,
    applySelection,
  }), [notifyAnnotations, syncPipeline, getSelectionDataURL, applySelection]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pipeline = new RenderPipeline(canvas);
    pipelineRef.current = pipeline;
    pipeline.start();
    cursorRef.current = new CursorManager(canvas);
    annEngRef.current = new AnnotationEngine();
    return () => { pipeline.stop(); pipelineRef.current = null; cursorRef.current?.destroy(); cursorRef.current = null; };
  }, []);

  useEffect(() => {
    if (!pipelineRef.current || screens.length === 0) return;
    const canvas = canvasRef.current;
    if (canvas) {
      // Scale canvas buffer for crisp HiDPI rendering
      // All drawing coordinates remain in CSS/logical pixels
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.imageSmoothingEnabled = false;
      }
    }
    selMgrRef.current = new SelectionManager({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight });
    pipelineRef.current.setScreens(screens).then(() => {
      pipelineRef.current?.requestRender();
    }).catch(console.error);
    // Show this overlay window once its screen is loaded
    requestAnimationFrame(() => {
      if (window.__TAURI__) {
        window.__TAURI__.core.invoke('show_overlay').catch(() => {});
      }
    });
  }, [screens]);

  // Apply initial selection when it arrives (may load after screens due to async settings)
  const initialAppliedRef = useRef(false);
  useEffect(() => {
    if (initialAppliedRef.current) return;
    if (!initialSelection || !selMgrRef.current || !pipelineRef.current) return;
    if (captureStateRef.current !== 'capturing') return;
    const s = initialSelection;
    const maxW = window.innerWidth;
    const maxH = window.innerHeight;
    if (s.x >= 0 && s.y >= 0 && s.x + s.width <= maxW && s.y + s.height <= maxH && s.width > 5 && s.height > 5) {
      selMgrRef.current.startSelection({ x: s.x, y: s.y });
      selMgrRef.current.updateSelection({ x: s.x + s.width, y: s.y + s.height });
      selMgrRef.current.finalizeSelection();
      setCaptureState('area-finalized');
      initialAppliedRef.current = true;
      syncPipeline();
    }
  }, [initialSelection, screens]); // eslint-disable-line react-hooks/exhaustive-deps

  const getCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement> | MouseEvent | React.Touch) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const clientX = 'clientX' in e ? e.clientX : 0;
    const clientY = 'clientY' in e ? e.clientY : 0;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));
    return { x, y };
  }, []);

  const getHoveredHandle = useCallback((x: number, y: number): HandlePosition | null => {
    const sel = selMgrRef.current?.getSelection();
    if (!sel) return null;
    return hitTest({ x, y }, sel)?.position ?? null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCoords(e);
    const state = captureStateRef.current;
    const selMgr = selMgrRef.current;
    const annEng = annEngRef.current;
    const sel = selMgr?.getSelection();

    // Notify other overlay windows that this one is now active
    if (window.__TAURI__) {
      window.__TAURI__.core.invoke('activate_overlay', { screenIndex }).catch(() => {});
    }

    if (e.button === 2) { if (state === 'capturing') onClose(); return; }

    if (state === 'capturing') {
      selMgr?.startSelection({ x, y }); setCaptureState('selecting');
    } else if (state === 'area-finalized' && sel) {
      const handle = getHoveredHandle(x, y);
      if (handle) { selMgr?.startResize(handle); setCaptureState('resizing'); syncPipeline(); return; }
      const inside = hitTestSelection({ x, y }, sel);
      // Eyedropper: pick color from canvas pixel
      if (inside && activeToolRef.current === 'eyedropper') {
        const color = pipelineRef.current?.getPixelColor(x, y);
        if (color && onColorPick) onColorPick(color);
        syncPipeline();
        return;
      }
      // Eraser tool: erase annotation at click point, enter annotating state for drag
      if (inside && activeToolRef.current === 'eraser') {
        annEng?.eraseAt({ x, y });
        notifyAnnotations();
        setCaptureState('annotating');
        syncPipeline();
        return;
      }
      // Hand tool: resize or move existing annotations
      if (inside && activeToolRef.current === 'hand') {
        // First check if clicking near a corner for resize
        const cornerHit = annEng?.hitTestAnnotationCorner({ x, y });
        if (cornerHit) {
          annEng?.startResizeAnnotation(cornerHit.id, cornerHit.corner, { x, y });
          setCaptureState('annotating');
          syncPipeline();
          return;
        }
        // Otherwise, move existing annotations
        const hitId = annEng?.hitTestAnnotation({ x, y });
        if (hitId) {
          annEng?.startMoveAnnotation(hitId, { x, y });
          setCaptureState('annotating');
        }
        syncPipeline();
        return;
      }
      if (inside && activeToolRef.current === 'text') {
        // Finalize any existing text first
        if (textInput) {
          annEng?.updateText(textInput.text);
          captureAndFinalizeText();
          restoreEngineState();
          notifyAnnotations();
        }
        // Check if clicking on an existing text annotation to edit it
        const hitId = annEng?.hitTestAnnotation({ x, y });
        if (hitId) {
          const anns = annEng?.getAnnotations() ?? [];
          const hitAnn = anns.find(a => a.id === hitId);
          if (hitAnn && hitAnn.tool === 'text') {
            // Remove the annotation and open textarea pre-filled with its data
            const removed = annEng?.editAnnotation(hitId);
            if (removed) {
              // Apply the annotation's formatting for the edit session
              annEng?.setColor(removed.color);
              annEng?.setTextBold(removed.textBold ?? false);
              annEng?.setTextItalic(removed.textItalic ?? false);
              annEng?.setTextUnderline(removed.textUnderline ?? false);
              annEng?.setTextHighlight(removed.textHighlight ?? false);
              annEng?.setTextSize(removed.textSize ?? 16);
              // Start a new text input at the annotation's original position
              // Subtract the padding+border offset since the textarea adds it back
              const pos = removed.points[0] ?? { x, y };
              const editPos = { x: pos.x - 3, y: pos.y - 3 };
              annEng?.startStroke(editPos);
              annEng?.updateText(removed.text ?? '');
              setTextInput({ x: editPos.x, y: editPos.y, text: removed.text ?? '', width: removed.textWidth ? removed.textWidth + 6 : undefined });
              notifyAnnotations();
              syncPipeline();
              return;
            }
          }
        }
        // No existing text annotation hit — start new text
        annEng?.startStroke({ x, y });
        setTextInput({ x, y, text: '' });
        syncPipeline();
        return;
      }
      if (inside && activeToolRef.current !== null) {
        // Finalize pending text if switching to another tool action
        if (textInput) {
          annEng?.updateText(textInput.text);
          captureAndFinalizeText();
          restoreEngineState();
          setTextInput(null);
          notifyAnnotations();
        }
        annEng?.startStroke({ x, y }); setCaptureState('annotating');
      }
      else if (inside) { selMgr?.startMove({ x, y }); setCaptureState('moving'); }
      else { selMgr?.discardSelection(); setTextInput(null); notifyAnnotations(); selMgr?.startSelection({ x, y }); setCaptureState('selecting'); }
    }
    syncPipeline();
  }, [getCoords, getHoveredHandle, syncPipeline, notifyAnnotations, onClose, onColorPick, textInput, screenIndex]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCoords(e);
    const state = captureStateRef.current;
    if (state === 'selecting') selMgrRef.current?.updateSelection({ x, y });
    else if (state === 'resizing') selMgrRef.current?.updateResize({ x, y });
    else if (state === 'moving') selMgrRef.current?.updateMove({ x, y });
    else if (state === 'annotating') {
      if (annEngRef.current?.isResizingAnnotation()) annEngRef.current.updateResizeAnnotation({ x, y });
      else if (annEngRef.current?.isMovingAnnotation()) annEngRef.current.updateMoveAnnotation({ x, y });
      else if (activeToolRef.current === 'eraser') { annEngRef.current?.eraseAt({ x, y }); notifyAnnotations(); }
      else annEngRef.current?.updateStroke({ x, y });
    }
    cursorRef.current?.update({
      captureState: state, selection: selMgrRef.current?.getSelection() ?? null,
      activeTool: activeToolRef.current, mouseX: x, mouseY: y,
      hoveredHandle: state === 'area-finalized' ? getHoveredHandle(x, y) : null, isOverToolbar: false,
    });
    syncPipeline();
  }, [getCoords, getHoveredHandle, syncPipeline, notifyAnnotations]);

  const handleMouseUp = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    const state = captureStateRef.current;
    if (state === 'selecting') { const sel = selMgrRef.current?.finalizeSelection(); setCaptureState(sel ? 'area-finalized' : 'capturing'); }
    else if (state === 'resizing') { selMgrRef.current?.finalizeResize(); setCaptureState('area-finalized'); }
    else if (state === 'moving') { selMgrRef.current?.finalizeMove(); setCaptureState('area-finalized'); }
    else if (state === 'annotating') {
      if (annEngRef.current?.isResizingAnnotation()) annEngRef.current.finalizeResizeAnnotation();
      else if (annEngRef.current?.isMovingAnnotation()) annEngRef.current.finalizeMoveAnnotation();
      else if (activeToolRef.current === 'eraser') { /* eraser has no stroke to finalize */ }
      else annEngRef.current?.finalizeStroke();
      notifyAnnotations(); setCaptureState('area-finalized');
    }
    syncPipeline();
  }, [syncPipeline, notifyAnnotations]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const canvas = canvasRef.current;
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    // Delete/Backspace with hand tool: delete last interacted annotation
    if ((e.key === 'Delete' || e.key === 'Backspace') && activeToolRef.current === 'hand') {
      e.preventDefault();
      if (annEngRef.current?.deleteLastInteracted()) {
        notifyAnnotations();
        syncPipeline();
      }
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); annEngRef.current?.undo(); notifyAnnotations(); syncPipeline(); }
    else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); annEngRef.current?.redo(); notifyAnnotations(); syncPipeline(); }
    else if (e.key === 'b') { e.preventDefault(); const d = getSelectionDataURL(); if (d) onSave(d, true); else relayShortcut('b'); }
    else if (e.key === 's') { e.preventDefault(); const d = getSelectionDataURL(); if (d) onSave(d, false); else relayShortcut('s'); }
    else if (e.key === 'c') { e.preventDefault(); const d = getSelectionDataURL(); if (d) onCopy(d); else relayShortcut('c'); }
    else if (e.key === 'a') { e.preventDefault();
      selMgrRef.current?.discardSelection();
      selMgrRef.current?.startSelection({ x: 0, y: 0 });
      selMgrRef.current?.updateSelection({ x: window.innerWidth, y: window.innerHeight });
      selMgrRef.current?.finalizeSelection();
      setCaptureState('area-finalized');
      syncPipeline();
    }
  }, [syncPipeline, notifyAnnotations, onClose, onSave, onCopy, getSelectionDataURL]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Touch event handlers for touchscreen support
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    // Create a synthetic mouse event-like object
    handleMouseDown({ ...e, clientX: touch.clientX, clientY: touch.clientY, button: 0, getCoords: undefined } as unknown as React.MouseEvent<HTMLCanvasElement>);
  }, [handleMouseDown]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    e.preventDefault();
    const touch = e.touches[0];
    handleMouseMove({ ...e, clientX: touch.clientX, clientY: touch.clientY } as unknown as React.MouseEvent<HTMLCanvasElement>);
  }, [handleMouseMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    handleMouseUp(e as unknown as React.MouseEvent<HTMLCanvasElement>);
  }, [handleMouseUp]);

  return (
    <>
      <canvas ref={canvasRef}
        style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: window.innerWidth, height: window.innerHeight, touchAction: 'none' }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()} />
      {textInput && (
        <textarea
          ref={(el) => { textareaRef.current = el; if (el) setTimeout(() => el.focus(), 0); }}
          value={textInput.text}
          onChange={(e) => {
            const val = e.target.value;
            setTextInput(prev => prev ? { ...prev, text: val } : null);
            annEngRef.current?.updateText(val);
            syncPipeline();
          }}
          onKeyDown={(e) => {
            // Let Ctrl/Cmd shortcuts pass through to the global handler
            if ((e.ctrlKey || e.metaKey) && e.key !== 'a') {
              // Don't stop propagation for shortcuts like Ctrl+S, Ctrl+C, Ctrl+B
              // But keep Ctrl+A for select-all within the textarea
              return;
            }
            // Stop other key events from reaching the global handler while typing
            e.stopPropagation();
            if (e.key === 'Escape') {
              annEngRef.current?.updateText(textInput.text);
              captureAndFinalizeText();
              restoreEngineState();
              setTextInput(null);
              notifyAnnotations();
              syncPipeline();
            }
          }}
          style={{
            position: 'fixed',
            left: textInput.x,
            top: textInput.y,
            minWidth: textInput.width ?? 100,
            width: textInput.width,
            minHeight: 24,
            background: textHighlight ? `${annEngRef.current?.getColor() ?? '#FF0000'}4D` : 'transparent',
            border: '1px dashed rgba(255,255,255,0.5)',
            color: annEngRef.current?.getColor() ?? '#FF0000',
            font: `${textItalic ? 'italic ' : ''}${textBold ? 'bold ' : ''}${textSize}px sans-serif`,
            textDecoration: textUnderline ? 'underline' : 'none',
            outline: 'none',
            resize: 'both',
            zIndex: 2000,
            padding: 2,
          }}
        />
      )}
    </>
  );
});

OverlayCanvas.displayName = 'OverlayCanvas';
export default OverlayCanvas;
