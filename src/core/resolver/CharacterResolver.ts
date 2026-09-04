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
    parameters: AvatarParameters
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
        activeLayers.push({
          layer,
          assetId: layer.assetId,
          x: layer.x,
          y: layer.y,
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
