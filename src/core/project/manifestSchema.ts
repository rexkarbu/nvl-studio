import { ProjectManifest, SemanticLayerRole } from './types';

const VALID_SEMANTIC_ROLES: Set<SemanticLayerRole> = new Set([
  'body',
  'eye_open',
  'eye_closed',
  'mouth_closed',
  'mouth_open',
  'accessory',
  'custom',
]);

export interface ValidationResult {
  valid: boolean;
  manifest?: ProjectManifest;
  error?: string;
}

/**
 * Validates whether an unknown object conforms strictly to the ProjectManifest schema.
 */
export function validateManifest(data: unknown): ValidationResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, error: 'Manifest must be a non-null object' };
  }

  const obj = data as Record<string, any>;

  // 1. schemaVersion
  if (typeof obj.schemaVersion !== 'number') {
    return { valid: false, error: 'Missing or invalid schemaVersion (must be a number)' };
  }
  if (obj.schemaVersion !== 1) {
    return {
      valid: false,
      error: `Unsupported schemaVersion: ${obj.schemaVersion}. Only schemaVersion 1 is supported in this release.`,
    };
  }

  // 2. projectId
  if (typeof obj.projectId !== 'string' || obj.projectId.trim() === '') {
    return { valid: false, error: 'Missing or invalid projectId (must be a non-empty string)' };
  }

  // 3. metadata
  if (!obj.metadata || typeof obj.metadata !== 'object') {
    return { valid: false, error: 'Missing or invalid metadata object' };
  }
  if (typeof obj.metadata.name !== 'string' || obj.metadata.name.trim() === '') {
    return { valid: false, error: 'Missing or invalid metadata.name' };
  }
  if (typeof obj.metadata.version !== 'string') {
    return { valid: false, error: 'Missing or invalid metadata.version' };
  }

  // 4. canvas
  if (!obj.canvas || typeof obj.canvas !== 'object') {
    return { valid: false, error: 'Missing or invalid canvas object' };
  }
  if (typeof obj.canvas.width !== 'number' || obj.canvas.width <= 0) {
    return { valid: false, error: 'Invalid canvas.width (must be a positive number)' };
  }
  if (typeof obj.canvas.height !== 'number' || obj.canvas.height <= 0) {
    return { valid: false, error: 'Invalid canvas.height (must be a positive number)' };
  }
  if (typeof obj.canvas.fps !== 'number' || obj.canvas.fps <= 0) {
    return { valid: false, error: 'Invalid canvas.fps (must be a positive number)' };
  }

  // 5. assets
  if (!Array.isArray(obj.assets)) {
    return { valid: false, error: 'Missing or invalid assets array' };
  }
  for (let i = 0; i < obj.assets.length; i++) {
    const asset = obj.assets[i];
    if (!asset || typeof asset !== 'object') {
      return { valid: false, error: `Invalid asset entry at index ${i}` };
    }
    if (typeof asset.id !== 'string' || asset.id.trim() === '') {
      return { valid: false, error: `Asset at index ${i} has invalid id` };
    }
    if (typeof asset.name !== 'string' || asset.name.trim() === '') {
      return { valid: false, error: `Asset at index ${i} has invalid name` };
    }
    if (typeof asset.path !== 'string' || asset.path.trim() === '') {
      return { valid: false, error: `Asset at index ${i} has invalid path` };
    }
    if (asset.format !== 'png') {
      return { valid: false, error: `Asset at index ${i} has unsupported format: ${asset.format}. Only 'png' is supported.` };
    }
  }

  // 6. layers
  if (!Array.isArray(obj.layers)) {
    return { valid: false, error: 'Missing or invalid layers array' };
  }
  for (let i = 0; i < obj.layers.length; i++) {
    const layer = obj.layers[i];
    if (!layer || typeof layer !== 'object') {
      return { valid: false, error: `Invalid layer entry at index ${i}` };
    }
    if (typeof layer.id !== 'string' || layer.id.trim() === '') {
      return { valid: false, error: `Layer at index ${i} has invalid id` };
    }
    if (layer.type !== 'sprite') {
      return {
        valid: false,
        error: `Layer at index ${i} has unsupported type: '${layer.type}'. Must be 'sprite'.`,
      };
    }
    if (typeof layer.assetId !== 'string') {
      return { valid: false, error: `Layer at index ${i} has invalid assetId` };
    }
    if (!VALID_SEMANTIC_ROLES.has(layer.role)) {
      return {
        valid: false,
        error: `Layer at index ${i} has invalid role '${layer.role}'. Valid roles: ${Array.from(VALID_SEMANTIC_ROLES).join(', ')}`,
      };
    }
    if (typeof layer.x !== 'number' || typeof layer.y !== 'number') {
      return { valid: false, error: `Layer at index ${i} has invalid position (x, y must be numbers)` };
    }
    if (typeof layer.scaleX !== 'number' || typeof layer.scaleY !== 'number') {
      return { valid: false, error: `Layer at index ${i} has invalid scale (scaleX, scaleY must be numbers)` };
    }
    if (typeof layer.rotation !== 'number' || typeof layer.opacity !== 'number') {
      return { valid: false, error: `Layer at index ${i} has invalid rotation or opacity` };
    }
    if (typeof layer.visible !== 'boolean') {
      return { valid: false, error: `Layer at index ${i} has invalid visible flag (must be boolean)` };
    }
    if (typeof layer.zIndex !== 'number') {
      return { valid: false, error: `Layer at index ${i} has invalid zIndex (must be number)` };
    }
  }

  // 7. audioConfig
  if (!obj.audioConfig || typeof obj.audioConfig !== 'object') {
    return { valid: false, error: 'Missing or invalid audioConfig object' };
  }
  if (typeof obj.audioConfig.threshold !== 'number' || typeof obj.audioConfig.sensitivity !== 'number') {
    return { valid: false, error: 'audioConfig.threshold and sensitivity must be numbers' };
  }

  // 8. outputConfig
  if (!obj.outputConfig || typeof obj.outputConfig !== 'object') {
    return { valid: false, error: 'Missing or invalid outputConfig object' };
  }
  if (typeof obj.outputConfig.preferredPort !== 'number') {
    return { valid: false, error: 'outputConfig.preferredPort must be a number' };
  }

  return { valid: true, manifest: obj as ProjectManifest };
}

/**
 * Parses a JSON string and validates it as ProjectManifest.
 */
export function parseAndValidateManifest(rawJson: string): ValidationResult {
  try {
    const parsed = JSON.parse(rawJson);
    return validateManifest(parsed);
  } catch (err: any) {
    return { valid: false, error: `Invalid JSON syntax: ${err.message}` };
  }
}
