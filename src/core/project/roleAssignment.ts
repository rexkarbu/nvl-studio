import { CharacterLayer, SemanticLayerRole } from './types';

export interface RoleDefinition {
  role: SemanticLayerRole;
  label: string;
  description: string;
  isUnique: boolean; // Only one layer can have this role if true
  badgeColor: string;
  badgeTextColor: string;
  badgeBorderColor: string;
}

export const ROLE_METADATA: Record<SemanticLayerRole, RoleDefinition> = {
  body: {
    role: 'body',
    label: 'Body',
    description: 'Always visible base body of the character',
    isUnique: true,
    badgeColor: 'rgba(0, 225, 217, 0.15)',
    badgeTextColor: '#00e1d9',
    badgeBorderColor: 'rgba(0, 225, 217, 0.35)',
  },
  eye_open: {
    role: 'eye_open',
    label: 'Eye Open',
    description: 'Visible when eyes are open (idle state)',
    isUnique: true,
    badgeColor: 'rgba(127, 90, 240, 0.15)',
    badgeTextColor: '#7f5af0',
    badgeBorderColor: 'rgba(127, 90, 240, 0.35)',
  },
  eye_closed: {
    role: 'eye_closed',
    label: 'Eye Closed',
    description: 'Visible during blink animation frames',
    isUnique: true,
    badgeColor: 'rgba(167, 139, 250, 0.15)',
    badgeTextColor: '#a78bfa',
    badgeBorderColor: 'rgba(167, 139, 250, 0.35)',
  },
  mouth_closed: {
    role: 'mouth_closed',
    label: 'Mouth Closed',
    description: 'Visible when silent/idle (no voice activity)',
    isUnique: true,
    badgeColor: 'rgba(44, 182, 125, 0.15)',
    badgeTextColor: '#2cb67d',
    badgeBorderColor: 'rgba(44, 182, 125, 0.35)',
  },
  mouth_open: {
    role: 'mouth_open',
    label: 'Mouth Open',
    description: 'Visible when speaking (voice activity detected)',
    isUnique: true,
    badgeColor: 'rgba(255, 137, 6, 0.15)',
    badgeTextColor: '#ff8906',
    badgeBorderColor: 'rgba(255, 137, 6, 0.35)',
  },
  mouth_small: {
    role: 'mouth_small',
    label: 'Mouth Small',
    description: 'Visible for soft voice / slight opening',
    isUnique: true,
    badgeColor: 'rgba(255, 179, 71, 0.15)',
    badgeTextColor: '#ffb347',
    badgeBorderColor: 'rgba(255, 179, 71, 0.35)',
  },
  mouth_medium: {
    role: 'mouth_medium',
    label: 'Mouth Medium',
    description: 'Visible for normal speech volume',
    isUnique: true,
    badgeColor: 'rgba(255, 137, 6, 0.15)',
    badgeTextColor: '#ff8906',
    badgeBorderColor: 'rgba(255, 137, 6, 0.35)',
  },
  mouth_wide: {
    role: 'mouth_wide',
    label: 'Mouth Wide',
    description: 'Visible for loud speech / shouting',
    isUnique: true,
    badgeColor: 'rgba(255, 84, 112, 0.15)',
    badgeTextColor: '#ff5470',
    badgeBorderColor: 'rgba(255, 84, 112, 0.35)',
  },
  accessory: {
    role: 'accessory',
    label: 'Accessory',
    description: 'Additional decorative layer (hat, glasses, hair, props)',
    isUnique: false,
    badgeColor: 'rgba(34, 211, 238, 0.15)',
    badgeTextColor: '#22d3ee',
    badgeBorderColor: 'rgba(34, 211, 238, 0.35)',
  },
  custom: {
    role: 'custom',
    label: 'Custom / Unassigned',
    description: 'Standard static layer with no animation binding',
    isUnique: false,
    badgeColor: 'rgba(148, 161, 178, 0.15)',
    badgeTextColor: '#94a1b2',
    badgeBorderColor: 'rgba(148, 161, 178, 0.3)',
  },
};

export interface RoleAssignmentResult {
  updatedLayers: CharacterLayer[];
  hasConflict: boolean;
  conflictLayer?: CharacterLayer;
}

/**
 * Assigns a semantic role to a layer.
 * If the role is unique and already assigned to another layer:
 * - If confirmReassign is false, returns conflictLayer without modifying layers.
 * - If confirmReassign is true, sets the conflicting layer's role back to 'custom' and assigns the role to layerId.
 */
export function assignRole(
  layers: CharacterLayer[],
  layerId: string,
  newRole: SemanticLayerRole,
  confirmReassign = false
): RoleAssignmentResult {
  const targetLayer = layers.find((l) => l.id === layerId);
  if (!targetLayer) {
    return { updatedLayers: layers, hasConflict: false };
  }

  // If assigning same role, no-op
  if (targetLayer.role === newRole) {
    return { updatedLayers: layers, hasConflict: false };
  }

  const roleDef = ROLE_METADATA[newRole];

  // Check unique collision
  if (roleDef.isUnique) {
    const existing = layers.find((l) => l.id !== layerId && l.role === newRole);
    if (existing) {
      if (!confirmReassign) {
        return {
          updatedLayers: layers,
          hasConflict: true,
          conflictLayer: existing,
        };
      }

      // Reassign: set old holder to 'custom', assign newRole to targetLayer
      const updated = layers.map((l) => {
        if (l.id === existing.id) {
          return { ...l, role: 'custom' as SemanticLayerRole };
        }
        if (l.id === layerId) {
          return { ...l, role: newRole };
        }
        return l;
      });

      return {
        updatedLayers: updated,
        hasConflict: false,
      };
    }
  }

  // No conflict or non-unique role
  const updated = layers.map((l) =>
    l.id === layerId ? { ...l, role: newRole } : l
  );

  return {
    updatedLayers: updated,
    hasConflict: false,
  };
}

export interface RoleValidationWarning {
  role: SemanticLayerRole;
  message: string;
}

export interface RoleValidationResult {
  isValid: boolean;
  warnings: RoleValidationWarning[];
  missingRoles: SemanticLayerRole[];
  mappedRoles: Record<SemanticLayerRole, string | null>; // role -> layer name
}

/**
 * Validates whether all core PNGtuber semantic roles are assigned.
 * Produces user-friendly, specific warning descriptions.
 * For open mouth: accepts any of mouth_open, mouth_small, mouth_medium, or mouth_wide.
 */
export function validateRoleMapping(layers: CharacterLayer[]): RoleValidationResult {
  const baseRequiredRoles: { role: SemanticLayerRole; message: string }[] = [
    {
      role: 'body',
      message: "Missing 'body' — assign a base layer for your character.",
    },
    {
      role: 'eye_open',
      message: "Missing 'eye_open' — assign a layer to display open eyes in idle state.",
    },
    {
      role: 'eye_closed',
      message: "Missing 'eye_closed' — assign a layer to enable eye blinking.",
    },
    {
      role: 'mouth_closed',
      message: "Missing 'mouth_closed' — assign a layer for closed mouth when silent.",
    },
  ];

  const mappedRoles: Record<SemanticLayerRole, string | null> = {
    body: null,
    eye_open: null,
    eye_closed: null,
    mouth_closed: null,
    mouth_open: null,
    mouth_small: null,
    mouth_medium: null,
    mouth_wide: null,
    accessory: null,
    custom: null,
  };

  for (const layer of layers) {
    if (!mappedRoles[layer.role]) {
      mappedRoles[layer.role] = layer.name;
    }
  }

  const warnings: RoleValidationWarning[] = [];
  const missingRoles: SemanticLayerRole[] = [];

  for (const req of baseRequiredRoles) {
    if (!mappedRoles[req.role]) {
      missingRoles.push(req.role);
      warnings.push({
        role: req.role,
        message: req.message,
      });
    }
  }

  // Open mouth validation: any of mouth_open, mouth_small, mouth_medium, mouth_wide satisfies it
  const hasOpenMouth = Boolean(
    mappedRoles.mouth_open ||
    mappedRoles.mouth_small ||
    mappedRoles.mouth_medium ||
    mappedRoles.mouth_wide
  );

  if (!hasOpenMouth) {
    missingRoles.push('mouth_open');
    warnings.push({
      role: 'mouth_open',
      message: "Missing mouth opening layer — assign 'mouth_open', 'mouth_small', 'mouth_medium', or 'mouth_wide'.",
    });
  }

  return {
    isValid: missingRoles.length === 0,
    warnings,
    missingRoles,
    mappedRoles,
  };
}

/**
 * Common pattern matchers for automatic semantic role detection based on layer names / filenames.
 * Resolution rule: "First match wins" — if multiple layers match a unique role, only the first receives it.
 */
const AUTO_ASSIGN_PATTERNS: { role: SemanticLayerRole; regex: RegExp }[] = [
  {
    role: 'eye_open',
    regex: /(?:eye.*open|mata.*buka|eyes_open|eye-open)/i,
  },
  {
    role: 'eye_closed',
    regex: /(?:eye.*close|mata.*tutup|blink|eyes_closed|eye-close)/i,
  },
  {
    role: 'mouth_small',
    regex: /(?:mouth.*small|mulut.*kecil|mouth_small|mouth-small)/i,
  },
  {
    role: 'mouth_medium',
    regex: /(?:mouth.*medium|mouth.*mid|mulut.*sedang|mouth_medium|mouth-medium)/i,
  },
  {
    role: 'mouth_wide',
    regex: /(?:mouth.*wide|mouth.*big|mulut.*lebar|mouth_wide|mouth-wide)/i,
  },
  {
    role: 'mouth_open',
    regex: /(?:mouth.*open|talk|bicara|mangap|mouth_open|mouth-open)/i,
  },
  {
    role: 'mouth_closed',
    regex: /(?:mouth.*close|idle|diam|mingkem|mouth_closed|mouth-close)/i,
  },
  {
    role: 'body',
    regex: /(?:body|badan|base|torso|tubuh)/i,
  },
  {
    role: 'accessory',
    regex: /(?:acc|accessory|hat|topi|glasses|kacamata|hair|rambut|bando)/i,
  },
];

export interface AutoAssignResult {
  updatedLayers: CharacterLayer[];
  assignedCount: number;
}

/**
 * Automatically assigns semantic roles based on common name patterns.
 * Respects unique role limits (first match wins per unique role).
 */
export function autoAssignRoles(layers: CharacterLayer[]): AutoAssignResult {
  const assignedUniqueRoles = new Set<SemanticLayerRole>();

  // Check what unique roles are already assigned
  for (const l of layers) {
    if (l.role !== 'custom' && ROLE_METADATA[l.role]?.isUnique) {
      assignedUniqueRoles.add(l.role);
    }
  }

  let assignedCount = 0;

  const updatedLayers = layers.map((layer) => {
    // If layer already has a specific role other than 'custom', keep it
    if (layer.role !== 'custom') {
      return layer;
    }

    const testName = `${layer.name} ${layer.assetId}`.toLowerCase();

    for (const pattern of AUTO_ASSIGN_PATTERNS) {
      if (pattern.regex.test(testName)) {
        const isUnique = ROLE_METADATA[pattern.role].isUnique;
        if (isUnique && assignedUniqueRoles.has(pattern.role)) {
          // Already filled by an earlier layer; skip to preserve first-match-wins
          continue;
        }

        if (isUnique) {
          assignedUniqueRoles.add(pattern.role);
        }

        assignedCount++;
        return {
          ...layer,
          role: pattern.role,
        };
      }
    }

    return layer;
  });

  return {
    updatedLayers,
    assignedCount,
  };
}
