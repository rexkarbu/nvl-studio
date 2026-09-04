import { ParameterStore } from '../parameters/ParameterStore';

/**
 * Manual speech simulator.
 * Allows instant testing of talking states, layer switching, and WebSocket dispatch
 * without requiring microphone hardware or audio permissions.
 */
export class TalkSimulator {
  private store: ParameterStore;
  private isTalking: boolean = false;

  constructor(store: ParameterStore) {
    this.store = store;
  }

  public startTalking(level: number = 0.75): void {
    this.isTalking = true;
    this.store.update({
      voiceActivity: true,
      voiceLevel: Math.max(0, Math.min(1, level)),
    });
  }

  public stopTalking(): void {
    this.isTalking = false;
    this.store.update({
      voiceActivity: false,
      voiceLevel: 0,
    });
  }

  public toggle(level: number = 0.75): boolean {
    if (this.isTalking) {
      this.stopTalking();
    } else {
      this.startTalking(level);
    }
    return this.isTalking;
  }

  public getIsTalking(): boolean {
    return this.isTalking;
  }
}
