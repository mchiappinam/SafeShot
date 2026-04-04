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
  const pickerWidth = 160;
  const pickerHeight = 80;
  const x = Math.max(0, Math.min(position.x, window.innerWidth - pickerWidth));
  const y = Math.max(0, Math.min(position.y, window.innerHeight - pickerHeight));

  return (
    <div
      style={{
        position: 'fixed', left: x, top: y,
        background: 'rgba(30,30,30,0.95)', borderRadius: 0,
        padding: 10, zIndex: 1001, cursor: 'default', width: pickerWidth,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input type="range" min={1} max={20} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#fff' }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
        <div style={{ width: Math.min(value, 20), height: Math.min(value, 20), borderRadius: '50%', background: '#fff' }} />
        <span style={{ color: '#fff', fontSize: 12 }}>{value}px</span>
      </div>
      <button onClick={onClose}
        style={{ marginTop: 6, width: '100%', background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: 11 }}>
        Close
      </button>
    </div>
  );
};

export default ThicknessPicker;
