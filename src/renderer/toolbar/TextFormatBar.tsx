import React from 'react';

interface TextFormatBarProps {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  highlight: boolean;
  size: number;
  onBoldToggle: () => void;
  onItalicToggle: () => void;
  onUnderlineToggle: () => void;
  onHighlightToggle: () => void;
  onSizeChange: (size: number) => void;
  position: { x: number; y: number };
}

export const TextFormatBar: React.FC<TextFormatBarProps> = ({
  bold, italic, underline, highlight, size,
  onBoldToggle, onItalicToggle, onUnderlineToggle, onHighlightToggle, onSizeChange,
  position,
}) => {
  const pickerWidth = 200;
  const pickerHeight = 80;
  const x = Math.max(0, Math.min(position.x, window.innerWidth - pickerWidth));
  const y = Math.max(0, Math.min(position.y, window.innerHeight - pickerHeight));

  const btn = (active: boolean): React.CSSProperties => ({
    width: 28, height: 28,
    border: active ? '2px solid #2AE3FF' : '1px solid #555',
    borderRadius: 0,
    background: active ? 'rgba(42,227,255,0.15)' : 'rgba(60,60,60,0.9)',
    color: '#fff', fontSize: 13, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  });

  return (
    <div style={{
      position: 'fixed', left: x, top: y,
      background: 'rgba(30,30,30,0.95)', borderRadius: 0, padding: 8,
      zIndex: 1001, cursor: 'default', width: pickerWidth,
      display: 'flex', flexDirection: 'column', gap: 6,
    }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', gap: 4 }}>
        <button style={btn(bold)} onClick={onBoldToggle}><strong>B</strong></button>
        <button style={btn(italic)} onClick={onItalicToggle}><em>I</em></button>
        <button style={{ ...btn(underline), textDecoration: 'underline' }} onClick={onUnderlineToggle}>U</button>
        <button style={btn(highlight)} onClick={onHighlightToggle}>🖍</button>
        <input type="range" min={10} max={48} value={size} onChange={(e) => onSizeChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: '#2AE3FF' }} />
        <span style={{ color: '#fff', fontSize: 11, minWidth: 28, textAlign: 'right' }}>{size}</span>
      </div>
    </div>
  );
};

export default TextFormatBar;
