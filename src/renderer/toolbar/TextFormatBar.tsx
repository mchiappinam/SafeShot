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
  const pickerWidth = 240;
  const pickerHeight = 44;
  const x = Math.max(0, Math.min(position.x, window.innerWidth - pickerWidth));
  const y = Math.max(0, Math.min(position.y, window.innerHeight - pickerHeight));

  const btn = (active: boolean): React.CSSProperties => ({
    width: 32, height: 32,
    border: active ? '2px solid #2AE3FF' : '1px solid #555',
    borderRadius: 0,
    background: active ? 'rgba(42,227,255,0.15)' : 'rgba(60,60,60,0.9)',
    color: '#fff', fontSize: 14, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'sans-serif',
  });

  return (
    <div style={{
      position: 'fixed', left: x, top: y,
      background: 'rgba(30,30,30,0.95)', borderRadius: 0, padding: 6,
      zIndex: 1001, cursor: 'default',
      display: 'flex', gap: 4, alignItems: 'center',
    }} onClick={(e) => e.stopPropagation()}>
      <button style={{ ...btn(bold), fontWeight: 'bold' }} onClick={onBoldToggle}>B</button>
      <button style={{ ...btn(italic), fontStyle: 'italic' }} onClick={onItalicToggle}>I</button>
      <button style={{ ...btn(underline), textDecoration: 'underline' }} onClick={onUnderlineToggle}>U</button>
      <button style={btn(highlight)} onClick={onHighlightToggle}>🖍</button>
      <input type="range" min={10} max={48} value={size} onChange={(e) => onSizeChange(Number(e.target.value))}
        style={{ width: 80, accentColor: '#2AE3FF' }} />
      <span style={{ color: '#fff', fontSize: 11, minWidth: 24, textAlign: 'right' }}>{size}</span>
    </div>
  );
};

export default TextFormatBar;
