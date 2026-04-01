import React, { useState } from 'react';
import { PRESET_COLORS } from '../../shared/constants';

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedColor, onColorChange, onClose, position,
}) => {
  const [customColor, setCustomColor] = useState(selectedColor);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (/^#[0-9A-Fa-f]{6}$/.test(customColor)) {
      onColorChange(customColor);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        background: 'rgba(30,30,30,0.95)',
        borderRadius: 8,
        padding: 10,
        zIndex: 1001,
        cursor: 'default',
        minWidth: 160,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            title={color}
            onClick={() => { onColorChange(color); onClose(); }}
            style={{
              width: 24,
              height: 24,
              background: color,
              border: selectedColor === color ? '2px solid #fff' : '2px solid transparent',
              borderRadius: 4,
              cursor: 'pointer',
              padding: 0,
            }}
          />
        ))}
      </div>
      <form onSubmit={handleCustomSubmit} style={{ display: 'flex', gap: 4 }}>
        <input
          type="text"
          value={customColor}
          onChange={(e) => setCustomColor(e.target.value)}
          placeholder="#FF0000"
          maxLength={7}
          style={{
            flex: 1,
            background: '#222',
            color: '#fff',
            border: '1px solid #555',
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 12,
          }}
        />
        <button
          type="submit"
          style={{ background: '#555', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 12 }}
        >
          OK
        </button>
      </form>
      <button
        onClick={onClose}
        style={{ marginTop: 6, width: '100%', background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: 11 }}
      >
        Close
      </button>
    </div>
  );
};

export default ColorPicker;
