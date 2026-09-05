import React, { useState, useEffect } from 'react';
import { MouthConfig, MouthThresholds } from '../../core/project/types';
import { ParameterStore } from '../../core/parameters/ParameterStore';
import { TalkSimulator } from '../../core/audio/TalkSimulator';
import { DEFAULT_MOUTH_CONFIG } from '../../core/project/defaultProject';

interface MouthMappingPanelProps {
  mouthConfig?: MouthConfig;
  store: ParameterStore;
  talkSimulator: TalkSimulator;
  onUpdateMouthConfig: (config: MouthConfig) => void;
}

export const MouthMappingPanel: React.FC<MouthMappingPanelProps> = ({
  mouthConfig = DEFAULT_MOUTH_CONFIG,
  store,
  talkSimulator,
  onUpdateMouthConfig,
}) => {
  const [thresholds, setThresholds] = useState<MouthThresholds>(mouthConfig.thresholds);
  const [continuousMode, setContinuousMode] = useState<boolean>(mouthConfig.continuousMode);

  // Live Avatar Parameter state
  const [liveVoiceLevel, setLiveVoiceLevel] = useState<number>(0);
  const [liveMouthShape, setLiveMouthShape] = useState<string>('closed');
  const [liveMouthOpen, setLiveMouthOpen] = useState<number>(0);
  const [simLevel, setSimLevel] = useState<number>(0.75);

  // Sync props to state if updated externally
  useEffect(() => {
    if (mouthConfig) {
      setThresholds(mouthConfig.thresholds);
      setContinuousMode(mouthConfig.continuousMode);
    }
  }, [mouthConfig]);

  // Subscribe to live avatar parameter changes
  useEffect(() => {
    const unsub = store.subscribe((params) => {
      setLiveVoiceLevel(params.voiceLevel);
      const rawShape = params.mouthShape || (params.voiceActivity ? 'medium' : 'closed');
      const normalizedShape = rawShape === 'open' ? 'medium' : rawShape;
      setLiveMouthShape(normalizedShape);
      setLiveMouthOpen(params.mouthOpen ?? 0);
    });
    return unsub;
  }, [store]);

  const handleThresholdChange = (key: keyof MouthThresholds, val: number) => {
    const next = { ...thresholds, [key]: val };

    // Enforce ordering: closed <= small <= medium
    if (key === 'closed' && val > next.small) {
      next.small = Math.min(1.0, val + 0.05);
      if (next.small > next.medium) {
        next.medium = Math.min(1.0, next.small + 0.05);
      }
    } else if (key === 'small') {
      if (val < next.closed) next.closed = Math.max(0, val - 0.05);
      if (val > next.medium) next.medium = Math.min(1.0, val + 0.05);
    } else if (key === 'medium') {
      if (val < next.small) {
        next.small = Math.max(0, val - 0.05);
        if (next.small < next.closed) next.closed = Math.max(0, next.small - 0.05);
      }
    }

    setThresholds(next);
    talkSimulator.setThresholds(next);
    onUpdateMouthConfig({
      thresholds: next,
      continuousMode,
    });
  };

  const handleToggleContinuous = () => {
    const nextContinuous = !continuousMode;
    setContinuousMode(nextContinuous);
    onUpdateMouthConfig({
      thresholds,
      continuousMode: nextContinuous,
    });
  };

  const handleSimulateTalk = () => {
    if (talkSimulator.getIsTalking()) {
      talkSimulator.stopTalking();
    } else {
      talkSimulator.startTalking(simLevel);
    }
  };

  const handleSimLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setSimLevel(val);
    if (talkSimulator.getIsTalking()) {
      talkSimulator.startTalking(val);
    }
  };

  return (
    <div className="mouth-mapping-panel" data-testid="mouth-mapping-panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* 1. Live State & Visual Feedback Card */}
      <div className="section-card">
        <div className="section-header-row">
          <span className="section-title">🗣️ Live Mouth Shape</span>
          <span
            className="badge-tag"
            style={{
              background: liveMouthShape === 'closed' ? 'rgba(44, 182, 125, 0.15)' : 'rgba(255, 137, 6, 0.15)',
              color: liveMouthShape === 'closed' ? '#2cb67d' : '#ff8906',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
            {liveMouthShape}
          </span>
        </div>

        {/* 4-Frame Visual Progression Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', margin: '10px 0' }}>
          {[
            { id: 'closed', label: 'Closed', icon: '🤐', range: `< ${Math.round(thresholds.closed * 100)}%` },
            { id: 'small', label: 'Small', icon: '😮', range: `< ${Math.round(thresholds.small * 100)}%` },
            { id: 'medium', label: 'Medium', icon: '🗣️', range: `< ${Math.round(thresholds.medium * 100)}%` },
            { id: 'wide', label: 'Wide', icon: '📢', range: `≥ ${Math.round(thresholds.medium * 100)}%` },
          ].map((frame) => {
            const isActive = liveMouthShape === frame.id || (liveMouthShape === 'open' && frame.id === 'medium');
            return (
              <div
                key={frame.id}
                style={{
                  padding: '8px 4px',
                  borderRadius: '6px',
                  textAlign: 'center',
                  background: isActive ? 'rgba(127, 90, 240, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ fontSize: '18px', marginBottom: '2px' }}>{frame.icon}</div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: isActive ? 'var(--accent-primary)' : 'var(--text-main)' }}>
                  {frame.label}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{frame.range}</div>
              </div>
            );
          })}
        </div>

        {/* Continuous mouthOpen bar */}
        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            <span>Continuous mouthOpen ({Math.round(liveMouthOpen * 100)}%)</span>
            <span>Voice: {Math.round(liveVoiceLevel * 100)}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, Math.round(liveMouthOpen * 100))}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #2cb67d, #ff8906, #ff5470)',
                transition: 'width 0.08s ease-out',
              }}
            />
          </div>
        </div>
      </div>

      {/* 2. Mode Configuration */}
      <div className="section-card">
        <div className="section-header-row">
          <span className="section-title">⚙️ Mapping Mode</span>
          <button
            className={`action-btn ${continuousMode ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '11px', padding: '4px 10px' }}
            onClick={handleToggleContinuous}
          >
            {continuousMode ? 'Continuous Mode: ON' : 'Discrete Mode: 4-Frame'}
          </button>
        </div>
        <p className="section-description" style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '6px 0 0 0' }}>
          {continuousMode
            ? 'Continuous mode interpolates mouthOpen (0.0-1.0) for dynamic frame morphing and future mesh deformation.'
            : 'Discrete mode switches between Closed, Small, Medium, and Wide based on voice volume thresholds.'}
        </p>
      </div>

      {/* 3. Threshold Tuning Sliders */}
      <div className="section-card">
        <div className="section-header-row">
          <span className="section-title">🎚️ Voice Level Thresholds</span>
        </div>

        <div className="slider-group" style={{ marginTop: '8px' }}>
          <div className="slider-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
              <label>Closed Threshold (Silence Deadzone)</label>
              <span style={{ fontFamily: 'monospace' }}>{Math.round(thresholds.closed * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.02"
              max="0.30"
              step="0.01"
              value={thresholds.closed}
              onChange={(e) => handleThresholdChange('closed', parseFloat(e.target.value))}
            />
          </div>

          <div className="slider-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
              <label>Small Mouth Trigger (Soft Speech)</label>
              <span style={{ fontFamily: 'monospace' }}>{Math.round(thresholds.small * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.15"
              max="0.55"
              step="0.01"
              value={thresholds.small}
              onChange={(e) => handleThresholdChange('small', parseFloat(e.target.value))}
            />
          </div>

          <div className="slider-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
              <label>Medium Mouth Trigger (Normal Speech)</label>
              <span style={{ fontFamily: 'monospace' }}>{Math.round(thresholds.medium * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.40"
              max="0.85"
              step="0.01"
              value={thresholds.medium}
              onChange={(e) => handleThresholdChange('medium', parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* 4. Manual Voice Simulation Tester */}
      <div className="section-card">
        <div className="section-header-row">
          <span className="section-title">🧪 Voice Simulation Tester</span>
          <button
            className={`action-btn ${talkSimulator.getIsTalking() ? 'talking-active' : 'btn-outline'}`}
            style={{ fontSize: '11px', padding: '4px 10px' }}
            onClick={handleSimulateTalk}
          >
            {talkSimulator.getIsTalking() ? '⏹ Stop' : '▶ Simulate'}
          </button>
        </div>

        <div className="slider-group" style={{ marginTop: '8px' }}>
          <div className="slider-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
              <label>Test Voice Level</label>
              <span style={{ fontFamily: 'monospace' }}>{Math.round(simLevel * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              value={simLevel}
              onChange={handleSimLevelChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
