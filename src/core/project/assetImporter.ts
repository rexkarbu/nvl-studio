import path from 'path';
import fs from 'fs';


/**
 * Sanitizes a filename for cross-platform filesystem safety.
 * Converts to lowercase, replaces spaces with hyphens, strips non-alphanumeric chars.
 */
export function sanitizeFilename(rawName: string): string {
  // Strip extension first
  const dotIndex = rawName.lastIndexOf('.');
  const base = dotIndex !== -1 ? rawName.slice(0, dotIndex) : rawName;

  const clean = base
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  const safeBase = clean.length > 0 ? clean : 'asset';
  return `${safeBase}.png`;
}

/**
 * Generates a unique, stable asset identifier.
 */
export function generateAssetId(baseName: string): string {
  const clean = sanitizeFilename(baseName).replace(/\.png$/, '');
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `asset-${clean}-${timestamp}-${randomSuffix}`;
}

/**
 * Validates whether the provided buffer starts with the 8-byte PNG header:
 * 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
 */
export function validatePngBuffer(buffer: Uint8Array): boolean {
  if (!buffer || buffer.length < 8) {
    return false;
  }
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) {
    if (buffer[i] !== pngSignature[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Resolves an asset filename inside the target directory without collisions.
 * Appends numeric suffixes (-1, -2, ...) if the file already exists.
 */
export function resolveUniqueAssetFilename(assetsDir: string, sanitizedName: string): string {
  const base = sanitizedName.replace(/\.png$/, '');
  let candidate = sanitizedName;
  let counter = 1;

  while (fs.existsSync(path.join(assetsDir, candidate))) {
    candidate = `${base}-${counter}.png`;
    counter++;
  }

  return candidate;
}

export { createDefaultLayer } from './layerOperations';
