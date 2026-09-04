import React from 'react';

interface TopMenuBarProps {
  projectName: string;
  isDirty: boolean;
  missingAssetsCount?: number;
  serverPort: number | null;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSaveProject: () => void;
  onSaveProjectAs: () => void;
}

export const TopMenuBar: React.FC<TopMenuBarProps> = ({
  projectName,
  isDirty,
  missingAssetsCount = 0,
  serverPort,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
}) => {
  return (
    <header className="top-menu-bar">
      <div className="brand-group">
        <div className="brand-badge">NVL</div>
        <span className="brand-title">PNGtuber Studio</span>
        <span className={`project-title-chip ${isDirty ? 'dirty' : ''}`}>
          {projectName}
          {isDirty ? ' •' : ''}
        </span>
        {missingAssetsCount > 0 && (
          <span className="warning-badge-pill" title="Some assets could not be loaded">
            ⚠️ {missingAssetsCount} Missing
          </span>
        )}
      </div>

      <div className="menu-actions">
        <button className="menu-btn" onClick={onNewProject} title="Create New Character Project">
          <span className="btn-icon">✨</span> New
        </button>
        <button className="menu-btn" onClick={onOpenProject} title="Open project.nvl">
          <span className="btn-icon">📂</span> Open
        </button>
        <button
          className={`menu-btn ${isDirty ? 'menu-btn-highlight' : ''}`}
          onClick={onSaveProject}
          title="Save Project (Ctrl+S)"
        >
          <span className="btn-icon">💾</span> Save
        </button>
        <button className="menu-btn" onClick={onSaveProjectAs} title="Save Project As...">
          Save As...
        </button>
      </div>

      <div className="server-status-pill">
        <span className={`status-indicator-dot ${serverPort ? 'online' : 'offline'}`} />
        <span className="status-text">
          {serverPort ? `Local Server: 127.0.0.1:${serverPort}` : 'Server Starting...'}
        </span>
      </div>
    </header>
  );
};
