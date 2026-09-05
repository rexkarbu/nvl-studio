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

export interface ResolveAssetUrlOptions {
  /** Optional local server port to prepend origin e.g. http://127.0.0.1:17777 */
  serverPort?: number | null;
  /** Optional cache-busting version token */
  version?: string | null;
  /** Target context: 'active-project' (default) | 'sample' | 'auto' */
  context?: 'active-project' | 'sample' | 'auto';
}

/**
 * Resolves an asset path to a browser-loadable URL.
 * Handles Data URLs, active project assets, and sample assets deterministically.
 */
export function resolveAssetUrl(
  assetPath: string,
  options?: ResolveAssetUrlOptions | number
): string {
  if (!assetPath) return '';

  // Backward compatibility when options is passed as a number (serverPort)
  const opts: ResolveAssetUrlOptions =
    typeof options === 'number' ? { serverPort: options } : options || {};

  // 1. Data URLs, Blob URLs, and absolute HTTP(S) URLs must be returned directly without modification
  if (
    assetPath.startsWith('data:') ||
    assetPath.startsWith('blob:') ||
    assetPath.startsWith('http://') ||
    assetPath.startsWith('https://')
  ) {
    return assetPath;
  }

  // 2. Normalize slashes and strip leading slashes
  let clean = assetPath.replace(/\\/g, '/').replace(/^\/+/, '');

  // 3. Normalize sample context before adding origin/serverPort:
  // If context is 'sample', ensure it has 'sample_avatar/' prefix without duplicating
  if (opts.context === 'sample') {
    if (!clean.startsWith('sample_avatar/')) {
      clean = `sample_avatar/${clean}`;
    }
  }

  // Prevent double prefix 'sample_avatar/sample_avatar/'
  clean = clean.replace(/^(sample_avatar\/)+/, 'sample_avatar/');

  // 4. Build query string for version if provided
  const versionParam = opts.version
    ? (clean.includes('?') ? `&v=${encodeURIComponent(opts.version)}` : `?v=${encodeURIComponent(opts.version)}`)
    : '';

  // 5. Append serverPort / origin if provided
  if (opts.serverPort) {
    return `http://127.0.0.1:${opts.serverPort}/${clean}${versionParam}`;
  }

  // 6. Return root-relative URL (e.g. /assets/foo.png or /sample_avatar/assets/body.png)
  return `/${clean}${versionParam}`;
}
