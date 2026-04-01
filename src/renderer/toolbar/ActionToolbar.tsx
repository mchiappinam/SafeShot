import React, { useCallback } from 'react';
import { COPY_REQUEST, OVERLAY_CLOSE, PRINT_REQUEST, SAVE_REQUEST } from '../../shared/ipc-channels';

interface ActionToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  getImageDataURL: () => string;
  position: { x: number; y: number };
}

function send(channel: string, payload: unknown): void {
  (window as Window & { electronAPI?: { send: (c: string, p: unknown) => void } }).electronAPI?.send(channel, payload);
}
function invoke(channel: string, payload: unknown): void {
  (window as Window & { electronAPI?: { invoke: (c: string, p: unknown) => Promise<unknown> } }).electronAPI?.invoke(channel, payload);
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  canUndo, canRedo, onUndo, onRedo, getImageDataURL, position,
}) => {
  const handleCancel = useCallback(() => send(OVERLAY_CLOSE, {}), []);
  const handleSave = useCallback((shiftHeld = false) => {
    invoke(SAVE_REQUEST, { imageDataURL: getImageDataURL(), shiftHeld });
  }, [getImageDataURL]);
  const handleCopy = useCallback(() => {
    send(COPY_REQUEST, { imageDataURL: getImageDataURL() });
  }, [getImageDataURL]);
  const handlePrint = useCallback(() => {
    send(PRINT_REQUEST, { imageDataURL: getImageDataURL() });
  }, [getImageDataURL]);

  const btnStyle = (disabled = false): React.CSSProperties => ({
    padding: '4px 10px',
    background: disabled ? 'rgba(80,80,80,0.5)' : 'rgba(60,60,60,0.9)',
    color: disabled ? '#666' : '#fff',
    border: '1px solid #555',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
    whiteSpace: 'nowrap',
  });

  return (
    <div
      style={{
        position: 'fixed', left: position.x, top: position.y,
        display: 'flex', flexDirection: 'row', gap: 4,
        background: 'rgba(30,30,30,0.92)', borderRadius: 8, padding: 6,
        zIndex: 1000, cursor: 'default',
      }}
    >
      <button style={btnStyle()} onClick={handleCancel} title="Cancel (ESC)">✕ Cancel</button>
      <button style={btnStyle(!canUndo)} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">↩ Undo</button>
      <button style={btnStyle(!canRedo)} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">↪ Redo</button>
      <button style={btnStyle()} onClick={handlePrint} title="Print (Ctrl+P)">🖨 Print</button>
      <button style={btnStyle()} onClick={handleCopy} title="Copy (Ctrl+C)">📋 Copy</button>
      <button style={btnStyle()} onClick={() => handleSave(false)} title="Save (Ctrl+S)">💾 Save</button>
    </div>
  );
};

export default ActionToolbar;
