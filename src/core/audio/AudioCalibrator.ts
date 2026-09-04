import { AudioVAD } from './AudioVAD';

export interface CalibrationResult {
  noiseFloor: number;
  peakNoise: number;
  recommendedThreshold: number;
  durationMs: number;
}

/**
 * Ambient room noise measurement and threshold calibrator.
 */
export class AudioCalibrator {
  /**
   * Calculates a recommended voice activation threshold from an ambient noise floor.
   * Suggested formula: noiseFloor * 1.30 + 0.02 margin, clamped to [0.02, 0.50].
   */
  public static calculateRecommendedThreshold(
    noiseFloor: number,
    margin?: number
  ): number {
    const raw = margin !== undefined ? noiseFloor + margin : noiseFloor * 1.3;
    const clamped = Math.max(0.02, Math.min(0.5, raw));
    return Math.round(clamped * 1000) / 1000;
  }

  /**
   * Analyzes an array of raw level samples to determine the effective noise floor.
   * Uses 90th percentile to discard isolated audio clicks/bursts.
   */
  public static measureNoiseFloor(samples: number[]): {
    p90: number;
    peak: number;
    average: number;
  } {
    if (!samples || samples.length === 0) {
      return { p90: 0, peak: 0, average: 0 };
    }

    let sum = 0;
    let peak = 0;

    for (const val of samples) {
      sum += val;
      if (val > peak) peak = val;
    }

    const average = sum / samples.length;

    // Calculate 90th percentile
    const sorted = [...samples].sort((a, b) => a - b);
    const p90Index = Math.min(
      sorted.length - 1,
      Math.floor(sorted.length * 0.9)
    );
    const p90 = sorted[p90Index];

    return {
      p90: Math.round(p90 * 1000) / 1000,
      peak: Math.round(peak * 1000) / 1000,
      average: Math.round(average * 1000) / 1000,
    };
  }

  /**
   * Measures ambient noise from an active AudioVAD instance for the specified duration.
   */
  public static async calibrateAmbient(
    vad: AudioVAD,
    durationMs: number = 2000,
    onProgress?: (progressPct: number) => void
  ): Promise<CalibrationResult> {
    if (!vad.getIsRunning()) {
      throw new Error('AudioVAD must be running to calibrate');
    }

    const samples: number[] = [];
    const startTime = performance.now();

    return new Promise((resolve) => {
      const sampleLoop = () => {
        const elapsed = performance.now() - startTime;
        const currentLevel = vad.getCurrentLevel();
        samples.push(currentLevel);

        const progress = Math.min(100, Math.round((elapsed / durationMs) * 100));
        if (onProgress) {
          onProgress(progress);
        }

        if (elapsed < durationMs) {
          requestAnimationFrame(sampleLoop);
        } else {
          const { p90, peak } = AudioCalibrator.measureNoiseFloor(samples);
          const recommended = AudioCalibrator.calculateRecommendedThreshold(p90);

          resolve({
            noiseFloor: p90,
            peakNoise: peak,
            recommendedThreshold: recommended,
            durationMs,
          });
        }
      };

      sampleLoop();
    });
  }
}
