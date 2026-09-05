import path from 'path';

/**
 * Normalizes an asset path for manifest persistence using forward slashes (POSIX style).
 * Ensures consistency across Windows, macOS, and Linux.
 */
export function normalizeToManifestPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

/**
 * Resolves an asset's relative path against the directory where project.nvl is located.
 * Avoids any dependency on process.cwd().
 */
export function resolveAssetPath(projectDir: string, assetRelativePath: string): string {
  const normalizedRel = assetRelativePath.replace(/\\/g, '/');
  return path.resolve(projectDir, normalizedRel);
}

// Compatibility export for Node callers. Browser components import assetUrl directly.
export { resolveAssetUrl } from './assetUrl';
export type { ResolveAssetUrlOptions } from './assetUrl';
