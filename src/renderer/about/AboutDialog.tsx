import React, { useEffect } from 'react';
import './about.css';

interface AboutDialogProps {
  version: string;
  onClose: () => void;
}

const MISSION =
  'Built to make your work life easier and safer. Your screenshots stay yours, always. ' +
  'No cloud, no tracking, no compromises. Just you and your screen, 100% private.';

const DEV_URL = 'https://chiappina.com';

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
        <div className="about-dialog__logo" aria-hidden="true">📸</div>
        <h1 className="about-dialog__title">SafeShot</h1>
        <p className="about-dialog__version">Version {version}</p>
        <p className="about-dialog__mission">{MISSION}</p>
        <p className="about-dialog__credit">
          Developed with ❤️ by{' '}
          <a href={DEV_URL} target="_blank" rel="noopener noreferrer">
            Matheus Chiappina
          </a>
        </p>
      </div>
    </div>
  );
};

export default AboutDialog;
