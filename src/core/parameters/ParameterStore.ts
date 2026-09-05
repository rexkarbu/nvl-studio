import { AvatarParameters, ParameterListener } from './types';

export const DEFAULT_AVATAR_PARAMETERS: Readonly<AvatarParameters> = {
  voiceActivity: false,
  voiceLevel: 0,
  blink: false,
  mouthShape: 'closed',
  mouthOpen: 0,
};

/**
 * Central state bus for avatar parameters.
 * Manages current parameters, monotonic sequence counter, and subscriber notifications.
 */
export class ParameterStore {
  private currentParams: AvatarParameters;
  private sequence: number = 0;
  private listeners: Set<ParameterListener> = new Set();

  constructor(initialParams: Partial<AvatarParameters> = {}) {
    this.currentParams = {
      ...DEFAULT_AVATAR_PARAMETERS,
      ...initialParams,
    };
  }

  /**
   * Returns a copy of the current avatar parameters.
   */
  public getSnapshot(): AvatarParameters {
    return { ...this.currentParams };
  }

  /**
   * Returns the current monotonic sequence counter.
   */
  public getSequence(): number {
    return this.sequence;
  }

  /**
   * Updates one or more parameters.
   * Increments sequence and notifies listeners only if values have changed.
   */
  public update(partial: Partial<AvatarParameters>): void {
    let hasChanged = false;

    for (const key of Object.keys(partial) as Array<keyof AvatarParameters>) {
      const newVal = partial[key];
      const oldVal = this.currentParams[key];

      if (newVal !== undefined && newVal !== oldVal) {
        hasChanged = true;
        (this.currentParams as any)[key] = newVal;
      }
    }

    if (hasChanged) {
      this.sequence += 1;
      const snapshot = this.getSnapshot();
      for (const listener of this.listeners) {
        try {
          listener(snapshot, this.sequence);
        } catch (err) {
          console.error('[ParameterStore] Listener error:', err);
        }
      }
    }
  }

  /**
   * Subscribes a listener to parameter changes.
   * Returns an unsubscribe function.
   */
  public subscribe(listener: ParameterListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Resets parameters back to default and notifies listeners.
   */
  public reset(): void {
    this.currentParams = { ...DEFAULT_AVATAR_PARAMETERS };
    this.sequence += 1;
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot, this.sequence);
    }
  }
}
