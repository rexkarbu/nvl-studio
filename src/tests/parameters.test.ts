import { describe, it, expect, vi } from 'vitest';
import { ParameterStore, DEFAULT_AVATAR_PARAMETERS } from '../core/parameters/ParameterStore';

describe('ParameterStore', () => {
  it('initializes with default parameter values', () => {
    const store = new ParameterStore();
    expect(store.getSnapshot()).toEqual(DEFAULT_AVATAR_PARAMETERS);
    expect(store.getSequence()).toBe(0);
  });

  it('updates parameter state and increments sequence counter', () => {
    const store = new ParameterStore();
    store.update({ voiceActivity: true, voiceLevel: 0.8 });

    const snap = store.getSnapshot();
    expect(snap.voiceActivity).toBe(true);
    expect(snap.voiceLevel).toBe(0.8);
    expect(snap.blink).toBe(false);
    expect(store.getSequence()).toBe(1);
  });

  it('does not increment sequence or notify listeners if values are unchanged', () => {
    const store = new ParameterStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.update({ voiceActivity: false }); // Already false
    expect(store.getSequence()).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies subscribers with new parameters and sequence', () => {
    const store = new ParameterStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.update({ blink: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ blink: true, voiceActivity: false }),
      1
    );

    unsubscribe();
    store.update({ blink: false });
    expect(listener).toHaveBeenCalledTimes(1); // Not called after unsubscribe
  });

  it('resets parameters back to default', () => {
    const store = new ParameterStore();
    store.update({ voiceActivity: true, blink: true });
    expect(store.getSnapshot().voiceActivity).toBe(true);

    store.reset();
    expect(store.getSnapshot()).toEqual(DEFAULT_AVATAR_PARAMETERS);
  });
});
