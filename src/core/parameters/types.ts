/**
 * Extensible Avatar Parameters contract for NVL.
 * Decoupled from specific input devices or rendering implementations.
 */
export interface AvatarParameters {
  /** True when voice activity is detected or speech is simulated */
  voiceActivity: boolean;
  /** Normalized voice amplitude level [0.0 - 1.0] */
  voiceLevel: number;
  /** True when eyes are closed in a blink */
  blink: boolean;
  /** Extensible mouth shape e.g. 'closed' | 'open' | 'small' | 'wide' */
  mouthShape?: string;
  /** Continuous mouth open value [0.0 - 1.0] */
  mouthOpen?: number;
  /** Extensible expression identifier e.g. 'neutral' | 'happy' | 'angry' */
  expression?: string;
  /** Extensible custom parameters dictionary */
  custom?: Record<string, number | boolean | string>;
}

export type ParameterListener = (parameters: Readonly<AvatarParameters>, sequence: number) => void;
