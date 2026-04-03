import React from 'react';

interface ActionToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onCopy: () => void;
  onCancel: () => void;
  position: { x: number; y: number };
}

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  canUndo, canRedo, onUndo, onRedo, onSave, onCopy, onCancel, position,
}) => {
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
    <div style={{
      position: 'fixed', left: position.x, top: position.y,
      display: 'flex', flexDirection: 'row', gap: 4,
      background: 'rgba(30,30,30,0.92)', borderRadius: 8, padding: 6,
      zIndex: 1000, cursor: 'default',
    }}>
      <button style={btnStyle()} onClick={onCancel} title="Cancel (ESC)">✕ Cancel</button>
      <button style={btnStyle(!canUndo)} onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">↩ Undo</button>
      <button style={btnStyle(!canRedo)} onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">↪ Redo</button>
      <button style={btnStyle()} onClick={onCopy} title="Copy (Ctrl+C)">📋 Copy</button>
      <button style={btnStyle()} onClick={onSave} title="Save (Ctrl+S)">💾 Save</button>
    </div>
  );
};

export default ActionToolbar;
