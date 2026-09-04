import { CharacterLayer } from '../project/types';
import { AvatarParameters } from '../parameters/types';
import { ResolvedLayer, ResolvedVisualState } from './types';

/**
 * Deterministic character resolver.
 * Evaluates semantic roles against parameters to produce the active layers list.
 *
 * Crucial Rule: Talking and Blink are independent and can occur simultaneously.
 */
export class CharacterResolver {
  public static resolve(
    layers: CharacterLayer[],
    parameters: AvatarParameters,
    idleBobOffset: number = 0
  ): ResolvedVisualState {
    const activeLayers: ResolvedLayer[] = [];

    for (const layer of layers) {
      if (!layer.visible) {
        continue;
      }

      let shouldRender = false;

      switch (layer.role) {
        case 'body':
        case 'accessory':
        case 'custom':
          shouldRender = true;
          break;

        case 'eye_open':
          shouldRender = !parameters.blink;
          break;

        case 'eye_closed':
          shouldRender = parameters.blink;
          break;

        case 'mouth_closed':
          shouldRender = !parameters.voiceActivity;
          break;

        case 'mouth_open':
          shouldRender = parameters.voiceActivity;
          break;

        default:
          shouldRender = true;
          break;
      }

      if (shouldRender) {
        // Idle bob applies to body layer during idle state (!parameters.voiceActivity)
        const isBody = layer.role === 'body';
        const applyBob = isBody && !parameters.voiceActivity && idleBobOffset !== 0;
        const resolvedY = applyBob ? layer.y + idleBobOffset : layer.y;

        activeLayers.push({
          layer,
          assetId: layer.assetId,
          x: layer.x,
          y: resolvedY,
          scaleX: layer.scaleX,
          scaleY: layer.scaleY,
          rotation: layer.rotation,
          opacity: layer.opacity,
          zIndex: layer.zIndex,
        });
      }
    }

    // Sort layers by zIndex ascending so lower zIndex is drawn first (behind)
    activeLayers.sort((a, b) => a.zIndex - b.zIndex);

    return {
      activeLayers,
      voiceState: parameters.voiceActivity ? 'talking' : 'idle',
      isBlinking: parameters.blink,
      voiceLevel: parameters.voiceLevel,
    };
  }
}
