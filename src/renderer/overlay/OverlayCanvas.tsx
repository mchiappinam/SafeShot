import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import type { CaptureState, HandlePosition, Rectangle, ScreenData, ToolType } from '../../shared/types';
import { COPY_REQUEST, OVERLAY_CLOSE, PRINT_REQUEST, SAVE_REQUEST } from '../../shared/ipc-channels';
import { RenderPipeline } from './render-pipeline';
import { CursorManager } from './cursor-manager';
import { SelectionManager } from '../selection/SelectionManager';
import { AnnotationEngine } from '../annotation/AnnotationEngine';
import { hitTest } from '../selection/resize-handles';
import { hitTestSelection } from '../selection/selection-math';

interface ElectronAPI {
  send: (channel: string, payload: unknown) => void;
  invoke: (channel: string, payload: unknown) => Promise<unknown>;
}
declare global { interface Window { electronAPI: ElectronAPI; } }

export interface OverlayCanvasProps {
  screens: ScreenData[];
  activeTool: ToolType | null;
  activeColor: string;
  onStateChange: (state: CaptureState) => void;
  onAnnotationsChange: (canUndo: boolean, canRedo: boolean) => void;
  onSelectionChange: (sel: { x: number; y: number; width: number; height: number } | null) => void;
}

/** Imperative methods exposed via ref (Fix 5) */
export interface OverlayCanvasHandle {
  undo: () => void;
  redo: () => void;
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

export const OverlayCanvas = forwardRef<OverlayCanvasHandle, OverlayCanvasProps>(({
  screens, activeTool, activeColor, onStateChange, onAnnotationsChange, onSelectionChange,
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

  useEffect(() => { annEngRef.current?.setTool(activeTool); }, [activeTool]);
  useEffect(() => { annEngRef.current?.setColor(activeColor); }, [activeColor]);
  useEffect(() => { onStateChange(captureState); }, [captureState, onStateChange]);

  const notifyAnnotations = useCallback(() => {
    const eng = annEngRef.current;
    onAnnotationsChange(eng?.canUndo() ?? false, eng?.canRedo() ?? false);
  }, [onAnnotationsChange]);

  // Fix 4: notify parent of selection changes
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
    pipeline.setAnnotations(annEng?.getAnnotations() ?? [], annEng?.getPreview() ?? null);
    pipeline.requestRender();
    notifySelection();
  }, [notifySelection]);

  // Fix 5: expose undo/redo via imperative handle
  useImperativeHandle(ref, () => ({
    undo: () => {
      annEngRef.current?.undo();
      notifyAnnotations();
      syncPipeline();
    },
    redo: () => {
      annEngRef.current?.redo();
      notifyAnnotations();
      syncPipeline();
    },
  }), [notifyAnnotations, syncPipeline]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pipeline = new RenderPipeline(canvas);
    pipelineRef.current = pipeline;
    pipeline.start();
    const cursor = new CursorManager(canvas);
    cursorRef.current = cursor;
    annEngRef.current = new AnnotationEngine();
    return () => {
      pipeline.stop();
      pipelineRef.current = null;
      cursor.destroy();
      cursorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!pipelineRef.current || screens.length === 0) return;
    const bounds = computeTotalBounds(screens);
    const canvas = canvasRef.current;
    if (canvas) { canvas.width = bounds.width; canvas.height = bounds.height; }
    selMgrRef.current = new SelectionManager(bounds);
    pipelineRef.current.setScreens(screens).catch(console.error);
  }, [screens]);

  const getCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
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

    if (e.button === 2) {
      if (state === 'capturing') window.electronAPI.send(OVERLAY_CLOSE, {});
      return;
    }

    if (state === 'capturing') {
      selMgr?.startSelection({ x, y });
      setCaptureState('selecting');
    } else if (state === 'area-finalized' && sel) {
      const handle = getHoveredHandle(x, y);
      if (handle) {
        selMgr?.startResize(handle);
        setCaptureState('resizing');
        syncPipeline();
        return;
      }
      const inside = hitTestSelection({ x, y }, sel);
      if (inside && activeToolRef.current !== null) {
        annEng?.startStroke({ x, y });
        setCaptureState('annotating');
      } else if (inside) {
        selMgr?.startMove({ x, y });
        setCaptureState('moving');
      } else {
        selMgr?.discardSelection();
        annEng?.clear();
        notifyAnnotations();
        selMgr?.startSelection({ x, y });
        setCaptureState('selecting');
      }
    }
    syncPipeline();
  }, [getCoords, getHoveredHandle, syncPipeline, notifyAnnotations]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCoords(e);
    const state = captureStateRef.current;
    const selMgr = selMgrRef.current;
    const annEng = annEngRef.current;

    if (state === 'selecting') selMgr?.updateSelection({ x, y });
    else if (state === 'resizing') selMgr?.updateResize({ x, y });
    else if (state === 'moving') selMgr?.updateMove({ x, y });
    else if (state === 'annotating') annEng?.updateStroke({ x, y });

    cursorRef.current?.update({
      captureState: state,
      selection: selMgr?.getSelection() ?? null,
      activeTool: activeToolRef.current,
      mouseX: x, mouseY: y,
      hoveredHandle: state === 'area-finalized' ? getHoveredHandle(x, y) : null,
      isOverToolbar: false,
    });
    syncPipeline();
  }, [getCoords, getHoveredHandle, syncPipeline]);

  // Fix 9: removed unused parameter name
  const handleMouseUp = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    const state = captureStateRef.current;
    const selMgr = selMgrRef.current;
    const annEng = annEngRef.current;

    if (state === 'selecting') {
      const sel = selMgr?.finalizeSelection();
      setCaptureState(sel ? 'area-finalized' : 'capturing');
    } else if (state === 'resizing') {
      selMgr?.finalizeResize();
      setCaptureState('area-finalized');
    } else if (state === 'moving') {
      selMgr?.finalizeMove();
      setCaptureState('area-finalized');
    } else if (state === 'annotating') {
      annEng?.finalizeStroke();
      notifyAnnotations();
      setCaptureState('area-finalized');
    }
    syncPipeline();
  }, [syncPipeline, notifyAnnotations]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const canvas = canvasRef.current;
    const annEng = annEngRef.current;

    if (e.key === 'Escape') {
      e.preventDefault();
      setCaptureState('idle');
      window.electronAPI.send(OVERLAY_CLOSE, {});
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || !canvas) return;

    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      annEng?.undo();
      notifyAnnotations();
      syncPipeline();
    } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
      e.preventDefault();
      annEng?.redo();
      notifyAnnotations();
      syncPipeline();
    } else if (e.key === 's') {
      e.preventDefault();
      setCaptureState('saving');
      // Fix 7: use invoke for handle-based IPC
      window.electronAPI.invoke(SAVE_REQUEST, { imageDataURL: canvas.toDataURL('image/png'), shiftHeld: e.shiftKey });
    } else if (e.key === 'c') {
      e.preventDefault();
      setCaptureState('copying');
      window.electronAPI.send(COPY_REQUEST, { imageDataURL: canvas.toDataURL('image/png') });
    } else if (e.key === 'p') {
      e.preventDefault();
      setCaptureState('printing');
      window.electronAPI.send(PRINT_REQUEST, { imageDataURL: canvas.toDataURL('image/png') });
    }
  }, [syncPipeline, notifyAnnotations]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault(); }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    />
  );
});

OverlayCanvas.displayName = 'OverlayCanvas';
export default OverlayCanvas;
