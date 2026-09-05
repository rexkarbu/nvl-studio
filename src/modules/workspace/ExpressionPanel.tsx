import React, { useState } from 'react';
import { ExpressionConfig, ExpressionDefinition, CharacterLayer } from '../../core/project/types';
import { DEFAULT_EXPRESSIONS } from '../../core/project/defaultProject';
import { showMessageBox, showConfirmDialog } from './dialogUtils';

interface ExpressionPanelProps {
  expressionConfig?: ExpressionConfig;
  layers: CharacterLayer[];
  onSelectExpression: (expressionId: string) => void;
  onUpdateExpressionConfig: (config: ExpressionConfig) => void;
}

export const ExpressionPanel: React.FC<ExpressionPanelProps> = ({
  expressionConfig,
  layers,
  onSelectExpression,
  onUpdateExpressionConfig,
}) => {
  const activeId = expressionConfig?.activeExpression || 'neutral';
  const expressions = expressionConfig?.expressions && expressionConfig.expressions.length > 0
    ? expressionConfig.expressions
    : DEFAULT_EXPRESSIONS;

  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [newExprName, setNewExprName] = useState<string>('');
  const [selectedLayerId, setSelectedLayerId] = useState<string>(layers[0]?.id || '');

  const activeDef = expressions.find((e) => e.id === activeId) || expressions[0];
  const activeOverrides = activeDef?.layerOverrides || {};
  const currentLayerOverride = selectedLayerId ? activeOverrides[selectedLayerId] || {} : {};
  const selectedLayer = layers.find((l) => l.id === selectedLayerId);

  const handleAddExpression = async () => {
    if (!newExprName.trim()) return;
    const id = newExprName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (expressions.some((e) => e.id === id)) {
      await showMessageBox('Duplicate Expression', `An expression with ID "${id}" already exists.`, 'warning');
      return;
    }

    const newDef: ExpressionDefinition = {
      id,
      name: newExprName.trim(),
      layerOverrides: {},
    };

    const updatedExpressions = [...expressions, newDef];
    onUpdateExpressionConfig({
      activeExpression: id,
      expressions: updatedExpressions,
      hotkeys: expressionConfig?.hotkeys,
    });
    onSelectExpression(id);
    setNewExprName('');
    setIsAdding(false);
  };

  const handleDeleteExpression = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (id === 'neutral') {
      await showMessageBox('Cannot Delete Expression', 'The "neutral" default expression cannot be deleted.', 'info');
      return;
    }
    const confirmed = await showConfirmDialog('Delete Expression', `Delete expression "${id}"?`);
    if (confirmed) {
      const updatedExpressions = expressions.filter((expr) => expr.id !== id);
      const nextActive = activeId === id ? 'neutral' : activeId;
      onUpdateExpressionConfig({
        activeExpression: nextActive,
        expressions: updatedExpressions,
        hotkeys: expressionConfig?.hotkeys?.filter((h) => h.expressionId !== id),
      });
      if (activeId === id) {
        onSelectExpression('neutral');
      }
    }
  };

  const handleUpdateLayerOverride = (property: keyof CharacterLayer, value: any) => {
    if (!selectedLayerId || !activeDef) return;

    const updatedLayerOverride = {
      ...currentLayerOverride,
      [property]: value,
    };

    const updatedOverrides = {
      ...activeOverrides,
      [selectedLayerId]: updatedLayerOverride,
    };

    const updatedExpressions = expressions.map((expr) => {
      if (expr.id === activeDef.id) {
        return {
          ...expr,
          layerOverrides: updatedOverrides,
        };
      }
      return expr;
    });

    onUpdateExpressionConfig({
      activeExpression: activeId,
      expressions: updatedExpressions,
      hotkeys: expressionConfig?.hotkeys,
    });
  };

  const handleClearLayerOverride = () => {
    if (!selectedLayerId || !activeDef) return;

    const updatedOverrides = { ...activeOverrides };
    delete updatedOverrides[selectedLayerId];

    const updatedExpressions = expressions.map((expr) => {
      if (expr.id === activeDef.id) {
        return {
          ...expr,
          layerOverrides: updatedOverrides,
        };
      }
      return expr;
    });

    onUpdateExpressionConfig({
      activeExpression: activeId,
      expressions: updatedExpressions,
      hotkeys: expressionConfig?.hotkeys,
    });
  };

  return (
    <div className="expression-panel" data-testid="expression-panel">
      {/* Expression Selection List */}
      <div className="section-card">
        <div className="section-header-row">
          <span className="section-title">🎭 Expressions</span>
          <button
            className="action-btn btn-secondary"
            style={{ fontSize: '11px', padding: '4px 8px' }}
            onClick={() => setIsAdding(!isAdding)}
          >
            {isAdding ? '✕ Cancel' : '➕ Add'}
          </button>
        </div>

        {isAdding && (
          <div className="add-expression-row" style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="inspector-name-input"
              placeholder="e.g. Smirk, Wink"
              value={newExprName}
              onChange={(e) => setNewExprName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddExpression()}
              autoFocus
            />
            <button className="action-btn btn-primary" onClick={handleAddExpression}>
              Save
            </button>
          </div>
        )}

        <div className="expression-grid" style={{ marginTop: '12px' }}>
          {expressions.map((expr) => {
            const isActive = expr.id === activeId;
            const overrideCount = Object.keys(expr.layerOverrides || {}).length;

            return (
              <div
                key={expr.id}
                className={`expression-card ${isActive ? 'active' : ''}`}
                onClick={() => onSelectExpression(expr.id)}
                data-testid={`expression-card-${expr.id}`}
              >
                <div className="expression-card-info">
                  <span className="expression-card-name">{expr.name}</span>
                  <span className="expression-card-meta">
                    {overrideCount > 0 ? `${overrideCount} layer overrides` : 'No overrides'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isActive && <span className="badge-tag active-badge">ACTIVE</span>}
                  {expr.id !== 'neutral' && (
                    <button
                      className="layer-icon-btn delete-btn"
                      onClick={(e) => handleDeleteExpression(expr.id, e)}
                      title={`Delete expression "${expr.name}"`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Layer Override Inspector for Active Expression */}
      <div className="section-card" style={{ marginTop: '14px' }}>
        <div className="section-header-row">
          <span className="section-title">
            ⚙️ Overrides for "{activeDef?.name || activeId}"
          </span>
          {Object.keys(currentLayerOverride).length > 0 && (
            <button
              className="action-btn btn-outline"
              style={{ fontSize: '11px', padding: '3px 8px', color: '#ff5470', borderColor: 'rgba(255,84,112,0.4)' }}
              onClick={handleClearLayerOverride}
            >
              Reset Layer
            </button>
          )}
        </div>

        <p className="section-description" style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '6px 0 12px 0' }}>
          Tweak scale, position, rotation or opacity for specific layers when this expression is active.
        </p>

        <div className="override-layer-select-group" style={{ marginBottom: '12px' }}>
          <label className="input-label" style={{ fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
            Target Layer:
          </label>
          <select
            className="device-select"
            value={selectedLayerId}
            onChange={(e) => setSelectedLayerId(e.target.value)}
          >
            {layers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.role}) {activeOverrides[l.id] ? '⚡ modified' : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedLayer && (
          <div className="override-inputs-grid" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Position X / Y */}
            <div className="control-row">
              <span className="control-label">Position (X, Y)</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div className="input-with-label" style={{ flex: 1 }}>
                  <span className="input-prefix">X</span>
                  <input
                    type="number"
                    className="inspector-num-input"
                    value={currentLayerOverride.x ?? selectedLayer.x}
                    onChange={(e) => handleUpdateLayerOverride('x', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="input-with-label" style={{ flex: 1 }}>
                  <span className="input-prefix">Y</span>
                  <input
                    type="number"
                    className="inspector-num-input"
                    value={currentLayerOverride.y ?? selectedLayer.y}
                    onChange={(e) => handleUpdateLayerOverride('y', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            </div>

            {/* Scale X / Y */}
            <div className="control-row">
              <span className="control-label">Scale (X, Y)</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div className="input-with-label" style={{ flex: 1 }}>
                  <span className="input-prefix">SX</span>
                  <input
                    type="number"
                    step="0.05"
                    className="inspector-num-input"
                    value={currentLayerOverride.scaleX ?? selectedLayer.scaleX}
                    onChange={(e) => handleUpdateLayerOverride('scaleX', parseFloat(e.target.value) || 1)}
                  />
                </div>
                <div className="input-with-label" style={{ flex: 1 }}>
                  <span className="input-prefix">SY</span>
                  <input
                    type="number"
                    step="0.05"
                    className="inspector-num-input"
                    value={currentLayerOverride.scaleY ?? selectedLayer.scaleY}
                    onChange={(e) => handleUpdateLayerOverride('scaleY', parseFloat(e.target.value) || 1)}
                  />
                </div>
              </div>
            </div>

            {/* Rotation & Opacity */}
            <div className="control-row">
              <span className="control-label">Rotation & Opacity</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div className="input-with-label" style={{ flex: 1 }}>
                  <span className="input-prefix">Deg</span>
                  <input
                    type="number"
                    className="inspector-num-input"
                    value={currentLayerOverride.rotation ?? selectedLayer.rotation}
                    onChange={(e) => handleUpdateLayerOverride('rotation', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="input-with-label" style={{ flex: 1 }}>
                  <span className="input-prefix">Alpha</span>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    className="inspector-num-input"
                    value={currentLayerOverride.opacity ?? selectedLayer.opacity}
                    onChange={(e) => handleUpdateLayerOverride('opacity', Math.max(0, Math.min(1, parseFloat(e.target.value) || 1)))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
