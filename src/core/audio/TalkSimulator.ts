import { ParameterStore } from '../parameters/ParameterStore';
import { deriveMouthShape, deriveMouthOpen, DEFAULT_MOUTH_THRESHOLDS } from './MouthShapeMapper';
import { MouthThresholds } from '../project/types';

/**
 * Manual speech simulator.
 * Allows instant testing of talking states, layer switching, and WebSocket dispatch
 * without requiring microphone hardware or audio permissions.
 */
export class TalkSimulator {
  private store: ParameterStore;
  private isTalking: boolean = false;
  private thresholds: MouthThresholds = { ...DEFAULT_MOUTH_THRESHOLDS };

  constructor(store: ParameterStore, thresholds?: MouthThresholds) {
    this.store = store;
    if (thresholds) {
      this.thresholds = { ...thresholds };
    }
  }

  public setThresholds(thresholds: MouthThresholds): void {
    this.thresholds = { ...thresholds };
  }

  public startTalking(level: number = 0.75, mouthShape?: string, mouthOpen?: number): void {
    this.isTalking = true;
    const clampedLevel = Math.max(0, Math.min(1, level));
    const resolvedShape = mouthShape || deriveMouthShape(clampedLevel, this.thresholds);
    const resolvedOpen = typeof mouthOpen === 'number' ? mouthOpen : deriveMouthOpen(clampedLevel, this.thresholds);

    this.store.update({
      voiceActivity: true,
      voiceLevel: clampedLevel,
      mouthShape: resolvedShape,
      mouthOpen: resolvedOpen,
    });
  }

  public stopTalking(): void {
    this.isTalking = false;
    this.store.update({
      voiceActivity: false,
      voiceLevel: 0,
      mouthShape: 'closed',
      mouthOpen: 0,
    });
  }

  public toggle(level: number = 0.75, mouthShape?: string, mouthOpen?: number): boolean {
    if (this.isTalking) {
      this.stopTalking();
    } else {
      this.startTalking(level, mouthShape, mouthOpen);
    }
    return this.isTalking;
  }

  public getIsTalking(): boolean {
    return this.isTalking;
  }
}
