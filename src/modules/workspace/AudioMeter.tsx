import React, { useEffect, useState } from 'react';
import { ParameterStore } from '../../core/parameters/ParameterStore';

export interface AudioMeterProps {
  store: ParameterStore;
  threshold: number;
  label?: string;
  isListening?: boolean;
}

export const AudioMeter: React.FC<AudioMeterProps> = ({
  store,
  threshold,
  label = 'Input Level',
  isListening = true,
}) => {
  const [level, setLevel] = useState<number>(() => store.getSnapshot().voiceLevel);
  const [isActive, setIsActive] = useState<boolean>(() => store.getSnapshot().voiceActivity);

  useEffect(() => {
    const unsubscribe = store.subscribe((params) => {
      setLevel(params.voiceLevel);
      setIsActive(params.voiceActivity);
    });
    return unsubscribe;
  }, [store]);

  const displayLevel = isListening ? level : 0;
  const pct = Math.round(Math.min(100, Math.max(0, displayLevel * 100)));
  const thresholdPct = Math.round(Math.min(100, Math.max(0, threshold * 100)));
  const isTriggered = isListening && (displayLevel >= threshold || isActive);

  return (
    <div className="audio-meter-wrapper" data-testid="audio-meter">
      <div className="meter-labels">
        <span>{label}</span>
        <span
          data-testid="meter-percentage"
          style={{
            fontWeight: isTriggered ? 'bold' : 'normal',
            color: isTriggered ? '#ff5470' : 'inherit',
          }}
        >
          {pct}% {isTriggered ? '(VOICE DETECTED)' : ''}
        </span>
      </div>
      <div className="audio-meter-track" data-testid="meter-track">
        <div
          data-testid="meter-fill"
          className={`audio-meter-fill ${isTriggered ? 'active' : ''}`}
          style={{ width: `${pct}%` }}
        />
        <div
          data-testid="meter-threshold"
          className="meter-threshold-marker"
          style={{ left: `${thresholdPct}%` }}
          title={`Activation Threshold: ${thresholdPct}%`}
        />
      </div>
    </div>
  );
};
