import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  sanitizeFilename,
  generateAssetId,
  validatePngBuffer,
  createDefaultLayer,
  resolveUniqueAssetFilename,
} from '../core/project/assetImporter';
import { ProjectAssetEntry } from '../core/project/types';

describe('assetImporter module', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nvl-asset-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('sanitizeFilename converts spaces to hyphens, strips special chars, and lowercases', () => {
    expect(sanitizeFilename('My Chibi Eyes (Open).PNG')).toBe('my-chibi-eyes-open.png');
    expect(sanitizeFilename('Avatar #1 [Special!].png')).toBe('avatar-1-special.png');
    expect(sanitizeFilename('   spaces   everywhere  .png')).toBe('spaces-everywhere.png');
    expect(sanitizeFilename('valid-name.png')).toBe('valid-name.png');
    expect(sanitizeFilename('no-extension')).toBe('no-extension.png');
  });

  it('generateAssetId produces unique, sanitized identifiers', () => {
    const id1 = generateAssetId('Hair Front');
    const id2 = generateAssetId('Hair Front');

    expect(id1).toMatch(/^asset-hair-front-/);
    expect(id2).toMatch(/^asset-hair-front-/);
    expect(id1).not.toBe(id2);
  });

  it('validatePngBuffer detects valid PNG magic bytes and rejects invalid buffers', () => {
    const validPngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(validatePngBuffer(validPngHeader)).toBe(true);

    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    expect(validatePngBuffer(jpegHeader)).toBe(false);

    const shortBuffer = new Uint8Array([0x89, 0x50, 0x4e]);
    expect(validatePngBuffer(shortBuffer)).toBe(false);

    const corruptHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00, 0x00, 0x00]);
    expect(validatePngBuffer(corruptHeader)).toBe(false);
  });

  it('resolveUniqueAssetFilename increments counter on name collision', () => {
    const assetsDir = tempDir;
    fs.writeFileSync(path.join(assetsDir, 'hair.png'), 'dummy');

    const unique1 = resolveUniqueAssetFilename(assetsDir, 'hair.png');
    expect(unique1).toBe('hair-1.png');

    fs.writeFileSync(path.join(assetsDir, 'hair-1.png'), 'dummy');
    const unique2 = resolveUniqueAssetFilename(assetsDir, 'hair.png');
    expect(unique2).toBe('hair-2.png');
  });

  it('createDefaultLayer creates sprite layer with custom role and specified zIndex', () => {
    const asset: ProjectAssetEntry = {
      id: 'asset-ribbon-123',
      name: 'Ribbon',
      path: 'assets/ribbon.png',
      format: 'png',
    };

    const layer = createDefaultLayer(asset, 5);

    expect(layer.id).toBe('layer-ribbon-123');
    expect(layer.name).toBe('Ribbon');
    expect(layer.type).toBe('sprite');
    expect(layer.role).toBe('custom');
    expect(layer.zIndex).toBe(5);
    expect(layer.visible).toBe(true);
    expect(layer.scaleX).toBe(1);
    expect(layer.scaleY).toBe(1);
    expect(layer.rotation).toBe(0);
    expect(layer.opacity).toBe(1);
  });
});
