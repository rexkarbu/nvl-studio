import { ParameterStore } from '../parameters/ParameterStore';
import { MouthThresholds } from '../project/types';
import { deriveMouthShape, deriveMouthOpen, DEFAULT_MOUTH_THRESHOLDS } from './MouthShapeMapper';

export interface VADConfig {
  threshold: number;      // 0.01 - 1.0 (default: 0.05)
  sensitivity: number;    // 1.0 - 10.0 (default: 3.5 multiplier)
  releaseDelayMs: number; // default: 200ms before returning to idle
}

export const DEFAULT_VAD_CONFIG: Readonly<VADConfig> = {
  threshold: 0.05,
  sensitivity: 3.5,
  releaseDelayMs: 200,
};

/**
 * Voice Activity Detection using native Web Audio API.
 * Features:
 * - Auto-resumes AudioContext to avoid Chromium suspended state.
 * - Hardware AutoGainControl & NoiseSuppression constraints.
 * - RMS + Peak envelope detection for fast consonant response.
 * - Auto-calibration routine to adapt to ambient noise floor.
 */
export class AudioVAD {
  private store: ParameterStore;
  private config: VADConfig;
  private mouthThresholds: MouthThresholds = { ...DEFAULT_MOUTH_THRESHOLDS };
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animFrameId: number | null = null;

  private isRunning: boolean = false;
  private currentRawLevel: number = 0;
  private lastActiveTimestamp: number = 0;
  private disconnectListeners: Set<() => void> = new Set();

  constructor(store: ParameterStore, config: Partial<VADConfig> = {}, mouthThresholds?: MouthThresholds) {
    this.store = store;
    this.config = { ...DEFAULT_VAD_CONFIG, ...config };
    if (mouthThresholds) {
      this.mouthThresholds = { ...mouthThresholds };
    }
  }

  public setMouthThresholds(thresholds: MouthThresholds): void {
    this.mouthThresholds = { ...thresholds };
  }

  public getMouthThresholds(): MouthThresholds {
    return { ...this.mouthThresholds };
  }

  public onDeviceDisconnected(callback: () => void): () => void {
    this.disconnectListeners.add(callback);
    return () => this.disconnectListeners.delete(callback);
  }

  public async start(deviceId?: string): Promise<void> {
    if (this.isRunning) return;

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    if (deviceId) {
      audioConstraints.deviceId = { exact: deviceId };
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: false,
    });

    // Monitor track ended (device unplugged / permissions revoked)
    this.mediaStream.getAudioTracks().forEach((track) => {
      track.onended = () => {
        console.warn('[AudioVAD] Microphone track ended (device disconnected)');
        this.stop();
        this.disconnectListeners.forEach((cb) => cb());
      };
    });

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.audioCtx = new AudioContextClass();

    // Critical for Chromium: resume suspended context
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.2;

    this.source = this.audioCtx.createMediaStreamSource(this.mediaStream);
    this.source.connect(this.analyser);

    this.isRunning = true;
    this.loop();
  }

  public stop(): void {
    this.isRunning = false;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    this.currentRawLevel = 0;
    this.store.update({
      voiceActivity: false,
      voiceLevel: 0,
      mouthShape: 'closed',
      mouthOpen: 0,
    });
  }

  /**
   * Samples ambient room noise for calibration and auto-configures threshold.
   */
  public async autoCalibrate(durationMs: number = 1500): Promise<number> {
    if (!this.isRunning || !this.analyser) {
      throw new Error('Microphone must be active to calibrate');
    }

    const startTime = performance.now();
    let maxAmbient = 0;

    return new Promise((resolve) => {
      const sample = () => {
        if (this.currentRawLevel > maxAmbient) {
          maxAmbient = this.currentRawLevel;
        }

        if (performance.now() - startTime < durationMs) {
          requestAnimationFrame(sample);
        } else {
          // Suggested threshold: 30% above ambient peak, clamped [0.03, 0.40]
          const suggested = Math.max(0.03, Math.min(0.40, maxAmbient * 1.35 + 0.02));
          const rounded = Math.round(suggested * 100) / 100;
          this.config.threshold = rounded;
          resolve(rounded);
        }
      };
      sample();
    });
  }

  public updateConfig(newConfig: Partial<VADConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): VADConfig {
    return { ...this.config };
  }

  public getCurrentLevel(): number {
    return this.currentRawLevel;
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  private loop = (): void => {
    if (!this.isRunning || !this.analyser) return;

    const dataArray = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(dataArray);

    // Calculate RMS and Peak
    let sum = 0;
    let maxPeak = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const sample = dataArray[i];
      sum += sample * sample;
      const abs = Math.abs(sample);
      if (abs > maxPeak) maxPeak = abs;
    }
    const rawRms = Math.sqrt(sum / dataArray.length);

    // Blend RMS and peak envelope for fast consonant response
    const combinedEnergy = rawRms * 0.65 + maxPeak * 0.35;
    const amplifiedLevel = Math.min(1.0, combinedEnergy * this.config.sensitivity);
    this.currentRawLevel = amplifiedLevel;

    const now = performance.now();
    const isAboveThreshold = amplifiedLevel >= this.config.threshold;
    const isWithinRelease = !isAboveThreshold && (now - this.lastActiveTimestamp < this.config.releaseDelayMs);
    const isSpeaking = isAboveThreshold || isWithinRelease;

    if (isAboveThreshold) {
      this.lastActiveTimestamp = now;
    }

    if (isSpeaking) {
      const mouthShape = deriveMouthShape(amplifiedLevel, this.mouthThresholds);
      const mouthOpen = deriveMouthOpen(amplifiedLevel, this.mouthThresholds);
      this.store.update({
        voiceActivity: true,
        voiceLevel: amplifiedLevel,
        mouthShape,
        mouthOpen,
      });
    } else {
      this.store.update({
        voiceActivity: false,
        voiceLevel: 0,
        mouthShape: 'closed',
        mouthOpen: 0,
      });
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };
}
