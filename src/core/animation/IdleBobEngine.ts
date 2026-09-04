import { IdleConfig } from '../project/types';

export const DEFAULT_IDLE_CONFIG: Readonly<IdleConfig> = {
  enabled: true,
  amplitude: 8,
  speed: 1.5,
};

/**
 * Deterministic idle bobbing engine.
 * Computes a smooth sinusoidal vertical Y offset for the avatar's body layer.
 */
export class IdleBobEngine {
  /**
   * Calculates vertical Y offset in pixels.
   * @param timeMs - Current timestamp in milliseconds (e.g. from performance.now()).
   * @param config - Current idle configuration (enabled, amplitude, speed).
   * @param isIdle - True when avatar is not speaking (voiceActivity is false).
   */
  public static calculateOffset(
    timeMs: number,
    config?: IdleConfig | null,
    isIdle: boolean = true
  ): number {
    if (!config || !config.enabled || config.amplitude <= 0 || !isIdle) {
      return 0;
    }

    const timeSeconds = timeMs / 1000;
    // Standard sinusoidal wave: period = 1 / speed seconds
    return Math.sin(timeSeconds * config.speed * Math.PI * 2) * config.amplitude;
  }
}
