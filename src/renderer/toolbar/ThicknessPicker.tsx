import React from 'react';

interface ThicknessPickerProps {
  value: number;
  onChange: (value: number) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

export const ThicknessPicker: React.FC<ThicknessPickerProps> = ({
  value, onChange, onClose, position,
}) => {
  // Clamp position to stay within screen bounds
  const pickerWidth = 160;
  const pickerHeight = 60;
  const x = Math.max(0, Math.min(position.x, window.innerWidth - pickerWidth));
  const y = Math.max(0, Math.min(position.y, window.innerHeight - pickerHeight));

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: 'rgba(30,30,30,0.95)',
        borderRadius: 8,
        padding: 10,
        zIndex: 1001,
        cursor: 'default',
        width: pickerWidth,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <input
          type="range"
          min={1}
          max={20}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: '#fff' }}
        />
        <span style={{ color: '#fff', fontSize: 12, minWidth: 20, textAlign: 'right' }}>{value}px</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: Math.min(value, 20),
          height: Math.min(value, 20),
          borderRadius: '50%',
          background: '#fff',
        }} />
      </div>
      <button
        onClick={onClose}
        style={{ marginTop: 6, width: '100%', background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: 11 }}
      >
        Close
      </button>
    </div>
  );
};

export default ThicknessPicker;
