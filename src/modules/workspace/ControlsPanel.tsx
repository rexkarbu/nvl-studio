import React, { useState, useEffect } from 'react';
import { ParameterStore } from '../../core/parameters/ParameterStore';
import { TalkSimulator } from '../../core/audio/TalkSimulator';
import { BlinkScheduler } from '../../core/animation/BlinkScheduler';
import { AudioVAD } from '../../core/audio/AudioVAD';
import { CharacterLayer, ProjectManifest, SemanticLayerRole, IdleConfig, BlinkSettings, ExpressionConfig } from '../../core/project/types';
import { validateRoleMapping } from '../../core/project/roleAssignment';
import { AnimatorConfigPanel } from './AnimatorConfigPanel';
import { AudioMeter } from './AudioMeter';
import { ExpressionPanel } from './ExpressionPanel';
import { HotkeySettings } from './HotkeySettings';
import { DEFAULT_EXPRESSIONS, DEFAULT_HOTKEYS } from '../../core/project/defaultProject';

interface ControlsPanelProps {
  store: ParameterStore;
  talkSimulator: TalkSimulator;
  blinkScheduler: BlinkScheduler;
  audioVAD: AudioVAD;
  manifest?: ProjectManifest;
  onUpdateLayers?: (layers: CharacterLayer[]) => void;
  onUpdateIdleConfig?: (idleConfig: IdleConfig) => void;
  onUpdateBlinkConfig?: (blinkConfig: BlinkSettings) => void;
  onUpdateAudioConfig?: (audioConfig: ProjectManifest['audioConfig']) => void;
  onSelectExpression?: (expressionId: string) => void;
  onUpdateExpressionConfig?: (config: ExpressionConfig) => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  store,
  talkSimulator,
  blinkScheduler,
  audioVAD,
  manifest,
  onUpdateLayers,
  onUpdateIdleConfig,
  onUpdateBlinkConfig,
  onUpdateAudioConfig,
  onSelectExpression,
  onUpdateExpressionConfig,
}) => {
  const [panelTab, setPanelTab] = useState<'animator' | 'expressions' | 'quick'>('animator');
  const [selectedLayerId, setSelectedLayerId] = useState<string>('layer-mouth-closed');
  const [isTalking, setIsTalking] = useState<boolean>(false);
  const [isAutoBlink, setIsAutoBlink] = useState<boolean>(true);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [threshold, setThreshold] = useState<number>(audioVAD.getConfig().threshold);
  const [sensitivity, setSensitivity] = useState<number>(audioVAD.getConfig().sensitivity);
  const [releaseDelay, setReleaseDelay] = useState<number>(audioVAD.getConfig().releaseDelayMs);
  const [micError, setMicError] = useState<string | null>(null);
  const [activeExpression, setActiveExpression] = useState<string>(
    manifest?.expressionConfig?.activeExpression || 'neutral'
  );

  // Sync state with store
  useEffect(() => {
    const unsubscribe = store.subscribe((params) => {
      setIsTalking(params.voiceActivity);
      if (params.expression) {
        setActiveExpression(params.expression);
      }
    });

    // Start auto-blink by default
    blinkScheduler.start();

    return () => {
      unsubscribe();
      blinkScheduler.stop();
    };
  }, [store, blinkScheduler]);

  const handleToggleSimulator = () => {
    if (isMicActive) {
      // Turn off mic if simulator is activated
      audioVAD.stop();
      setIsMicActive(false);
    }
    const talking = talkSimulator.toggle(0.8);
    setIsTalking(talking);
  };

  const handleToggleAutoBlink = () => {
    if (isAutoBlink) {
      blinkScheduler.stop();
      setIsAutoBlink(false);
    } else {
      blinkScheduler.start();
      setIsAutoBlink(true);
    }
  };

  const handleManualBlink = () => {
    blinkScheduler.triggerManualBlink();
  };

  const handleToggleMic = async () => {
    setMicError(null);
    if (isMicActive) {
      audioVAD.stop();
      setIsMicActive(false);
    } else {
      try {
        if (isTalking) {
          talkSimulator.stopTalking();
          setIsTalking(false);
        }
        await audioVAD.start();
        setIsMicActive(true);
      } catch (err: any) {
        setMicError(err.message || 'Microphone access denied');
        setIsMicActive(false);
      }
    }
  };

  const handleThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setThreshold(val);
    audioVAD.updateConfig({ threshold: val });
  };

  const handleSensitivityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSensitivity(val);
    audioVAD.updateConfig({ sensitivity: val });
  };

  const handleReleaseDelayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setReleaseDelay(val);
    audioVAD.updateConfig({ releaseDelayMs: val });
  };

  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);

  const handleAutoCalibrate = async () => {
    if (!isMicActive) {
      try {
        await audioVAD.start();
        setIsMicActive(true);
      } catch (err: any) {
        setMicError(err.message || 'Microphone access denied');
        return;
      }
    }
    setIsCalibrating(true);
    try {
      const suggested = await audioVAD.autoCalibrate(1500);
      setThreshold(suggested);
    } catch (err: any) {
      console.warn('Calibration error:', err);
    } finally {
      setIsCalibrating(false);
    }
  };

  const roleValidation = manifest ? validateRoleMapping(manifest.layers) : null;

  const handleUpdateIdle = onUpdateIdleConfig || (() => {});
  const handleUpdateBlink = onUpdateBlinkConfig || (() => {});
  const handleUpdateAudio = onUpdateAudioConfig || (() => {});

  return (
    <section className="controls-panel">
      {/* Controls / Animator / Expressions Sub-tabs */}
      <div className="sidebar-tab-bar" style={{ marginBottom: '12px' }}>
        <button
          className={`sidebar-tab-btn ${panelTab === 'animator' ? 'active' : ''}`}
          onClick={() => setPanelTab('animator')}
        >
          ⚙️ Animator
        </button>
        <button
          className={`sidebar-tab-btn ${panelTab === 'expressions' ? 'active' : ''}`}
          onClick={() => setPanelTab('expressions')}
        >
          🎭 Expressions
        </button>
        <button
          className={`sidebar-tab-btn ${panelTab === 'quick' ? 'active' : ''}`}
          onClick={() => setPanelTab('quick')}
        >
          🎮 Simulator
        </button>
      </div>

      {panelTab === 'animator' && manifest && (
        <AnimatorConfigPanel
          store={store}
          blinkScheduler={blinkScheduler}
          audioVAD={audioVAD}
          manifest={manifest}
          onUpdateIdleConfig={handleUpdateIdle}
          onUpdateBlinkConfig={handleUpdateBlink}
          onUpdateAudioConfig={handleUpdateAudio}
        />
      )}

      {panelTab === 'expressions' && manifest && (
        <div className="expressions-tab-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <ExpressionPanel
            expressionConfig={manifest.expressionConfig}
            layers={manifest.layers}
            onSelectExpression={onSelectExpression || (() => {})}
            onUpdateExpressionConfig={onUpdateExpressionConfig || (() => {})}
          />
          <HotkeySettings
            hotkeys={manifest.expressionConfig?.hotkeys || DEFAULT_HOTKEYS}
            expressions={manifest.expressionConfig?.expressions || DEFAULT_EXPRESSIONS}
            onUpdateHotkeys={(newHotkeys) => {
              if (onUpdateExpressionConfig) {
                const currentConfig = manifest.expressionConfig || {
                  activeExpression: 'neutral',
                  expressions: DEFAULT_EXPRESSIONS,
                  hotkeys: DEFAULT_HOTKEYS,
                };
                onUpdateExpressionConfig({
                  ...currentConfig,
                  hotkeys: newHotkeys,
                });
              }
            }}
          />
        </div>
      )}

      {panelTab === 'quick' && (
        <>
          {/* Quick Expression Switcher */}
          <div className="control-card">
            <div className="card-header">
              <span className="card-title">Active Expression</span>
              <span className="card-sub">{activeExpression}</span>
            </div>
            <div className="card-content">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(manifest?.expressionConfig?.expressions || DEFAULT_EXPRESSIONS).map((expr) => {
                  const isActive = activeExpression === expr.id;
                  return (
                    <button
                      key={expr.id}
                      className={`action-btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: '1 1 calc(50% - 6px)', minWidth: '80px', fontSize: '12px' }}
                      onClick={() => {
                        if (onSelectExpression) {
                          onSelectExpression(expr.id);
                        }
                      }}
                    >
                      {expr.name} {isActive ? '✓' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 0. Live Role Mapping Status */}
          {roleValidation && (
            <div className="control-card role-status-card">
              <div className="card-header">
                <span className="card-title">Live Role Status</span>
                <span
                  className={`badge-tag ${roleValidation.isValid ? 'badge-tag-success' : 'badge-tag-warning'}`}
                  style={{
                    background: roleValidation.isValid ? 'rgba(44, 182, 125, 0.15)' : 'rgba(255, 137, 6, 0.15)',
                    color: roleValidation.isValid ? '#2cb67d' : '#ff8906',
                    borderColor: roleValidation.isValid ? 'rgba(44, 182, 125, 0.35)' : 'rgba(255, 137, 6, 0.35)',
                  }}
                >
                  {roleValidation.isValid ? '✓ Rigging Complete' : `⚠️ ${roleValidation.missingRoles.length} Missing`}
                </span>
              </div>

              <div className="role-status-grid">
                {[
                  { role: 'body', label: 'Body' },
                  { role: 'eye_open', label: 'Eye Open' },
                  { role: 'eye_closed', label: 'Eye Closed' },
                  { role: 'mouth_closed', label: 'Mouth Closed' },
                  { role: 'mouth_open', label: 'Mouth Open' },
                ].map(({ role, label }) => {
                  const assignedLayer = roleValidation.mappedRoles[role as SemanticLayerRole];
                  return (
                    <div key={role} className="role-status-row">
                      <span className="role-status-dot">{assignedLayer ? '🟢' : '🔴'}</span>
                      <span className="role-status-label">{label}:</span>
                      <span
                        className={`role-status-layer-name ${assignedLayer ? 'assigned' : 'unassigned'}`}
                        title={assignedLayer || 'No layer assigned'}
                      >
                        {assignedLayer || 'Missing'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 1. Talk Simulator */}
          <div className="control-card">
            <div className="card-header">
              <span className="card-title">Talk Simulator</span>
              <span className="card-sub">Manual Testing</span>
            </div>
            <div className="card-content">
              <button
                className={`action-btn-large ${isTalking ? 'talking-active' : ''}`}
                onClick={handleToggleSimulator}
                title="Toggle mouth open/close"
              >
                <span className="btn-icon">{isTalking ? '🗣️' : '🤐'}</span>
                <span>{isTalking ? 'Stop Talking' : 'Simulate Talk'}</span>
              </button>
              <p className="card-hint">
                Uji respons avatar secara instan tanpa perlu berbicara di mic.
              </p>
            </div>
          </div>

          {/* 2. Blink Controller */}
          <div className="control-card">
            <div className="card-header">
              <span className="card-title">Blink Controller</span>
              <span className="card-sub">Independent State</span>
            </div>
            <div className="card-content row-actions">
              <button
                className={`action-btn ${isAutoBlink ? 'btn-primary' : 'btn-secondary'}`}
                onClick={handleToggleAutoBlink}
              >
                Auto-Blink: {isAutoBlink ? 'ON' : 'OFF'}
              </button>
              <button className="action-btn btn-outline" onClick={handleManualBlink}>
                Trigger Blink 👁️
              </button>
            </div>
          </div>

          {/* 3. Audio & Microphone VAD */}
          <div className="control-card">
            <div className="card-header">
              <span className="card-title">Microphone VAD</span>
              <span className="card-sub">Voice Detection</span>
            </div>
            <div className="card-content">
              <button
                className={`action-btn-large ${isMicActive ? 'mic-active' : ''}`}
                onClick={handleToggleMic}
              >
                <span className="btn-icon">{isMicActive ? '🎙️' : '🎤'}</span>
                <span>{isMicActive ? 'Mic Active (Listening)' : 'Start Microphone'}</span>
              </button>

              {micError && <div className="error-banner">{micError}</div>}

              {/* Real-time AudioMeter Component */}
              <AudioMeter
                store={store}
                threshold={threshold}
                isListening={isMicActive}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  className="action-btn btn-outline"
                  style={{ flex: 1, fontSize: '11px', padding: '6px 8px' }}
                  onClick={handleAutoCalibrate}
                  disabled={isCalibrating}
                >
                  {isCalibrating ? 'Calibrating (be silent)...' : '⚡ Auto Calibrate Noise'}
                </button>
              </div>

              {/* Sliders */}
              <div className="slider-group">
                <div className="slider-row">
                  <label>Threshold ({Math.round(threshold * 100)}%) — sensitivity trigger</label>
                  <input
                    type="range"
                    min="0.01"
                    max="0.40"
                    step="0.01"
                    value={threshold}
                    onChange={handleThresholdChange}
                  />
                </div>

                <div className="slider-row">
                  <label>Mic Sensitivity ({sensitivity.toFixed(1)}x) — boost quiet mic</label>
                  <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.5"
                    value={sensitivity}
                    onChange={handleSensitivityChange}
                  />
                </div>

                <div className="slider-row">
                  <label>Release Delay ({releaseDelay}ms) — mouth hold time</label>
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="25"
                    value={releaseDelay}
                    onChange={handleReleaseDelayChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 4. Layer Position (Manual Verification / Persistence Test) */}
          {manifest && onUpdateLayers && (
            <div className="control-card">
              <div className="card-header">
                <span className="card-title">Layer Position</span>
                <span className="card-sub">Persistence Test</span>
              </div>
              <div className="card-content">
                <div className="slider-row">
                  <label>Select Layer</label>
                  <select
                    style={{
                      background: '#1a1926',
                      color: '#fffffe',
                      border: '1px solid #2e2c40',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      width: '100%',
                      marginTop: '4px',
                    }}
                    value={selectedLayerId}
                    onChange={(e) => setSelectedLayerId(e.target.value)}
                  >
                    {manifest.layers.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                {(() => {
                  const selectedLayer = manifest.layers.find((l) => l.id === selectedLayerId);
                  if (!selectedLayer) return null;
                  return (
                    <div className="slider-group" style={{ marginTop: '8px' }}>
                      <div className="slider-row">
                        <label>X Position ({selectedLayer.x}px)</label>
                        <input
                          type="range"
                          min={-300}
                          max={300}
                          step={5}
                          value={selectedLayer.x}
                          onChange={(e) => {
                            const newX = Number(e.target.value);
                            const updated = manifest.layers.map((l) =>
                              l.id === selectedLayerId
                                ? { ...l, x: newX }
                                : l
                            );
                            onUpdateLayers(updated);
                          }}
                        />
                      </div>
                      <div className="slider-row">
                        <label>Y Position ({selectedLayer.y}px)</label>
                        <input
                          type="range"
                          min={-300}
                          max={300}
                          step={5}
                          value={selectedLayer.y}
                          onChange={(e) => {
                            const newY = Number(e.target.value);
                            const updated = manifest.layers.map((l) =>
                              l.id === selectedLayerId
                                ? { ...l, y: newY }
                                : l
                            );
                            onUpdateLayers(updated);
                          }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};
