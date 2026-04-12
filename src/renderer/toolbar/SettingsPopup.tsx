import React from 'react';
import type { FillMode } from '../../shared/types';

interface SettingsPopupProps {
  strokeWidth: number;
  fillMode: FillMode;
  onStrokeWidthChange: (value: number) => void;
  onFillModeChange: (mode: FillMode) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

const FILL_MODES: { mode: FillMode; icon: string; label: string }[] = [
  { mode: 'hollow', icon: '◻', label: 'Hollow' },
  { mode: 'solid',  icon: '◼', label: 'Solid' },
  { mode: 'blur',   icon: '▦', label: 'Blur' },
  { mode: 'redact', icon: '▬', label: 'Redact' },
];

export const SettingsPopup: React.FC<SettingsPopupProps> = ({
  strokeWidth, fillMode, onStrokeWidthChange, onFillModeChange, onClose, position,
}) => {
  const pickerWidth = 180;
  const pickerHeight = 130;
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
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Thickness</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <input type="range" min={1} max={20} value={strokeWidth}
          onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: '#2AE3FF' }} />
        <span style={{ color: '#fff', fontSize: 11, minWidth: 28, textAlign: 'right' }}>{strokeWidth}px</span>
      </div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Fill Mode</div>
      <div style={{ display: 'flex', gap: 4 }}>
        {FILL_MODES.map(({ mode, icon, label }) => (
          <div key={mode} style={{ position: 'relative' }} className="tooltip-wrap">
            <button
              onClick={() => onFillModeChange(mode)}
              style={{
                width: 38, height: 32,
                border: fillMode === mode ? '2px solid #2AE3FF' : '1px solid #555',
                borderRadius: 0,
                background: fillMode === mode ? 'rgba(42,227,255,0.15)' : 'rgba(60,60,60,0.9)',
                color: '#fff', fontSize: 14, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {icon}
            </button>
            <span className="tooltip-text">{label}</span>
          </div>
        ))}
      </div>
      <button onClick={onClose}
        style={{ marginTop: 8, width: '100%', background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: 11 }}>
        Close
      </button>
    </div>
  );
};

export default SettingsPopup;
