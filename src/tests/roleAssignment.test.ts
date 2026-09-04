import { describe, it, expect } from 'vitest';
import {
  assignRole,
  validateRoleMapping,
  autoAssignRoles,
  ROLE_METADATA,
} from '../core/project/roleAssignment';
import { CharacterLayer, SemanticLayerRole } from '../core/project/types';

const createMockLayer = (id: string, name: string, role = 'custom'): CharacterLayer => ({
  id,
  name,
  type: 'sprite',
  assetId: `asset-${id}`,
  role: role as any,
  x: 960,
  y: 540,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1,
  visible: true,
  zIndex: 1,
});

describe('roleAssignment module', () => {
  it('assignRole updates layer role correctly', () => {
    const layers = [createMockLayer('layer-1', 'My Body')];
    const res = assignRole(layers, 'layer-1', 'body');

    expect(res.hasConflict).toBe(false);
    expect(res.updatedLayers[0].role).toBe('body');
  });

  it('assignRole detects duplicate unique role collision and returns conflictLayer', () => {
    const layers = [
      createMockLayer('layer-1', 'Eye 1', 'eye_open'),
      createMockLayer('layer-2', 'Eye 2', 'custom'),
    ];

    // Attempt to assign eye_open to layer-2 without confirmReassign
    const res = assignRole(layers, 'layer-2', 'eye_open', false);

    expect(res.hasConflict).toBe(true);
    expect(res.conflictLayer?.id).toBe('layer-1');
    // Original layers unmodified
    expect(res.updatedLayers[1].role).toBe('custom');
  });

  it('assignRole reassigns duplicate unique role when confirmReassign is true', () => {
    const layers = [
      createMockLayer('layer-1', 'Eye 1', 'eye_open'),
      createMockLayer('layer-2', 'Eye 2', 'custom'),
    ];

    // Confirm reassigning eye_open to layer-2
    const res = assignRole(layers, 'layer-2', 'eye_open', true);

    expect(res.hasConflict).toBe(false);
    // Old layer becomes 'custom'
    expect(res.updatedLayers.find((l) => l.id === 'layer-1')?.role).toBe('custom');
    // New layer receives 'eye_open'
    expect(res.updatedLayers.find((l) => l.id === 'layer-2')?.role).toBe('eye_open');
  });

  it('assignRole allows multiple layers to have non-unique roles (custom and accessory)', () => {
    const layers = [
      createMockLayer('layer-1', 'Glasses', 'accessory'),
      createMockLayer('layer-2', 'Hat', 'custom'),
    ];

    const res = assignRole(layers, 'layer-2', 'accessory', false);
    expect(res.hasConflict).toBe(false);
    expect(res.updatedLayers[0].role).toBe('accessory');
    expect(res.updatedLayers[1].role).toBe('accessory');
  });

  it('removeRole / assigning custom clears semantic role', () => {
    const layers = [createMockLayer('layer-1', 'Mouth', 'mouth_open')];
    const res = assignRole(layers, 'layer-1', 'custom');

    expect(res.hasConflict).toBe(false);
    expect(res.updatedLayers[0].role).toBe('custom');
  });

  it('validateRoleMapping detects missing core roles with actionable messages', () => {
    const layers = [
      createMockLayer('layer-body', 'Body', 'body'),
      createMockLayer('layer-eye-open', 'Eyes Open', 'eye_open'),
      // Missing eye_closed, mouth_open, mouth_closed
    ];

    const validation = validateRoleMapping(layers);
    expect(validation.isValid).toBe(false);
    expect(validation.missingRoles).toEqual(['eye_closed', 'mouth_closed', 'mouth_open']);
    expect(validation.warnings.length).toBe(3);
    expect(validation.warnings[0].message).toContain('Missing');
  });

  it('validateRoleMapping returns isValid: true when all 5 core roles are assigned', () => {
    const layers = [
      createMockLayer('l-body', 'Body', 'body'),
      createMockLayer('l-eo', 'Eye Open', 'eye_open'),
      createMockLayer('l-ec', 'Eye Closed', 'eye_closed'),
      createMockLayer('l-mc', 'Mouth Closed', 'mouth_closed'),
      createMockLayer('l-mo', 'Mouth Open', 'mouth_open'),
    ];

    const validation = validateRoleMapping(layers);
    expect(validation.isValid).toBe(true);
    expect(validation.missingRoles.length).toBe(0);
    expect(validation.warnings.length).toBe(0);
    expect(validation.mappedRoles.body).toBe('Body');
    expect(validation.mappedRoles.mouth_open).toBe('Mouth Open');
  });

  it('autoAssignRoles matches common filenames and respects first-match-wins', () => {
    const layers = [
      createMockLayer('l1', 'char_body.png'),
      createMockLayer('l2', 'my-eye-open.png'),
      createMockLayer('l3', 'my-eye-close.png'),
      createMockLayer('l4', 'mouth-closed.png'),
      createMockLayer('l5', 'mouth_open_talk.png'),
      createMockLayer('l6', 'hat_accessory.png'),
      // Duplicate body match — should remain 'custom' because l1 already got 'body'
      createMockLayer('l7', 'extra_body.png'),
    ];

    const result = autoAssignRoles(layers);
    expect(result.assignedCount).toBe(6);

    const rolesMap = Object.fromEntries(result.updatedLayers.map((l) => [l.id, l.role]));
    expect(rolesMap['l1']).toBe('body');
    expect(rolesMap['l2']).toBe('eye_open');
    expect(rolesMap['l3']).toBe('eye_closed');
    expect(rolesMap['l4']).toBe('mouth_closed');
    expect(rolesMap['l5']).toBe('mouth_open');
    expect(rolesMap['l6']).toBe('accessory');
    expect(rolesMap['l7']).toBe('custom'); // Second body match ignored
  });

  it('ROLE_METADATA exposes complete definition for all roles', () => {
    const allRoles: SemanticLayerRole[] = [
      'body',
      'eye_open',
      'eye_closed',
      'mouth_closed',
      'mouth_open',
      'accessory',
      'custom',
    ];
    for (const r of allRoles) {
      const def = ROLE_METADATA[r];
      expect(def).toBeDefined();
      expect(def.label).toBeTruthy();
      expect(def.badgeTextColor).toBeTruthy();
    }
  });
});
