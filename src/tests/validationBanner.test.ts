import { describe, it, expect } from 'vitest';
import { validateRoleMapping } from '../core/project/roleAssignment';
import { CharacterLayer } from '../core/project/types';

const createLayer = (id: string, role: string): CharacterLayer => ({
  id,
  name: `Layer ${id}`,
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

describe('validationBanner logic', () => {
  it('showWarning: returns warnings when required roles are missing', () => {
    // Only body role provided
    const layers = [createLayer('1', 'body')];
    const validation = validateRoleMapping(layers);

    expect(validation.isValid).toBe(false);
    expect(validation.warnings.length).toBe(4); // eye_open, eye_closed, mouth_closed, mouth_open
    expect(validation.warnings.some((w) => w.role === 'mouth_open')).toBe(true);
    expect(validation.warnings.find((w) => w.role === 'mouth_open')?.message).toContain('mouth_open');
  });

  it('hideWarning: returns isValid true with 0 warnings when all roles assigned', () => {
    const layers = [
      createLayer('1', 'body'),
      createLayer('2', 'eye_open'),
      createLayer('3', 'eye_closed'),
      createLayer('4', 'mouth_closed'),
      createLayer('5', 'mouth_open'),
      createLayer('6', 'accessory'),
    ];

    const validation = validateRoleMapping(layers);
    expect(validation.isValid).toBe(true);
    expect(validation.warnings.length).toBe(0);
    expect(validation.missingRoles.length).toBe(0);
  });
});
