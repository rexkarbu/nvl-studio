import React, { useState, useEffect, useCallback } from 'react';
import { ParameterStore } from '../../core/parameters/ParameterStore';
import { BlinkScheduler } from '../../core/animation/BlinkScheduler';
import { AudioVAD } from '../../core/audio/AudioVAD';
import { AudioCalibrator, CalibrationResult } from '../../core/audio/AudioCalibrator';
import { AudioMeter } from './AudioMeter';
import {
  ProjectManifest,
  IdleConfig,
  BlinkSettings,
} from '../../core/project/types';

export interface AnimatorConfigPanelProps {
  store: ParameterStore;
  blinkScheduler: BlinkScheduler;
  audioVAD: AudioVAD;
  manifest: ProjectManifest;
  onUpdateIdleConfig: (idleConfig: IdleConfig) => void;
  onUpdateBlinkConfig: (blinkConfig: BlinkSettings) => void;
  onUpdateAudioConfig: (audioConfig: ProjectManifest['audioConfig']) => void;
}

export const AnimatorConfigPanel: React.FC<AnimatorConfigPanelProps> = ({
  store,
  blinkScheduler,
  audioVAD,
  manifest,
  onUpdateIdleConfig,
  onUpdateBlinkConfig,
  onUpdateAudioConfig,
}) => {
  // Config defaults fallback
  const idleConfig: IdleConfig = manifest.idleConfig ?? {
    enabled: true,
    amplitude: 8,
    speed: 1.5,
  };

  const blinkConfig: BlinkSettings = manifest.blinkConfig ?? {
    enabled: true,
    minIntervalMs: 3000,
    maxIntervalMs: 6000,
    durationMs: 150,
  };

  const audioConfig = manifest.audioConfig;

  // Microphone device enumeration state
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState<boolean>(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isMicActive, setIsMicActive] = useState<boolean>(() => audioVAD.getIsRunning());
  const [micError, setMicError] = useState<string | null>(null);

  // Calibration state
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [calibrationProgress, setCalibrationProgress] = useState<number>(0);
  const [calibrationResult, setCalibrationResult] = useState<CalibrationResult | null>(null);

  const refreshDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) {
      return;
    }
    setIsLoadingDevices(true);
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === 'audioinput');
      setAudioDevices(inputs);
      if (inputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(inputs[0].deviceId);
      }
    } catch (err) {
      console.warn('[AnimatorConfig] Device enumeration failed:', err);
    } finally {
      setIsLoadingDevices(false);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    refreshDevices();
    if (navigator?.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
      };
    }
  }, [refreshDevices]);

  // Handle Audio Device Selection
  const handleDeviceChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedDeviceId(newId);
    if (isMicActive) {
      audioVAD.stop();
      try {
        await audioVAD.start(newId || undefined);
      } catch (err: any) {
        setMicError(err.message || 'Failed to switch microphone');
        setIsMicActive(false);
      }
    }
  };

  // Toggle Mic Active
  const handleToggleMic = async () => {
    setMicError(null);
    if (isMicActive) {
      audioVAD.stop();
      setIsMicActive(false);
    } else {
      try {
        await audioVAD.start(selectedDeviceId || undefined);
        setIsMicActive(true);
        // Refresh devices to get real labels after permission granted
        refreshDevices();
      } catch (err: any) {
        setMicError(err.message || 'Microphone access denied');
        setIsMicActive(false);
      }
    }
  };

  // Auto Calibration
  const handleStartCalibration = async () => {
    setMicError(null);
    if (!audioVAD.getIsRunning()) {
      try {
        await audioVAD.start(selectedDeviceId || undefined);
        setIsMicActive(true);
      } catch (err: any) {
        setMicError(err.message || 'Microphone access denied');
        return;
      }
    }

    setIsCalibrating(true);
    setCalibrationProgress(0);
    setCalibrationResult(null);

    try {
      const result = await AudioCalibrator.calibrateAmbient(audioVAD, 2000, (pct) => {
        setCalibrationProgress(pct);
      });
      setCalibrationResult(result);

      // Auto apply suggested threshold
      const updated = {
        ...audioConfig,
        threshold: result.recommendedThreshold,
      };
      onUpdateAudioConfig(updated);
      audioVAD.updateConfig({ threshold: result.recommendedThreshold });
    } catch (err: any) {
      setMicError(err.message || 'Calibration failed');
    } finally {
      setIsCalibrating(false);
    }
  };

  return (
    <div className="animator-config-panel" data-testid="animator-config-panel">
      {/* 1. Idle Bobbing Configuration */}
      <div className="control-card">
        <div className="card-header">
          <span className="card-title">Idle Animation</span>
          <span
            className={`badge-tag ${idleConfig.enabled ? 'badge-tag-success' : 'badge-tag-warning'}`}
            style={{
              background: idleConfig.enabled ? 'rgba(44, 182, 125, 0.15)' : 'rgba(255, 137, 6, 0.15)',
              color: idleConfig.enabled ? '#2cb67d' : '#ff8906',
              borderColor: idleConfig.enabled ? 'rgba(44, 182, 125, 0.35)' : 'rgba(255, 137, 6, 0.35)',
            }}
          >
            {idleConfig.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div className="card-content">
          <div className="row-actions" style={{ marginBottom: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className={`action-btn ${idleConfig.enabled ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onUpdateIdleConfig({ ...idleConfig, enabled: !idleConfig.enabled })}
            >
              Vertical Bob: {idleConfig.enabled ? 'ON' : 'OFF'}
            </button>
            <button
              className={`action-btn ${idleConfig.dimWhenSilent ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() =>
                onUpdateIdleConfig({
                  ...idleConfig,
                  dimWhenSilent: !idleConfig.dimWhenSilent,
                })
              }
              title="Otomatis meredupkan/menggelapkan avatar saat diam, dan cerah kembali saat berbicara"
            >
              Idle Dimming: {idleConfig.dimWhenSilent ? 'ON' : 'OFF'} 🌙
            </button>
          </div>

          <div className="slider-group">
            <div className="slider-row">
              <label>
                Amplitude ({idleConfig.amplitude}px) — bob height
              </label>
              <input
                type="range"
                min="0"
                max="50"
                step="1"
                value={idleConfig.amplitude}
                disabled={!idleConfig.enabled}
                onChange={(e) =>
                  onUpdateIdleConfig({
                    ...idleConfig,
                    amplitude: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="slider-row">
              <label>
                Speed ({idleConfig.speed.toFixed(1)}x) — bob frequency
              </label>
              <input
                type="range"
                min="0.1"
                max="5.0"
                step="0.1"
                value={idleConfig.speed}
                disabled={!idleConfig.enabled}
                onChange={(e) =>
                  onUpdateIdleConfig({
                    ...idleConfig,
                    speed: Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="slider-row">
              <label>
                Idle Brightness ({Math.round((idleConfig.idleBrightness ?? 0.75) * 100)}%) — kegelapan saat diam
              </label>
              <input
                type="range"
                min="0.40"
                max="0.95"
                step="0.05"
                value={idleConfig.idleBrightness ?? 0.75}
                disabled={!idleConfig.dimWhenSilent}
                onChange={(e) =>
                  onUpdateIdleConfig({
                    ...idleConfig,
                    idleBrightness: Number(e.target.value),
                  })
                }
              />
            </div>
          </div>
          <p className="card-hint">
            Idle bobbing dan dimming diaplikasikan saat avatar diam, dan kembali cerah & aktif secara otomatis saat berbicara.
          </p>
        </div>
      </div>

      {/* 2. Blink Configuration */}
      <div className="control-card">
        <div className="card-header">
          <span className="card-title">Blink Configuration</span>
          <span
            className={`badge-tag ${blinkConfig.enabled ? 'badge-tag-success' : 'badge-tag-warning'}`}
            style={{
              background: blinkConfig.enabled ? 'rgba(44, 182, 125, 0.15)' : 'rgba(255, 137, 6, 0.15)',
              color: blinkConfig.enabled ? '#2cb67d' : '#ff8906',
              borderColor: blinkConfig.enabled ? 'rgba(44, 182, 125, 0.35)' : 'rgba(255, 137, 6, 0.35)',
            }}
          >
            {blinkConfig.enabled ? 'Auto' : 'Manual'}
          </span>
        </div>
        <div className="card-content">
          <div className="row-actions" style={{ marginBottom: '12px' }}>
            <button
              className={`action-btn ${blinkConfig.enabled ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                const nextEnabled = !blinkConfig.enabled;
                if (nextEnabled) {
                  blinkScheduler.start();
                } else {
                  blinkScheduler.stop();
                }
                onUpdateBlinkConfig({ ...blinkConfig, enabled: nextEnabled });
              }}
            >
              Auto-Blink: {blinkConfig.enabled ? 'ON' : 'OFF'}
            </button>
            <button
              className="action-btn btn-outline"
              onClick={() => blinkScheduler.triggerManualBlink()}
            >
              Test Blink 👁️
            </button>
          </div>

          <div className="slider-group">
            <div className="slider-row">
              <label>
                Min Interval ({(blinkConfig.minIntervalMs / 1000).toFixed(1)}s)
              </label>
              <input
                type="range"
                min="1000"
                max="10000"
                step="500"
                value={blinkConfig.minIntervalMs}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const safeMax = Math.max(val, blinkConfig.maxIntervalMs);
                  const updated: BlinkSettings = {
                    ...blinkConfig,
                    minIntervalMs: val,
                    maxIntervalMs: safeMax,
                  };
                  onUpdateBlinkConfig(updated);
                  blinkScheduler.updateConfig({
                    minIntervalMs: val,
                    maxIntervalMs: safeMax,
                    blinkDurationMs: blinkConfig.durationMs,
                  });
                }}
              />
            </div>

            <div className="slider-row">
              <label>
                Max Interval ({(blinkConfig.maxIntervalMs / 1000).toFixed(1)}s)
              </label>
              <input
                type="range"
                min="2000"
                max="15000"
                step="500"
                value={blinkConfig.maxIntervalMs}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const safeMin = Math.min(val, blinkConfig.minIntervalMs);
                  const updated: BlinkSettings = {
                    ...blinkConfig,
                    minIntervalMs: safeMin,
                    maxIntervalMs: val,
                  };
                  onUpdateBlinkConfig(updated);
                  blinkScheduler.updateConfig({
                    minIntervalMs: safeMin,
                    maxIntervalMs: val,
                    blinkDurationMs: blinkConfig.durationMs,
                  });
                }}
              />
            </div>

            <div className="slider-row">
              <label>Duration ({blinkConfig.durationMs}ms)</label>
              <input
                type="range"
                min="50"
                max="500"
                step="25"
                value={blinkConfig.durationMs}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const updated: BlinkSettings = {
                    ...blinkConfig,
                    durationMs: val,
                  };
                  onUpdateBlinkConfig(updated);
                  blinkScheduler.updateConfig({ blinkDurationMs: val });
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Talking / VAD Configuration */}
      <div className="control-card">
        <div className="card-header">
          <span className="card-title">Microphone & VAD</span>
          <span className="card-sub">Voice Detection</span>
        </div>
        <div className="card-content">
          {/* Device Selector */}
          <div className="slider-row" style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Microphone Device</label>
              <button
                type="button"
                className="action-btn btn-outline"
                style={{ padding: '2px 6px', fontSize: '11px' }}
                onClick={refreshDevices}
                title="Refresh audio input devices"
              >
                🔄 Refresh
              </button>
            </div>
            <select
              className="device-select"
              style={{
                background: '#1a1926',
                color: '#fffffe',
                border: '1px solid #2e2c40',
                borderRadius: '6px',
                padding: '6px 8px',
                width: '100%',
                marginTop: '4px',
              }}
              value={selectedDeviceId}
              onChange={handleDeviceChange}
              disabled={isLoadingDevices}
            >
              {isLoadingDevices ? (
                <option value="" disabled>
                  Loading devices...
                </option>
              ) : audioDevices.length === 0 ? (
                <option value="" disabled>
                  No devices found
                </option>
              ) : (
                audioDevices.map((dev, idx) => (
                  <option key={dev.deviceId || idx} value={dev.deviceId}>
                    {dev.label || `Microphone ${idx + 1}`}
                  </option>
                ))
              )}
            </select>
          </div>

          <button
            className={`action-btn-large ${isMicActive ? 'mic-active' : ''}`}
            onClick={handleToggleMic}
            style={{ marginBottom: '12px' }}
          >
            <span className="btn-icon">{isMicActive ? '🎙️' : '🎤'}</span>
            <span>{isMicActive ? 'Mic Active (Listening)' : 'Start Microphone'}</span>
          </button>

          {micError && <div className="error-banner">{micError}</div>}

          {/* Real-time Audio Meter */}
          <AudioMeter
            store={store}
            threshold={audioConfig.threshold}
            isListening={isMicActive}
          />

          {/* Sliders */}
          <div className="slider-group" style={{ marginTop: '12px' }}>
            <div className="slider-row">
              <label>
                Threshold ({Math.round(audioConfig.threshold * 100)}%) — trigger point
              </label>
              <input
                type="range"
                min="0.01"
                max="0.50"
                step="0.01"
                aria-label="Voice threshold"
                value={audioConfig.threshold}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateAudioConfig({ ...audioConfig, threshold: val });
                  audioVAD.updateConfig({ threshold: val });
                }}
              />
            </div>

            <div className="slider-row">
              <label>
                Sensitivity ({audioConfig.sensitivity.toFixed(1)}x) — microphone boost
              </label>
              <input
                type="range"
                min="1.0"
                max="10.0"
                step="0.5"
                aria-label="Microphone sensitivity"
                value={audioConfig.sensitivity}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateAudioConfig({ ...audioConfig, sensitivity: val });
                  audioVAD.updateConfig({ sensitivity: val });
                }}
              />
            </div>

            <div className="slider-row">
              <label>
                Speaking Release Delay ({audioConfig.releaseDelayMs}ms) — jeda mulut & kecerahan
              </label>
              <input
                type="range"
                min="50"
                max="1000"
                step="25"
                aria-label="Speaking release delay"
                value={audioConfig.releaseDelayMs}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  onUpdateAudioConfig({ ...audioConfig, releaseDelayMs: val });
                  audioVAD.updateConfig({ releaseDelayMs: val });
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Ambient Noise Auto-Calibration */}
      <div className="control-card">
        <div className="card-header">
          <span className="card-title">Ambient Noise Calibrator</span>
          <span className="card-sub">Room Acoustics</span>
        </div>
        <div className="card-content">
          <p className="card-hint" style={{ marginTop: 0 }}>
            Ukur kebisingan ruangan selama 2 detik dalam keadaan hening untuk menentukan batas aktivasi suara yang optimal.
          </p>

          <button
            className="action-btn-large"
            onClick={handleStartCalibration}
            disabled={isCalibrating}
            style={{
              background: isCalibrating ? '#7f5af0' : 'rgba(127, 90, 240, 0.2)',
              borderColor: '#7f5af0',
              color: '#fffffe',
            }}
          >
            <span className="btn-icon">⚡</span>
            <span>{isCalibrating ? `Calibrating... (${calibrationProgress}%)` : 'Auto Calibrate Ambient Noise'}</span>
          </button>

          {isCalibrating && (
            <div style={{ marginTop: '8px', height: '4px', background: '#2e2c40', borderRadius: '2px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${calibrationProgress}%`,
                  background: '#7f5af0',
                  transition: 'width 0.1s linear',
                }}
              />
            </div>
          )}

          {calibrationResult && (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'rgba(44, 182, 125, 0.1)',
                border: '1px solid rgba(44, 182, 125, 0.3)',
                fontSize: '12px',
                color: '#94a1b2',
              }}
            >
              <div style={{ color: '#2cb67d', fontWeight: 'bold', marginBottom: '4px' }}>
                ✓ Calibration Complete
              </div>
              <div>Noise Floor (P90): {Math.round(calibrationResult.noiseFloor * 100)}%</div>
              <div>Peak Ambient Noise: {Math.round(calibrationResult.peakNoise * 100)}%</div>
              <div style={{ color: '#fffffe', marginTop: '4px', fontWeight: '600' }}>
                Applied Threshold: {Math.round(calibrationResult.recommendedThreshold * 100)}%
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
