import React, { useState, useEffect } from 'react';
import { HotkeyMapping, ExpressionDefinition } from '../../core/project/types';
import { DEFAULT_HOTKEYS, DEFAULT_EXPRESSIONS } from '../../core/project/defaultProject';

interface HotkeySettingsProps {
  hotkeys?: HotkeyMapping[];
  expressions?: ExpressionDefinition[];
  onUpdateHotkeys: (updatedHotkeys: HotkeyMapping[]) => void;
}

export const HotkeySettings: React.FC<HotkeySettingsProps> = ({
  hotkeys = DEFAULT_HOTKEYS,
  expressions = DEFAULT_EXPRESSIONS,
  onUpdateHotkeys,
}) => {
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);

  // Key capture listener during recording mode
  useEffect(() => {
    if (recordingIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't bind bare modifier keys
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      const keyName = e.key.toUpperCase();
      const hasCtrl = e.ctrlKey;
      const hasShift = e.shiftKey;
      const hasAlt = e.altKey;

      // Check for conflict with existing hotkey (excluding current index)
      const conflict = hotkeys.some(
        (h, idx) =>
          idx !== recordingIndex &&
          h.key.toUpperCase() === keyName &&
          Boolean(h.ctrl) === hasCtrl &&
          Boolean(h.shift) === hasShift &&
          Boolean(h.alt) === hasAlt
      );

      if (conflict) {
        alert(`Hotkey "${hasCtrl ? 'Ctrl+' : ''}${hasShift ? 'Shift+' : ''}${hasAlt ? 'Alt+' : ''}${keyName}" is already mapped to another expression.`);
        setRecordingIndex(null);
        return;
      }

      const updated = [...hotkeys];
      updated[recordingIndex] = {
        ...updated[recordingIndex],
        key: keyName,
        ctrl: hasCtrl || undefined,
        shift: hasShift || undefined,
        alt: hasAlt || undefined,
      };

      onUpdateHotkeys(updated);
      setRecordingIndex(null);
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [recordingIndex, hotkeys, onUpdateHotkeys]);

  const handleResetDefaults = () => {
    if (confirm('Reset hotkey mappings to default (F1-F4)?')) {
      onUpdateHotkeys([...DEFAULT_HOTKEYS]);
    }
  };

  const handleToggleModifier = (
    index: number,
    modifier: 'ctrl' | 'shift' | 'alt'
  ) => {
    const updated = [...hotkeys];
    const current = updated[index];
    const newVal = !current[modifier];

    // Check conflict
    const testMapping = {
      ...current,
      [modifier]: newVal || undefined,
    };

    const conflict = hotkeys.some(
      (h, idx) =>
        idx !== index &&
        h.key.toUpperCase() === testMapping.key.toUpperCase() &&
        Boolean(h.ctrl) === Boolean(testMapping.ctrl) &&
        Boolean(h.shift) === Boolean(testMapping.shift) &&
        Boolean(h.alt) === Boolean(testMapping.alt)
    );

    if (conflict) {
      alert('This modifier combination conflicts with an existing hotkey mapping.');
      return;
    }

    updated[index] = testMapping;
    onUpdateHotkeys(updated);
  };

  const handleAddMapping = () => {
    const availableExpr = expressions.find(
      (e) => !hotkeys.some((h) => h.expressionId === e.id)
    ) || expressions[0];

    if (!availableExpr) return;

    // Default to an unused function key or digit
    const usedKeys = new Set(hotkeys.map((h) => h.key.toUpperCase()));
    let nextKey = 'F5';
    for (let i = 1; i <= 12; i++) {
      const candidate = `F${i}`;
      if (!usedKeys.has(candidate)) {
        nextKey = candidate;
        break;
      }
    }

    const newMapping: HotkeyMapping = {
      expressionId: availableExpr.id,
      key: nextKey,
    };

    onUpdateHotkeys([...hotkeys, newMapping]);
  };

  const handleDeleteMapping = (index: number) => {
    const updated = hotkeys.filter((_, i) => i !== index);
    onUpdateHotkeys(updated);
  };

  return (
    <div className="section-card hotkey-settings-panel" data-testid="hotkey-settings">
      <div className="section-header-row">
        <span className="section-title">⌨️ Hotkey Triggers</span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="action-btn btn-secondary"
            style={{ fontSize: '11px', padding: '4px 8px' }}
            onClick={handleAddMapping}
          >
            ➕ Add
          </button>
          <button
            className="action-btn btn-outline"
            style={{ fontSize: '11px', padding: '4px 8px' }}
            onClick={handleResetDefaults}
            title="Reset hotkeys to F1-F4 defaults"
          >
            ↺ Defaults
          </button>
        </div>
      </div>

      <p className="section-description" style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '6px 0 12px 0' }}>
        Press keys while NVL Studio is focused to trigger expressions instantly in your broadcast.
      </p>

      {recordingIndex !== null && (
        <div
          className="recording-overlay-banner"
          style={{
            background: 'rgba(127, 90, 240, 0.15)',
            border: '1px solid var(--accent-primary)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px 12px',
            marginBottom: '12px',
            textAlign: 'center',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>🔴 Press any key combination on your keyboard...</span>
          <button
            className="action-btn btn-secondary"
            style={{ fontSize: '10px', padding: '2px 6px' }}
            onClick={() => setRecordingIndex(null)}
          >
            Cancel
          </button>
        </div>
      )}

      <div className="hotkeys-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {hotkeys.map((mapping, index) => {
          const isRecordingThis = recordingIndex === index;

          return (
            <div
              key={`${mapping.expressionId}-${index}`}
              className="hotkey-row"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                gap: '8px',
              }}
            >
              {/* Target Expression Selector */}
              <select
                className="device-select"
                style={{ flex: 1, minWidth: '110px' }}
                value={mapping.expressionId}
                onChange={(e) => {
                  const updated = [...hotkeys];
                  updated[index] = { ...updated[index], expressionId: e.target.value };
                  onUpdateHotkeys(updated);
                }}
              >
                {expressions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>

              {/* Modifiers checkboxes */}
              <div style={{ display: 'flex', gap: '6px', fontSize: '10px', color: 'var(--text-muted)' }}>
                <label className="checkbox-container" style={{ fontSize: '11px', gap: '4px' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(mapping.ctrl)}
                    onChange={() => handleToggleModifier(index, 'ctrl')}
                  />
                  Ctrl
                </label>
                <label className="checkbox-container" style={{ fontSize: '11px', gap: '4px' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(mapping.shift)}
                    onChange={() => handleToggleModifier(index, 'shift')}
                  />
                  Shift
                </label>
                <label className="checkbox-container" style={{ fontSize: '11px', gap: '4px' }}>
                  <input
                    type="checkbox"
                    checked={Boolean(mapping.alt)}
                    onChange={() => handleToggleModifier(index, 'alt')}
                  />
                  Alt
                </label>
              </div>

              {/* Key Badge / Record Button */}
              <button
                className={`hotkey-key-pill ${isRecordingThis ? 'recording' : ''}`}
                style={{
                  background: isRecordingThis ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.08)',
                  color: isRecordingThis ? '#fff' : 'var(--text-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  fontFamily: 'JetBrains Mono, monospace',
                  cursor: 'pointer',
                  minWidth: '50px',
                  textAlign: 'center',
                }}
                onClick={() => setRecordingIndex(isRecordingThis ? null : index)}
                title="Click to re-bind this hotkey"
              >
                {isRecordingThis ? '⏳ Press...' : mapping.key}
              </button>

              <button
                className="layer-icon-btn delete-btn"
                onClick={() => handleDeleteMapping(index)}
                title="Delete hotkey"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
