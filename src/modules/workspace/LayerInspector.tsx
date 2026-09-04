import React, { useState } from 'react';
import { CharacterLayer, SemanticLayerRole } from '../../core/project/types';
import { RoleSelector } from './RoleSelector';

interface LayerInspectorProps {
  layer: CharacterLayer | null;
  allLayers?: CharacterLayer[];
  onUpdateTransform: (layerId: string, updates: Partial<CharacterLayer>) => void;
  onAssignRole?: (layerId: string, newRole: SemanticLayerRole) => void;
  onDeleteLayer: (layerId: string) => void;
}

export const LayerInspector: React.FC<LayerInspectorProps> = ({
  layer,
  allLayers = [],
  onUpdateTransform,
  onAssignRole,
  onDeleteLayer,
}) => {
  const [lockAspect, setLockAspect] = useState<boolean>(true);

  if (!layer) {
    return (
      <div className="layer-inspector-empty">
        <p className="inspector-placeholder-text">
          Select a layer from the canvas or layer panel to inspect and edit properties.
        </p>
      </div>
    );
  }

  const handleScaleXChange = (newScaleX: number) => {
    if (lockAspect && layer.scaleX !== 0) {
      const ratio = newScaleX / layer.scaleX;
      const newScaleY = Number((layer.scaleY * ratio).toFixed(3));
      onUpdateTransform(layer.id, { scaleX: newScaleX, scaleY: newScaleY });
    } else {
      onUpdateTransform(layer.id, { scaleX: newScaleX });
    }
  };

  const handleScaleYChange = (newScaleY: number) => {
    if (lockAspect && layer.scaleY !== 0) {
      const ratio = newScaleY / layer.scaleY;
      const newScaleX = Number((layer.scaleX * ratio).toFixed(3));
      onUpdateTransform(layer.id, { scaleX: newScaleX, scaleY: newScaleY });
    } else {
      onUpdateTransform(layer.id, { scaleY: newScaleY });
    }
  };

  const handleResetTransform = () => {
    onUpdateTransform(layer.id, {
      x: 960,
      y: 540,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
    });
  };

  return (
    <div className="layer-inspector">
      <div className="inspector-header">
        <div className="inspector-title-row">
          <input
            type="text"
            className="inspector-name-input"
            value={layer.name}
            onChange={(e) => onUpdateTransform(layer.id, { name: e.target.value })}
            placeholder="Layer Name"
          />
          <span className="badge-tag">Z: {layer.zIndex}</span>
        </div>
      </div>

      <div className="inspector-content">
        {/* Semantic Role Assignment */}
        <div className="inspector-section">
          <span className="inspector-section-label">Semantic Animation Role</span>
          <RoleSelector
            currentRole={layer.role}
            currentLayerId={layer.id}
            allLayers={allLayers}
            onRoleSelect={(newRole) => {
              if (onAssignRole) {
                onAssignRole(layer.id, newRole);
              } else {
                onUpdateTransform(layer.id, { role: newRole });
              }
            }}
          />
        </div>

        {/* Visibility */}
        <div className="inspector-row-checkbox">
          <label className="checkbox-container">
            <input
              type="checkbox"
              checked={layer.visible}
              onChange={(e) => onUpdateTransform(layer.id, { visible: e.target.checked })}
            />
            <span className="checkbox-label">Visible on Canvas</span>
          </label>
        </div>

        {/* Position X / Y */}
        <div className="inspector-section">
          <span className="inspector-section-label">Position (px)</span>
          <div className="inspector-dual-inputs">
            <div className="input-with-label">
              <span className="input-prefix">X</span>
              <input
                type="number"
                className="inspector-num-input"
                value={layer.x}
                onChange={(e) => onUpdateTransform(layer.id, { x: Number(e.target.value) })}
              />
            </div>
            <div className="input-with-label">
              <span className="input-prefix">Y</span>
              <input
                type="number"
                className="inspector-num-input"
                value={layer.y}
                onChange={(e) => onUpdateTransform(layer.id, { y: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* Scale X / Y */}
        <div className="inspector-section">
          <div className="inspector-section-header">
            <span className="inspector-section-label">Scale</span>
            <button
              className={`aspect-lock-btn ${lockAspect ? 'locked' : ''}`}
              onClick={() => setLockAspect(!lockAspect)}
              title={lockAspect ? 'Aspect Ratio Locked' : 'Aspect Ratio Unlocked'}
            >
              {lockAspect ? '🔗 Lock' : '🔓 Free'}
            </button>
          </div>

          <div className="inspector-dual-inputs">
            <div className="input-with-label">
              <span className="input-prefix">W</span>
              <input
                type="number"
                step="0.05"
                min="0.05"
                max="10"
                className="inspector-num-input"
                value={layer.scaleX}
                onChange={(e) => handleScaleXChange(Number(e.target.value))}
              />
            </div>
            <div className="input-with-label">
              <span className="input-prefix">H</span>
              <input
                type="number"
                step="0.05"
                min="0.05"
                max="10"
                className="inspector-num-input"
                value={layer.scaleY}
                onChange={(e) => handleScaleYChange(Number(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Rotation */}
        <div className="inspector-section">
          <div className="slider-label-row">
            <span className="inspector-section-label">Rotation</span>
            <span className="slider-val-readout">{layer.rotation}°</span>
          </div>
          <div className="slider-input-group">
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={layer.rotation}
              onChange={(e) => onUpdateTransform(layer.id, { rotation: Number(e.target.value) })}
            />
            <input
              type="number"
              min="-180"
              max="180"
              className="inspector-num-input-small"
              value={layer.rotation}
              onChange={(e) => onUpdateTransform(layer.id, { rotation: Number(e.target.value) })}
            />
          </div>
        </div>

        {/* Opacity */}
        <div className="inspector-section">
          <div className="slider-label-row">
            <span className="inspector-section-label">Opacity</span>
            <span className="slider-val-readout">{Math.round(layer.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={layer.opacity}
            onChange={(e) => onUpdateTransform(layer.id, { opacity: Number(e.target.value) })}
          />
        </div>

        {/* Footer actions */}
        <div className="inspector-actions">
          <button className="action-btn btn-secondary" onClick={handleResetTransform}>
            Reset Transform
          </button>
          <button
            className="action-btn btn-outline"
            style={{ color: '#ff5470', borderColor: '#ff5470' }}
            onClick={() => {
              if (confirm(`Delete layer "${layer.name}"?`)) {
                onDeleteLayer(layer.id);
              }
            }}
          >
            Delete Layer
          </button>
        </div>
      </div>
    </div>
  );
};
