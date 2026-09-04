import { describe, it, expect } from 'vitest';
import { validateManifest, parseAndValidateManifest } from '../core/project/manifestSchema';
import { DEFAULT_PROJECT_MANIFEST } from '../core/project/defaultProject';

describe('Manifest Schema Validation', () => {
  it('passes validation for valid default project manifest', () => {
    const res = validateManifest(DEFAULT_PROJECT_MANIFEST);
    expect(res.valid).toBe(true);
    expect(res.manifest).toBeDefined();
    expect(res.error).toBeUndefined();
  });

  it('rejects invalid JSON syntax', () => {
    const res = parseAndValidateManifest('{"schemaVersion": 1, invalid json}');
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Invalid JSON syntax/);
  });

  it('rejects wrong or unsupported schemaVersion', () => {
    const wrongVersion = { ...DEFAULT_PROJECT_MANIFEST, schemaVersion: 99 };
    const res = validateManifest(wrongVersion);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Unsupported schemaVersion/);
  });

  it('rejects manifest missing required projectId', () => {
    const missingProjectId = { ...DEFAULT_PROJECT_MANIFEST, projectId: '' };
    const res = validateManifest(missingProjectId);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/Missing or invalid projectId/);
  });

  it('rejects layer with unsupported type (not sprite)', () => {
    const invalidLayer = {
      ...DEFAULT_PROJECT_MANIFEST,
      layers: [
        {
          ...DEFAULT_PROJECT_MANIFEST.layers[0],
          type: 'invalid_mesh_type' as any,
        },
      ],
    };
    const res = validateManifest(invalidLayer);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/unsupported type/);
  });

  it('rejects asset with unsupported format', () => {
    const invalidAsset = {
      ...DEFAULT_PROJECT_MANIFEST,
      assets: [
        {
          id: 'asset-1',
          name: 'Test',
          path: 'assets/test.jpg',
          format: 'jpg' as any,
        },
      ],
    };
    const res = validateManifest(invalidAsset);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/unsupported format/);
  });

  it('rejects layer with invalid semantic role', () => {
    const invalidRole = {
      ...DEFAULT_PROJECT_MANIFEST,
      layers: [
        {
          ...DEFAULT_PROJECT_MANIFEST.layers[0],
          role: 'unknown_role' as any,
        },
      ],
    };
    const res = validateManifest(invalidRole);
    expect(res.valid).toBe(false);
    expect(res.error).toMatch(/invalid role/);
  });
});
