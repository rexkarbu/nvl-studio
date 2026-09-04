import React, { useState } from 'react';

interface BroadcastPanelProps {
  serverPort: number | null;
  projectId: string;
}

export const BroadcastPanel: React.FC<BroadcastPanelProps> = ({ serverPort, projectId }) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [bgMode, setBgMode] = useState<'transparent' | 'green'>('transparent');

  // Always target the dedicated NVL Local Server (port 17777 or resolved serverPort)
  const port = serverPort || 17777;
  const targetUrl = `http://127.0.0.1:${port}/live/${projectId}${bgMode === 'green' ? '?bg=green' : ''}`;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy
      const input = document.createElement('input');
      input.value = targetUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenBrowser = () => {
    window.open(targetUrl, '_blank');
  };

  return (
    <section className="broadcast-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="panel-title">OBS Browser Source Broadcast</span>
          <span className="status-badge-live">Modul 3: Live Output</span>
        </div>

        <div className="bg-toggle-group">
          <button
            className={`toggle-btn ${bgMode === 'transparent' ? 'active' : ''}`}
            onClick={() => setBgMode('transparent')}
            title="Transparent (Alpha Channel)"
          >
            Transparent
          </button>
          <button
            className={`toggle-btn ${bgMode === 'green' ? 'active' : ''}`}
            onClick={() => setBgMode('green')}
            title="Chroma Green Screen"
          >
            Green Screen
          </button>
        </div>
      </div>

      <div className="broadcast-content">
        <div className="url-display-card">
          <label className="url-label">Browser Source URL</label>
          <div className="url-input-row">
            <input
              type="text"
              readOnly
              value={targetUrl}
              className="url-input-field"
            />
            <button
              className={`copy-btn ${copied ? 'copied' : ''}`}
              onClick={handleCopyUrl}
            >
              {copied ? '✓ Copied!' : '📋 Copy URL'}
            </button>
            <button
              className="open-btn"
              onClick={handleOpenBrowser}
              title="Open in new browser tab to inspect transparency"
            >
              ↗ Test in Browser
            </button>
          </div>
          <p className="url-hint">
            Target: <code>127.0.0.1:{port}</code> (Local only, 0% cloud dependency, 100% transparent background)
          </p>
        </div>

        {/* OBS Setup Checklist */}
        <div className="obs-guide-card">
          <h4 className="guide-title">OBS Studio Setup Instructions</h4>
          <ol className="guide-steps">
            <li>
              Buka <strong>OBS Studio</strong> &rarr; Tambahkan Source baru (ikon <code>+</code>) &rarr; Pilih <strong>Browser</strong>.
            </li>
            <li>
              Beri nama (misal: <em>NVL Avatar</em>) &rarr; Klik OK.
            </li>
            <li>
              Paste URL di atas ke kolom <strong>URL</strong>.
            </li>
            <li>
              Set <strong>Width: 1920</strong> dan <strong>Height: 1080</strong>.
            </li>
            <li>
              Klik <strong>OK</strong>. Avatar akan langsung muncul di atas gameplay/camera dengan transparansi sempurna!
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
};
