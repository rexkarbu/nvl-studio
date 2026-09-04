import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ParameterStore } from '../core/parameters/ParameterStore';
import { BlinkScheduler } from '../core/animation/BlinkScheduler';

describe('BlinkScheduler', () => {
  let store: ParameterStore;
  let scheduler: BlinkScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new ParameterStore();
    scheduler = new BlinkScheduler(store, {
      minIntervalMs: 1000,
      maxIntervalMs: 2000,
      blinkDurationMs: 150,
    });
  });

  afterEach(() => {
    scheduler.stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('triggers manual blink and restores open state after blinkDurationMs', () => {
    scheduler.triggerManualBlink();
    expect(store.getSnapshot().blink).toBe(true);

    vi.advanceTimersByTime(150);
    expect(store.getSnapshot().blink).toBe(false);
  });

  it('autonomously toggles blink state on and off during run cycle', () => {
    scheduler.start();
    expect(scheduler.getIsRunning()).toBe(true);
    expect(store.getSnapshot().blink).toBe(false);

    // Advance to interval timer
    vi.advanceTimersToNextTimer();
    expect(store.getSnapshot().blink).toBe(true);

    // Advance to close timer (blink duration)
    vi.advanceTimersToNextTimer();
    expect(store.getSnapshot().blink).toBe(false);
  });

  it('stops cleanly and guarantees blink is set to false', () => {
    scheduler.start();
    vi.advanceTimersToNextTimer(); // Eyes closed in blink
    expect(store.getSnapshot().blink).toBe(true);

    scheduler.stop();
    expect(scheduler.getIsRunning()).toBe(false);
    expect(store.getSnapshot().blink).toBe(false);
  });

  it('exposes getConfig and immediately reschedules when updateConfig is called while running', () => {
    const customScheduler = new BlinkScheduler(store, {
      minIntervalMs: 10000,
      maxIntervalMs: 20000,
      blinkDurationMs: 200,
    });

    expect(customScheduler.getConfig()).toEqual({
      minIntervalMs: 10000,
      maxIntervalMs: 20000,
      blinkDurationMs: 200,
    });

    customScheduler.start();
    // Advance 500ms (far before 10000ms)
    vi.advanceTimersByTime(500);
    expect(store.getSnapshot().blink).toBe(false);

    // Update config to short interval (300-400ms)
    customScheduler.updateConfig({
      minIntervalMs: 300,
      maxIntervalMs: 400,
    });

    expect(customScheduler.getConfig().minIntervalMs).toBe(300);

    // Advance 400ms - with immediate reschedule, the blink triggers now!
    vi.advanceTimersByTime(400);
    expect(store.getSnapshot().blink).toBe(true);

    customScheduler.stop();
  });
});
