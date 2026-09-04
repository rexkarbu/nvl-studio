import React from 'react';
import { RoleValidationWarning } from '../../core/project/roleAssignment';

interface ValidationBannerProps {
  warnings: RoleValidationWarning[];
  onAutoAssign?: () => void;
}

export const ValidationBanner: React.FC<ValidationBannerProps> = ({
  warnings,
  onAutoAssign,
}) => {
  if (!warnings || warnings.length === 0) {
    return null;
  }

  return (
    <div className="validation-banner">
      <div className="validation-banner-header">
        <div className="validation-title-group">
          <span className="validation-icon">⚠️</span>
          <span className="validation-title">
            Character Rigging Incomplete ({warnings.length} missing role{warnings.length > 1 ? 's' : ''})
          </span>
        </div>

        {onAutoAssign && (
          <button
            className="action-btn auto-assign-btn"
            onClick={onAutoAssign}
            title="Automatically detect roles based on filenames and layer names"
          >
            ⚡ Auto-Assign Roles
          </button>
        )}
      </div>

      <div className="validation-warnings-list">
        {warnings.map((w) => (
          <div key={w.role} className="validation-warning-item">
            <span className="warning-bullet">•</span>
            <span className="warning-text">{w.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
