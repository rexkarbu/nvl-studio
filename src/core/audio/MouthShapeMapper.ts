import { MouthThresholds, MouthConfig, SemanticLayerRole } from '../project/types';
import { AvatarParameters } from '../parameters/types';

export type MouthShape = 'closed' | 'small' | 'medium' | 'wide';

export const DEFAULT_MOUTH_THRESHOLDS: Readonly<MouthThresholds> = {
  closed: 0.15,
  small: 0.35,
  medium: 0.65,
};

/**
 * Derives a discrete mouth shape ('closed' | 'small' | 'medium' | 'wide')
 * from the voice level based on configured thresholds.
 *
 * Rules:
 * - voiceLevel < thresholds.closed  => 'closed'
 * - voiceLevel < thresholds.small   => 'small'
 * - voiceLevel < thresholds.medium  => 'medium'
 * - voiceLevel >= thresholds.medium => 'wide'
 */
export function deriveMouthShape(
  voiceLevel: number,
  thresholds: MouthThresholds = DEFAULT_MOUTH_THRESHOLDS
): MouthShape {
  const level = Math.max(0, Math.min(1, voiceLevel));

  if (level < thresholds.closed) {
    return 'closed';
  }
  if (level < thresholds.small) {
    return 'small';
  }
  if (level < thresholds.medium) {
    return 'medium';
  }
  return 'wide';
}

/**
 * Derives a continuous normalized mouthOpen value (0.0 - 1.0) from voiceLevel.
 *
 * Rules:
 * - voiceLevel <= thresholds.closed => 0.0 (deadzone/silence)
 * - voiceLevel > thresholds.closed  => linearly mapped and clamped to [0.0, 1.0]
 */
export function deriveMouthOpen(
  voiceLevel: number,
  thresholds: MouthThresholds = DEFAULT_MOUTH_THRESHOLDS
): number {
  const level = Math.max(0, Math.min(1, voiceLevel));

  if (level <= thresholds.closed) {
    return 0.0;
  }

  const range = 1.0 - thresholds.closed;
  if (range <= 0) {
    return 1.0;
  }

  const normalized = (level - thresholds.closed) / range;
  const clamped = Math.max(0, Math.min(1, normalized));

  // Round to 3 decimal places to prevent micro-fluctuations
  return Math.round(clamped * 1000) / 1000;
}

/**
 * Resolves the single active semantic mouth role to display based on parameters,
 * project configuration, and available layer roles.
 *
 * Priority & Edge Case Handling:
 * 1. Continuous Mode:
 *    - If continuousMode is true and parameters.mouthOpen is a valid number:
 *      Selects the closest available mouth frame based on mouthOpen (0.0 - 1.0).
 *      If only 2 frames (mouth_closed / mouth_open) exist, gracefully degrades to binary.
 *    - Edge Case: If continuousMode is true but mouthOpen is undefined, falls back to binary.
 *
 * 2. Discrete Mouth Shape:
 *    - If parameters.mouthShape is defined:
 *      Target role is `mouth_${mouthShape}` (e.g. 'mouth_small', 'mouth_wide').
 *      If project has a layer with that role, return it.
 *      Edge Case: If target shape layer is missing (e.g. mouthShape='small' on a 2-frame project),
 *      falls back gracefully: if voiceActivity is true -> 'mouth_open', else 'mouth_closed'.
 *
 * 3. Fallback Binary Mode:
 *    - If parameters.voiceActivity is true -> 'mouth_open' (or closest open role)
 *    - Else -> 'mouth_closed'
 */
export function resolveActiveMouthRole(
  parameters: AvatarParameters,
  availableRoles: Set<SemanticLayerRole>,
  mouthConfig?: MouthConfig
): SemanticLayerRole {
  const isTalking = parameters.voiceActivity;

  // 1. Continuous Mode
  if (mouthConfig?.continuousMode && typeof parameters.mouthOpen === 'number') {
    const openValue = parameters.mouthOpen;

    if (openValue <= 0.05 || !isTalking) {
      return 'mouth_closed';
    }

    // Check 4-frame availability
    const hasSmall = availableRoles.has('mouth_small');
    const hasMedium = availableRoles.has('mouth_medium');
    const hasWide = availableRoles.has('mouth_wide');
    const hasLegacyOpen = availableRoles.has('mouth_open');

    if (hasSmall || hasMedium || hasWide) {
      // 4-frame continuous selection
      if (openValue < 0.35 && hasSmall) {
        return 'mouth_small';
      }
      if (openValue < 0.70 && (hasMedium || hasLegacyOpen)) {
        return hasMedium ? 'mouth_medium' : 'mouth_open';
      }
      if (hasWide) {
        return 'mouth_wide';
      }
      return hasMedium ? 'mouth_medium' : (hasLegacyOpen ? 'mouth_open' : (hasSmall ? 'mouth_small' : 'mouth_closed'));
    }

    // Graceful 2-frame fallback in continuous mode
    if (hasLegacyOpen) {
      return 'mouth_open';
    }
  }

  // 2. Discrete Mouth Shape Mapping
  if (parameters.mouthShape) {
    const shape = parameters.mouthShape;

    if (shape === 'closed') {
      return 'mouth_closed';
    }

    const targetRole = `mouth_${shape}` as SemanticLayerRole;
    if (availableRoles.has(targetRole)) {
      return targetRole;
    }

    // Edge Case: target role missing in project (e.g., 'mouth_small' on 2-frame avatar)
    // Fall back to closest available open role or legacy 'mouth_open'
    if (isTalking) {
      if (shape === 'small' && availableRoles.has('mouth_medium')) return 'mouth_medium';
      if (shape === 'wide' && availableRoles.has('mouth_medium')) return 'mouth_medium';
      if (availableRoles.has('mouth_open')) return 'mouth_open';
      if (availableRoles.has('mouth_medium')) return 'mouth_medium';
      if (availableRoles.has('mouth_small')) return 'mouth_small';
      if (availableRoles.has('mouth_wide')) return 'mouth_wide';
    } else {
      return 'mouth_closed';
    }
  }

  // 3. Fallback to Binary Mode
  if (isTalking) {
    if (availableRoles.has('mouth_open')) return 'mouth_open';
    if (availableRoles.has('mouth_medium')) return 'mouth_medium';
    if (availableRoles.has('mouth_small')) return 'mouth_small';
    if (availableRoles.has('mouth_wide')) return 'mouth_wide';
  }

  return 'mouth_closed';
}
