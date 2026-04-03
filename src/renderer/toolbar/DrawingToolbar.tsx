import React from 'react';
import type { ToolType } from '../../shared/types';

interface DrawingToolbarProps {
  activeTool: ToolType | null;
  onToolSelect: (tool: ToolType | null) => void;
  onColorPickerOpen: () => void;
  activeColor: string;
  position: { x: number; y: number };
}

const TOOLS: { id: ToolType; label: string; tooltip: string }[] = [
  { id: 'pencil',   label: '✏️', tooltip: 'Pencil' },
  { id: 'line',     label: '╱',  tooltip: 'Line' },
  { id: 'arrow',    label: '➜',  tooltip: 'Arrow' },
  { id: 'sharpie',  label: '🖊', tooltip: 'Sharpie' },
  { id: 'circle',   label: '○',  tooltip: 'Circle' },
  { id: 'triangle', label: '△',  tooltip: 'Triangle' },
  { id: 'octagon',  label: '⬡',  tooltip: 'Octagon' },
];

export const DrawingToolbar: React.FC<DrawingToolbarProps> = ({
  activeTool, onToolSelect, onColorPickerOpen, activeColor, position,
}) => {
  const handleToolClick = (tool: ToolType) => {
    onToolSelect(activeTool === tool ? null : tool);
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        background: 'rgba(30,30,30,0.92)',
        borderRadius: 8,
        padding: 6,
        zIndex: 1000,
        cursor: 'default',
      }}
    >
      {TOOLS.map(({ id, label, tooltip }) => (
        <div key={id} style={{ position: 'relative' }} className="tooltip-wrap">
          <button
            onClick={() => handleToolClick(id)}
            style={{
              width: 32,
              height: 32,
              border: activeTool === id ? '2px solid #fff' : '2px solid transparent',
              borderRadius: 4,
              background: activeTool === id ? 'rgba(255,255,255,0.2)' : 'transparent',
              color: '#fff',
              fontSize: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {label}
          </button>
          <span className="tooltip-text">{tooltip}</span>
        </div>
      ))}
      <div style={{ position: 'relative' }} className="tooltip-wrap">
        <button
          onClick={onColorPickerOpen}
          style={{
            width: 32,
            height: 32,
            border: '2px solid #fff',
            borderRadius: 4,
            background: activeColor,
            cursor: 'pointer',
          }}
        />
        <span className="tooltip-text">Color Picker</span>
      </div>
    </div>
  );
};

export default DrawingToolbar;
