import React, { useState, useEffect, useRef } from 'react';
import { ParameterStore } from '../../core/parameters/ParameterStore';
import { TalkSimulator } from '../../core/audio/TalkSimulator';
import { BlinkScheduler } from '../../core/animation/BlinkScheduler';
import { AudioVAD } from '../../core/audio/AudioVAD';
import { CharacterLayer, ProjectManifest, SemanticLayerRole } from '../../core/project/types';
import { validateRoleMapping } from '../../core/project/roleAssignment';

interface ControlsPanelProps {
  store: ParameterStore;
  talkSimulator: TalkSimulator;
  blinkScheduler: BlinkScheduler;
  audioVAD: AudioVAD;
  manifest?: ProjectManifest;
  onUpdateLayers?: (layers: CharacterLayer[]) => void;
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  store,
  talkSimulator,
  blinkScheduler,
  audioVAD,
  manifest,
  onUpdateLayers,
}) => {
  const [selectedLayerId, setSelectedLayerId] = useState<string>('layer-mouth-closed');
  const [isTalking, setIsTalking] = useState<boolean>(false);
  const [isAutoBlink, setIsAutoBlink] = useState<boolean>(true);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [threshold, setThreshold] = useState<number>(audioVAD.getConfig().threshold);
  const [sensitivity, setSensitivity] = useState<number>(audioVAD.getConfig().sensitivity);
  const [releaseDelay, setReleaseDelay] = useState<number>(audioVAD.getConfig().releaseDelayMs);
  const [micError, setMicError] = useState<string | null>(null);

  const meterAnimRef = useRef<number | null>(null);

  // Sync state with store
  useEffect(() => {
    const unsubscribe = store.subscribe((params) => {
      setIsTalking(params.voiceActivity);
    });

    // Start auto-blink by default
    blinkScheduler.start();

    return () => {
      unsubscribe();
      blinkScheduler.stop();
      if (meterAnimRef.current) cancelAnimationFrame(meterAnimRef.current);
    };
  }, [store, blinkScheduler]);

  // Audio meter polling when mic is active
  useEffect(() => {
    if (isMicActive) {
      const updateMeter = () => {
        setMicLevel(audioVAD.getCurrentLevel());
        meterAnimRef.current = requestAnimationFrame(updateMeter);
      };
      meterAnimRef.current = requestAnimationFrame(updateMeter);
    } else {
      if (meterAnimRef.current) cancelAnimationFrame(meterAnimRef.current);
      setMicLevel(0);
    }

    return () => {
      if (meterAnimRef.current) cancelAnimationFrame(meterAnimRef.current);
    };
  }, [isMicActive, audioVAD]);

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

  return (
    <section className="controls-panel">
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

          {/* Audio Meter */}
          <div className="audio-meter-wrapper">
            <div className="meter-labels">
              <span>Input Level</span>
              <span style={{ fontWeight: micLevel >= threshold ? 'bold' : 'normal', color: micLevel >= threshold ? '#ff5470' : 'inherit' }}>
                {Math.round(micLevel * 100)}% {micLevel >= threshold ? '(VOICE DETECTED)' : ''}
              </span>
            </div>
            <div className="audio-meter-track">
              <div
                className={`audio-meter-fill ${micLevel >= threshold ? 'active' : ''}`}
                style={{ width: `${Math.min(100, micLevel * 100)}%` }}
              />
              <div
                className="meter-threshold-marker"
                style={{ left: `${threshold * 100}%` }}
                title={`Activation Threshold: ${Math.round(threshold * 100)}%`}
              />
            </div>
          </div>

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
    </section>
  );
};
