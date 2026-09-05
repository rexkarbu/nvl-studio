import { CharacterLayer, ExpressionConfig, MouthConfig, SemanticLayerRole } from '../project/types';
import { AvatarParameters } from '../parameters/types';
import { ResolvedLayer, ResolvedVisualState } from './types';
import { resolveActiveMouthRole } from '../audio/MouthShapeMapper';

/**
 * Deterministic character resolver.
 * Evaluates semantic roles against parameters to produce the active layers list,
 * then applies additive layer overrides for the currently active expression.
 *
 * Crucial Rule: Talking, Blink, and Expressions are independent and operate simultaneously.
 */
export class CharacterResolver {
  public static resolve(
    layers: CharacterLayer[],
    parameters: AvatarParameters,
    idleBobOffset: number = 0,
    expressionConfig?: ExpressionConfig,
    mouthConfig?: MouthConfig
  ): ResolvedVisualState {
    const activeLayers: ResolvedLayer[] = [];

    // Collect available mouth roles in the project for deterministic multi-frame resolution
    const availableMouthRoles = new Set<SemanticLayerRole>();
    for (const layer of layers) {
      if (layer.role.startsWith('mouth_')) {
        availableMouthRoles.add(layer.role);
      }
    }

    // Determine the single active mouth role based on continuous/shape mapping and available frames
    const activeMouthRole = resolveActiveMouthRole(parameters, availableMouthRoles, mouthConfig);

    // Determine if rig has a dedicated body layer, or if 2-frame mouth_closed acts as the bobbing base
    const hasBodyRole = layers.some((l) => l.role === 'body');

    // 1. Role-based visibility evaluation & 2. Idle bob offset
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
        case 'mouth_open':
        case 'mouth_small':
        case 'mouth_medium':
        case 'mouth_wide':
          shouldRender = layer.role === activeMouthRole;
          break;

        default:
          shouldRender = true;
          break;
      }

      if (shouldRender) {
        // Idle bob applies to body layer (or mouth_closed if 2-frame rig without body) during idle state
        const isBobTarget = layer.role === 'body' || (!hasBodyRole && layer.role === 'mouth_closed');
        const applyBob = isBobTarget && !parameters.voiceActivity && idleBobOffset !== 0;
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

    // 3. Apply expression layerOverrides (after role & bob, before return)
    const activeExprId = parameters.expression || expressionConfig?.activeExpression || 'neutral';
    if (expressionConfig?.expressions && expressionConfig.expressions.length > 0) {
      const activeExpr = expressionConfig.expressions.find((e) => e.id === activeExprId);
      if (activeExpr?.layerOverrides) {
        for (let i = 0; i < activeLayers.length; i++) {
          const item = activeLayers[i];
          const override = activeExpr.layerOverrides[item.layer.id];
          if (override) {
            // Apply only properties that are explicitly defined in the override (additive)
            if (override.x !== undefined) item.x = override.x;
            if (override.y !== undefined) {
              const isBobTarget = item.layer.role === 'body' || (!hasBodyRole && item.layer.role === 'mouth_closed');
              const applyBob = isBobTarget && !parameters.voiceActivity && idleBobOffset !== 0;
              item.y = applyBob ? override.y + idleBobOffset : override.y;
            }
            if (override.scaleX !== undefined) item.scaleX = override.scaleX;
            if (override.scaleY !== undefined) item.scaleY = override.scaleY;
            if (override.rotation !== undefined) item.rotation = override.rotation;
            if (override.opacity !== undefined) item.opacity = override.opacity;
            if (override.zIndex !== undefined) item.zIndex = override.zIndex;
            if (override.assetId !== undefined) item.assetId = override.assetId;

            // Create a new layer snapshot with overrides applied; preserve role explicitly
            item.layer = {
              ...item.layer,
              ...override,
              role: item.layer.role,
            };
          }
        }
      }
    }

    // Filter out any layer explicitly marked hidden by an override
    const visibleLayers = activeLayers.filter((item) => item.layer.visible !== false);

    // 4. Sort layers by zIndex ascending so lower zIndex is drawn first (behind)
    visibleLayers.sort((a, b) => a.zIndex - b.zIndex);

    return {
      activeLayers: visibleLayers,
      voiceState: parameters.voiceActivity ? 'talking' : 'idle',
      isBlinking: parameters.blink,
      voiceLevel: parameters.voiceLevel,
    };
  }
}
