import React, { useEffect } from 'react';
import './about.css';

interface AboutDialogProps {
  version: string;
  onClose: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ version, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="about-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="About SafeShot">
      <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="about-dialog__close" onClick={onClose} aria-label="Close dialog">✕</button>
        <div className="about-dialog__logo" aria-hidden="true">🛡️</div>
        <h1 className="about-dialog__title">SafeShot</h1>
        <p className="about-dialog__version">v{version}</p>
        <div className="about-dialog__divider" />
        <p className="about-dialog__mission">
          Privacy-first screenshot tool. Your screenshots stay yours, always.
          No cloud, no tracking, no compromises.
        </p>
        <div className="about-dialog__features">
          <div className="about-dialog__feature">
            <div className="about-dialog__feature-icon">🔒</div>
            <span className="about-dialog__feature-label">Private</span>
          </div>
          <div className="about-dialog__feature">
            <div className="about-dialog__feature-icon">⚡</div>
            <span className="about-dialog__feature-label">Fast</span>
          </div>
          <div className="about-dialog__feature">
            <div className="about-dialog__feature-icon">🎨</div>
            <span className="about-dialog__feature-label">Annotate</span>
          </div>
          <div className="about-dialog__feature">
            <div className="about-dialog__feature-icon">💻</div>
            <span className="about-dialog__feature-label">Local</span>
          </div>
        </div>
        <p className="about-dialog__credit">
          Developed by{' '}
          <a href="https://chiappina.com" target="_blank" rel="noopener noreferrer">
            Matheus Chiappina
          </a>
        </p>
        <p className="about-dialog__url">chiappina.com</p>
      </div>
    </div>
  );
};

export default AboutDialog;
