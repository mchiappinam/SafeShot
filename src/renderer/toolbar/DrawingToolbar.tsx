import React from 'react';
import type { FillMode, ToolType } from '../../shared/types';

interface DrawingToolbarProps {
  activeTool: ToolType | null;
  onToolSelect: (tool: ToolType | null) => void;
  onColorPickerOpen: () => void;
  onSettingsOpen: () => void;
  activeColor: string;
  fillMode: FillMode;
  position: { x: number; y: number };
}

const SHAPE_TOOLS = new Set<ToolType>(['square', 'circle', 'triangle', 'octagon']);
const FILL_LABELS: Record<FillMode, string> = { hollow: 'Hollow', solid: 'Solid', blur: 'Blur', redact: 'Redact' };

const TOOLS: { id: ToolType | null; label: string; tooltip: string; fontSize?: number }[] = [
  { id: null,        label: '✥',  tooltip: 'Move Selection' },
  { id: 'hand',      label: '✋', tooltip: 'Move Objects' },
  { id: 'eyedropper',label: '💧', tooltip: 'Pick Color' },
  { id: 'pencil',   label: '🖊', tooltip: 'Sharpie' },
  { id: 'sharpie',  label: '🖍️', tooltip: 'Highlighter' },
  { id: 'line',     label: '╱',  tooltip: 'Line' },
  { id: 'arrow',    label: '➜',  tooltip: 'Arrow' },
  { id: 'square',   label: '▢',  tooltip: 'Rectangle' },
  { id: 'circle',   label: '○',  tooltip: 'Circle', fontSize: 22 },
  { id: 'triangle', label: '△',  tooltip: 'Triangle' },
  { id: 'octagon',  label: '⬡',  tooltip: 'Octagon' },
  { id: 'text',     label: 'T',  tooltip: 'Text' },
];

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  activeTool, onToolSelect, onColorPickerOpen, onSettingsOpen, activeColor, fillMode, position,
}) => {
  const handleToolClick = (tool: ToolType | null) => {
    if (tool === null) { onToolSelect(null); return; }
    onToolSelect(activeTool === tool ? null : tool);
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    width: 32,
    height: 32,
    border: active ? '2px solid #fff' : '2px solid transparent',
    borderRadius: 0,
    background: active ? 'rgba(255,255,255,0.2)' : 'transparent',
    color: '#fff',
    fontSize: 16,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        display: 'grid',
        gridTemplateColumns: '32px 32px',
        gap: 4,
        background: 'rgba(30,30,30,0.92)',
        borderRadius: 0,
        padding: 6,
        zIndex: 1000,
        cursor: 'default',
      }}
    >
      {TOOLS.map(({ id, label, tooltip, fontSize }) => (
        <div key={id ?? '_move'} style={{ position: 'relative' }} className="tooltip-wrap">
          <button onClick={() => handleToolClick(id)}
            style={{ ...btnStyle(id === null ? activeTool === null : activeTool === id), fontSize: fontSize ?? 16 }}>
            {label}
          </button>
          <span className="tooltip-text">{id !== null && SHAPE_TOOLS.has(id) ? `${tooltip} (${FILL_LABELS[fillMode]} ⚙)` : tooltip}</span>
        </div>
      ))}
      <div style={{ position: 'relative' }} className="tooltip-wrap">
        <button onClick={onColorPickerOpen}
          style={{ width: 32, height: 32, border: '2px solid #fff', borderRadius: 0, background: activeColor, cursor: 'pointer' }}
        />
        <span className="tooltip-text">Color</span>
      </div>
      <div style={{ position: 'relative' }} className="tooltip-wrap">
        <button onClick={onSettingsOpen}
          style={{ ...btnStyle(false), border: '2px solid #fff', fontSize: 18 }}>
          ⚙
        </button>
        <span className="tooltip-text">Settings</span>
      </div>
    </div>
  );
};

export default DrawingToolbar;
