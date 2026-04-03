import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import type { CaptureState, HandlePosition, Rectangle, ScreenData, ToolType } from '../../shared/types';
import { RenderPipeline } from './render-pipeline';
import { CursorManager } from './cursor-manager';
import { SelectionManager } from '../selection/SelectionManager';
import { AnnotationEngine } from '../annotation/AnnotationEngine';
import { hitTest } from '../selection/resize-handles';
import { hitTestSelection } from '../selection/selection-math';

export interface OverlayCanvasProps {
  screens: ScreenData[];
  activeTool: ToolType | null;
  activeColor: string;
  onStateChange: (state: CaptureState) => void;
  onAnnotationsChange: (canUndo: boolean, canRedo: boolean) => void;
  onSelectionChange: (sel: { x: number; y: number; width: number; height: number } | null) => void;
  onClose: () => void;
  onSave: (dataURL: string, shiftHeld: boolean) => void;
  onCopy: (dataURL: string) => void;
}

export interface OverlayCanvasHandle {
  undo: () => void;
  redo: () => void;
  getSelectionDataURL: () => string | null;
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
  onClose, onSave, onCopy,
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

  useImperativeHandle(ref, () => ({
    undo: () => { annEngRef.current?.undo(); notifyAnnotations(); syncPipeline(); },
    redo: () => { annEngRef.current?.redo(); notifyAnnotations(); syncPipeline(); },
    getSelectionDataURL,
  }), [notifyAnnotations, syncPipeline, getSelectionDataURL]);

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
      // Match canvas pixels to window CSS pixels to avoid coordinate mismatch
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    selMgrRef.current = new SelectionManager({ x: 0, y: 0, width: window.innerWidth, height: window.innerHeight });
    pipelineRef.current.setScreens(screens).then(() => {
      pipelineRef.current?.requestRender();
    }).catch(console.error);
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

    if (e.button === 2) { if (state === 'capturing') onClose(); return; }

    if (state === 'capturing') {
      selMgr?.startSelection({ x, y }); setCaptureState('selecting');
    } else if (state === 'area-finalized' && sel) {
      const handle = getHoveredHandle(x, y);
      if (handle) { selMgr?.startResize(handle); setCaptureState('resizing'); syncPipeline(); return; }
      const inside = hitTestSelection({ x, y }, sel);
      if (inside && activeToolRef.current !== null) { annEng?.startStroke({ x, y }); setCaptureState('annotating'); }
      else if (inside) { selMgr?.startMove({ x, y }); setCaptureState('moving'); }
      else { selMgr?.discardSelection(); annEng?.clear(); notifyAnnotations(); selMgr?.startSelection({ x, y }); setCaptureState('selecting'); }
    }
    syncPipeline();
  }, [getCoords, getHoveredHandle, syncPipeline, notifyAnnotations, onClose]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCoords(e);
    const state = captureStateRef.current;
    if (state === 'selecting') selMgrRef.current?.updateSelection({ x, y });
    else if (state === 'resizing') selMgrRef.current?.updateResize({ x, y });
    else if (state === 'moving') selMgrRef.current?.updateMove({ x, y });
    else if (state === 'annotating') annEngRef.current?.updateStroke({ x, y });
    cursorRef.current?.update({
      captureState: state, selection: selMgrRef.current?.getSelection() ?? null,
      activeTool: activeToolRef.current, mouseX: x, mouseY: y,
      hoveredHandle: state === 'area-finalized' ? getHoveredHandle(x, y) : null, isOverToolbar: false,
    });
    syncPipeline();
  }, [getCoords, getHoveredHandle, syncPipeline]);

  const handleMouseUp = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    const state = captureStateRef.current;
    if (state === 'selecting') { const sel = selMgrRef.current?.finalizeSelection(); setCaptureState(sel ? 'area-finalized' : 'capturing'); }
    else if (state === 'resizing') { selMgrRef.current?.finalizeResize(); setCaptureState('area-finalized'); }
    else if (state === 'moving') { selMgrRef.current?.finalizeMove(); setCaptureState('area-finalized'); }
    else if (state === 'annotating') { annEngRef.current?.finalizeStroke(); notifyAnnotations(); setCaptureState('area-finalized'); }
    syncPipeline();
  }, [syncPipeline, notifyAnnotations]);

  // Export only the selected region (frozen screen + annotations, no dim mask)
  const getSelectionDataURL = useCallback((): string | null => {
    const canvas = canvasRef.current;
    const pipeline = pipelineRef.current;
    const sel = selMgrRef.current?.getSelection();
    if (!canvas || !pipeline || !sel) return null;

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = Math.round(sel.width);
    exportCanvas.height = Math.round(sel.height);
    const ectx = exportCanvas.getContext('2d');
    if (!ectx) return null;

    // Draw the portion of the main canvas that's inside the selection
    // But the main canvas has the dim overlay — we need to draw from the bitmaps directly
    // For simplicity, draw from the main canvas selection area (which is unmasked)
    ectx.drawImage(canvas, sel.x, sel.y, sel.width, sel.height, 0, 0, sel.width, sel.height);

    return exportCanvas.toDataURL('image/png');
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const canvas = canvasRef.current;
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || !canvas) return;
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); annEngRef.current?.undo(); notifyAnnotations(); syncPipeline(); }
    else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); annEngRef.current?.redo(); notifyAnnotations(); syncPipeline(); }
    else if (e.key === 's') { e.preventDefault(); const d = getSelectionDataURL(); if (d) onSave(d, e.shiftKey); }
    else if (e.key === 'c') { e.preventDefault(); const d = getSelectionDataURL(); if (d) onCopy(d); }
    else if (e.key === 'a') { e.preventDefault(); /* Ctrl+A: select entire screen */
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

  return (
    <canvas ref={canvasRef}
      style={{ display: 'block', position: 'fixed', top: 0, left: 0, width: '100%', height: '100%' }}
      onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()} />
  );
});

OverlayCanvas.displayName = 'OverlayCanvas';
export default OverlayCanvas;
