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

/**
 * Resolves an asset path to a browser-loadable URL.
 * If running in electron with custom protocol or static server, formats accordingly.
 */
export function resolveAssetUrl(assetPath: string, serverPort: number = 17777): string {
  if (assetPath.startsWith('data:') || assetPath.startsWith('http://') || assetPath.startsWith('https://')) {
    return assetPath;
  }

  const clean = assetPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (clean.startsWith('assets/')) {
    return `http://127.0.0.1:${serverPort}/sample_avatar/${clean}`;
  }
  return `http://127.0.0.1:${serverPort}/${clean}`;
}
