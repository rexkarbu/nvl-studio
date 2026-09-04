import React, { useState } from 'react';
import { CharacterLayer } from '../../core/project/types';
import { moveLayerUp, moveLayerDown } from '../../core/project/layerOperations';

interface LayerPanelProps {
  layers: CharacterLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string) => void;
  onReorderLayers: (newLayers: CharacterLayer[]) => void;
  onRenameLayer: (layerId: string, newName: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onDeleteLayer: (layerId: string) => void;
  onImportPng: () => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  layers,
  selectedLayerId,
  onSelectLayer,
  onReorderLayers,
  onRenameLayer,
  onToggleVisibility,
  onDeleteLayer,
  onImportPng,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');

  // Display layers from highest zIndex (top of visual stack) to lowest zIndex (bottom)
  const displayLayers = [...layers].sort((a, b) => b.zIndex - a.zIndex);

  const startRename = (layer: CharacterLayer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(layer.id);
    setEditName(layer.name);
  };

  const handleFinishRename = (layerId: string) => {
    if (editName.trim()) {
      onRenameLayer(layerId, editName.trim());
    }
    setEditingId(null);
  };

  const handleMoveUp = (layerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = moveLayerUp(layers, layerId);
    onReorderLayers(updated);
  };

  const handleMoveDown = (layerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = moveLayerDown(layers, layerId);
    onReorderLayers(updated);
  };

  const handleDelete = (layer: CharacterLayer, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete layer "${layer.name}"?`)) {
      onDeleteLayer(layer.id);
    }
  };

  return (
    <aside className="layer-panel">
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="panel-title">Layers</span>
          <span className="badge-tag">{layers.length}</span>
        </div>

        <button
          className="action-btn btn-primary"
          style={{ fontSize: '11px', padding: '5px 9px' }}
          onClick={onImportPng}
          title="Import external transparent PNG asset(s)"
        >
          <span>➕ Import PNG</span>
        </button>
      </div>

      <div className="layer-list-scrollable">
        {displayLayers.length === 0 ? (
          <div className="empty-layer-state">
            <p>No layers yet.</p>
            <button className="action-btn btn-outline" onClick={onImportPng}>
              Import First PNG
            </button>
          </div>
        ) : (
          displayLayers.map((layer, index) => {
            const isSelected = layer.id === selectedLayerId;
            const isTop = index === 0;
            const isBottom = index === displayLayers.length - 1;

            return (
              <div
                key={layer.id}
                className={`layer-item ${isSelected ? 'selected' : ''} ${!layer.visible ? 'layer-hidden' : ''}`}
                onClick={() => onSelectLayer(layer.id)}
              >
                {/* Visibility Toggle */}
                <button
                  className="layer-icon-btn visibility-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(layer.id);
                  }}
                  title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                >
                  {layer.visible ? '👁️' : '🙈'}
                </button>

                {/* Layer Name / Inline Edit */}
                <div className="layer-name-container">
                  {editingId === layer.id ? (
                    <input
                      type="text"
                      className="layer-rename-input"
                      value={editName}
                      autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleFinishRename(layer.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleFinishRename(layer.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      className="layer-name-text"
                      onDoubleClick={(e) => startRename(layer, e)}
                      title="Double click to rename"
                    >
                      {layer.name}
                    </span>
                  )}
                  <span className="layer-role-chip">{layer.role}</span>
                </div>

                {/* Layer Actions: Move Up, Move Down, Delete */}
                <div className="layer-item-actions">
                  <button
                    className="layer-icon-btn reorder-btn"
                    disabled={isTop}
                    onClick={(e) => handleMoveUp(layer.id, e)}
                    title="Bring Forward (Higher Z-Index)"
                  >
                    ▲
                  </button>
                  <button
                    className="layer-icon-btn reorder-btn"
                    disabled={isBottom}
                    onClick={(e) => handleMoveDown(layer.id, e)}
                    title="Send Backward (Lower Z-Index)"
                  >
                    ▼
                  </button>
                  <button
                    className="layer-icon-btn delete-btn"
                    onClick={(e) => handleDelete(layer, e)}
                    title="Delete Layer"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
