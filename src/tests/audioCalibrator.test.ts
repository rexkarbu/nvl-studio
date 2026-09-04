import { describe, it, expect } from 'vitest';
import { AudioCalibrator } from '../core/audio/AudioCalibrator';

describe('AudioCalibrator', () => {
  describe('calculateRecommendedThreshold', () => {
    it('calculates noiseFloor + 30% when margin is omitted', () => {
      // 0.10 * 1.30 = 0.13
      expect(AudioCalibrator.calculateRecommendedThreshold(0.1)).toBe(0.13);

      // 0.20 * 1.30 = 0.26
      expect(AudioCalibrator.calculateRecommendedThreshold(0.2)).toBe(0.26);
    });

    it('calculates noiseFloor + custom margin when provided', () => {
      // 0.10 + 0.05 = 0.15
      expect(AudioCalibrator.calculateRecommendedThreshold(0.1, 0.05)).toBe(0.15);

      // 0.12 + 0.08 = 0.20
      expect(AudioCalibrator.calculateRecommendedThreshold(0.12, 0.08)).toBe(0.2);
    });

    it('clamps threshold to lower bound 0.02', () => {
      // 0.005 * 1.30 = 0.0065 -> clamped to 0.02
      expect(AudioCalibrator.calculateRecommendedThreshold(0.005)).toBe(0.02);

      // 0.001 + 0.005 = 0.006 -> clamped to 0.02
      expect(AudioCalibrator.calculateRecommendedThreshold(0.001, 0.005)).toBe(0.02);
    });

    it('clamps threshold to upper bound 0.50', () => {
      // 0.50 * 1.30 = 0.65 -> clamped to 0.50
      expect(AudioCalibrator.calculateRecommendedThreshold(0.5)).toBe(0.5);

      // 0.40 + 0.25 = 0.65 -> clamped to 0.50
      expect(AudioCalibrator.calculateRecommendedThreshold(0.4, 0.25)).toBe(0.5);
    });
  });

  describe('measureNoiseFloor', () => {
    it('calculates 90th percentile to discard transient spikes', () => {
      // 10 samples: 9 ambient levels around 0.05 and 1 transient spike at 0.90
      const samples = [
        0.04, 0.05, 0.05, 0.06, 0.04, 0.05, 0.05, 0.06, 0.05, 0.9,
      ];

      const result = AudioCalibrator.measureNoiseFloor(samples);

      // 90th percentile index: Math.floor(10 * 0.9) = 9 (which is 0.90) or index 8 (0.06)
      // Discards lower 90% and captures the ambient boundary
      expect(result.p90).toBeLessThanOrEqual(0.9);
      expect(result.peak).toBe(0.9);
      expect(result.average).toBeGreaterThan(0.05);
    });

    it('accurately computes 90th percentile from a distribution', () => {
      // 100 samples from 0.01 to 1.00
      const samples = Array.from({ length: 100 }, (_, i) => (i + 1) / 100);
      const result = AudioCalibrator.measureNoiseFloor(samples);

      // Sorted index Math.floor(100 * 0.9) = 90 -> sample 0.91
      expect(result.p90).toBeCloseTo(0.91, 2);
      expect(result.peak).toBe(1.0);
    });

    it('handles empty sample arrays gracefully', () => {
      const result = AudioCalibrator.measureNoiseFloor([]);
      expect(result).toEqual({ p90: 0, peak: 0, average: 0 });
    });
  });
});
