import { ParameterStore } from '../parameters/ParameterStore';

export interface BlinkConfig {
  minIntervalMs: number; // e.g. 2500ms
  maxIntervalMs: number; // e.g. 6000ms
  blinkDurationMs: number; // e.g. 140ms
}

export const DEFAULT_BLINK_CONFIG: Readonly<BlinkConfig> = {
  minIntervalMs: 2500,
  maxIntervalMs: 6000,
  blinkDurationMs: 140,
};

/**
 * Autonomous blink scheduler.
 * Randomly toggles `parameters.blink` on and off without blocking the main loop.
 */
export class BlinkScheduler {
  private store: ParameterStore;
  private config: BlinkConfig;
  private isRunning: boolean = false;
  private intervalTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(store: ParameterStore, config: Partial<BlinkConfig> = {}) {
    this.store = store;
    this.config = { ...DEFAULT_BLINK_CONFIG, ...config };
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNextBlink();
  }

  public stop(): void {
    this.isRunning = false;
    this.clearTimers();
    // Ensure eyes are left open when stopped
    this.store.update({ blink: false });
  }

  public triggerManualBlink(): void {
    this.clearTimers();
    this.store.update({ blink: true });

    this.closeTimer = setTimeout(() => {
      this.store.update({ blink: false });
      if (this.isRunning) {
        this.scheduleNextBlink();
      }
    }, this.config.blinkDurationMs);
  }

  public updateConfig(newConfig: Partial<BlinkConfig>): void {
    this.config = { ...this.config, ...newConfig };
    if (this.isRunning) {
      this.clearTimers();
      this.store.update({ blink: false });
      this.scheduleNextBlink();
    }
  }

  public getConfig(): Readonly<BlinkConfig> {
    return { ...this.config };
  }

  public getIsRunning(): boolean {
    return this.isRunning;
  }

  private scheduleNextBlink(): void {
    if (!this.isRunning) return;

    const delay =
      this.config.minIntervalMs +
      Math.random() * (this.config.maxIntervalMs - this.config.minIntervalMs);

    this.intervalTimer = setTimeout(() => {
      if (!this.isRunning) return;
      this.store.update({ blink: true });

      this.closeTimer = setTimeout(() => {
        if (!this.isRunning) return;
        this.store.update({ blink: false });
        this.scheduleNextBlink();
      }, this.config.blinkDurationMs);
    }, delay);
  }

  private clearTimers(): void {
    if (this.intervalTimer !== null) {
      clearTimeout(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }
}
