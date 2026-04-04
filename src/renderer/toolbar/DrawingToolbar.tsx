import React from 'react';
import type { ToolType } from '../../shared/types';

interface DrawingToolbarProps {
  activeTool: ToolType | null;
  onToolSelect: (tool: ToolType | null) => void;
  onColorPickerOpen: () => void;
  onThicknessOpen: () => void;
  activeColor: string;
  strokeWidth: number;
  solid: boolean;
  onSolidToggle: () => void;
  position: { x: number; y: number };
}

const TOOLS: { id: ToolType; label: string; tooltip: string; fontSize?: number }[] = [
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
  activeTool, onToolSelect, onColorPickerOpen, onThicknessOpen, activeColor, strokeWidth, solid, onSolidToggle, position,
}) => {
  const handleToolClick = (tool: ToolType) => {
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
        <div key={id} style={{ position: 'relative' }} className="tooltip-wrap">
          <button onClick={() => handleToolClick(id)}
            style={{ ...btnStyle(activeTool === id), fontSize: fontSize ?? 16 }}>
            {label}
          </button>
          <span className="tooltip-text">{tooltip}</span>
        </div>
      ))}
      <div style={{ position: 'relative' }} className="tooltip-wrap">
        <button onClick={onSolidToggle}
          style={{ ...btnStyle(false), border: '2px solid #fff' }}>
          {solid ? '◼' : '◻'}
        </button>
        <span className="tooltip-text">{solid ? 'Solid (click for hollow)' : 'Hollow (click for solid)'}</span>
      </div>
      <div style={{ position: 'relative' }} className="tooltip-wrap">
        <button onClick={onColorPickerOpen}
          style={{ width: 32, height: 32, border: '2px solid #fff', borderRadius: 0, background: activeColor, cursor: 'pointer' }}
        />
        <span className="tooltip-text">Color</span>
      </div>
      <div style={{ position: 'relative' }} className="tooltip-wrap">
        <button onClick={onThicknessOpen}
          style={{ width: 32, height: 32, border: '2px solid #fff', borderRadius: 0, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: Math.min(strokeWidth, 20), height: Math.min(strokeWidth, 20), borderRadius: '50%', background: '#fff' }} />
        </button>
        <span className="tooltip-text">Thickness</span>
      </div>
    </div>
  );
};

export default DrawingToolbar;
