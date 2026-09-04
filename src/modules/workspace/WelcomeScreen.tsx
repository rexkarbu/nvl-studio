import React from 'react';

export interface WelcomeScreenProps {
  onNewProject: () => void;
  onOpenProject: () => void;
  onLoadSample: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onNewProject,
  onOpenProject,
  onLoadSample,
}) => {
  return (
    <div className="welcome-screen-container" data-testid="welcome-screen">
      <div className="welcome-screen-card">
        <div className="welcome-header">
          <div className="welcome-logo-badge">NVL</div>
          <h1 className="welcome-title">NVL PNGtuber Studio</h1>
          <p className="welcome-subtitle">
            Lightweight, zero-cloud desktop avatar creator and live broadcast studio.
            Stream transparent animated avatars directly to OBS Studio with native 60 FPS performance.
          </p>
        </div>

        <div className="welcome-actions-grid">
          <button
            className="welcome-action-card primary"
            onClick={onNewProject}
            data-testid="welcome-new-btn"
          >
            <span className="action-card-icon">✨</span>
            <div className="action-card-text">
              <span className="action-card-title">Create New Project</span>
              <span className="action-card-desc">Start fresh with your own transparent PNG layers</span>
            </div>
          </button>

          <button
            className="welcome-action-card"
            onClick={onOpenProject}
            data-testid="welcome-open-btn"
          >
            <span className="action-card-icon">📂</span>
            <div className="action-card-text">
              <span className="action-card-title">Open Existing Project</span>
              <span className="action-card-desc">Load an existing project.nvl file from disk</span>
            </div>
          </button>

          <button
            className="welcome-action-card secondary"
            onClick={onLoadSample}
            data-testid="welcome-sample-btn"
          >
            <span className="action-card-icon">🐱</span>
            <div className="action-card-text">
              <span className="action-card-title">Open Sample Avatar</span>
              <span className="action-card-desc">Try out the Chibi Cat rig with idle bobbing and voice detection</span>
            </div>
          </button>
        </div>

        <div className="welcome-features-footer">
          <div className="feature-pill">🔒 100% Offline & Private</div>
          <div className="feature-pill">⚡ 60 FPS Canvas 2D</div>
          <div className="feature-pill">🎙️ Hardware Auto-Calibrated VAD</div>
          <div className="feature-pill">📡 OBS Browser Source Sync</div>
        </div>
      </div>
    </div>
  );
};
