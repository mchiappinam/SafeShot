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

const TooltipButton: React.FC<{
  label: string;
  tooltip: string;
  disabled?: boolean;
  onClick: () => void;
  style: React.CSSProperties;
}> = ({ label, tooltip, disabled, onClick, style }) => (
  <div style={{ position: 'relative', display: 'inline-block' }} className="tooltip-wrap">
    <button style={style} onClick={onClick} disabled={disabled}>{label}</button>
    <span className="tooltip-text">{tooltip}</span>
  </div>
);

export const ActionToolbar: React.FC<ActionToolbarProps> = ({
  canUndo, canRedo, onUndo, onRedo, onSave, onCopy, onCancel, position,
}) => {
  const btnStyle = (disabled = false): React.CSSProperties => ({
    padding: '4px 10px',
    background: disabled ? 'rgba(80,80,80,0.5)' : 'rgba(60,60,60,0.9)',
    color: disabled ? '#666' : '#fff',
    border: '1px solid #555',
    borderRadius: 0,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{
      position: 'fixed', left: position.x, top: position.y,
      display: 'flex', flexDirection: 'row', gap: 4,
      background: 'rgba(30,30,30,0.92)', borderRadius: 0, padding: 6,
      zIndex: 1000, cursor: 'default',
    }}>
      <TooltipButton label="✕" tooltip="Cancel (ESC)" onClick={onCancel} style={btnStyle()} />
      <TooltipButton label="↩" tooltip="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo} style={btnStyle(!canUndo)} />
      <TooltipButton label="↪" tooltip="Redo (Ctrl+Y)" disabled={!canRedo} onClick={onRedo} style={btnStyle(!canRedo)} />
      <TooltipButton label="📋" tooltip="Copy (Ctrl+C)" onClick={onCopy} style={btnStyle()} />
      <TooltipButton label="💾" tooltip="Save (Ctrl+S)" onClick={onSave} style={btnStyle()} />
    </div>
  );
};

export default ActionToolbar;
