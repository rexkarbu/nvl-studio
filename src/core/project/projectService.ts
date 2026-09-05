import fs from 'fs';
import path from 'path';
import { ProjectManifest } from './types';
import { parseAndValidateManifest } from './manifestSchema';
import { DEFAULT_PROJECT_MANIFEST } from './defaultProject';

export interface ProjectLoadResult {
  manifest: ProjectManifest;
  projectDir: string;
  filePath: string;
}

export class ProjectService {
  /**
   * Creates a new project in the target directory.
   * Copies default assets into <targetDir>/assets/ and creates project.nvl.
   */
  public static async newProject(
    targetDir: string,
    projectName?: string,
    sampleAssetsDir?: string
  ): Promise<ProjectLoadResult> {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const assetsDir = path.join(targetDir, 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    // Determine source assets to copy
    const sourceDir =
      sampleAssetsDir ||
      path.resolve(__dirname, '../../../sample_avatar/assets') ||
      path.resolve(process.cwd(), 'sample_avatar/assets');

    if (fs.existsSync(sourceDir)) {
      const files = fs.readdirSync(sourceDir);
      for (const file of files) {
        if (file.endsWith('.png')) {
          fs.copyFileSync(path.join(sourceDir, file), path.join(assetsDir, file));
        }
      }
    }

    const name = projectName || path.basename(targetDir);
    const now = new Date().toISOString();

    const manifest: ProjectManifest = {
      ...DEFAULT_PROJECT_MANIFEST,
      projectId: path.basename(targetDir).toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      metadata: {
        name,
        createdAt: now,
        updatedAt: now,
        version: '1.0.0',
      },
      assets: DEFAULT_PROJECT_MANIFEST.assets.map((asset) => ({
        ...asset,
        path: `assets/${path.basename(asset.path)}`,
      })),
      outputConfig: {
        preferredPort: 17777,
        transparent: true,
      },
    };

    const filePath = path.join(targetDir, 'project.nvl');
    fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2), 'utf-8');

    return {
      manifest,
      projectDir: targetDir,
      filePath,
    };
  }

  /**
   * Opens and validates an existing project file.
   * Backs up corrupted file as .nvl.bak if invalid.
   */
  public static async openProject(filePath: string): Promise<ProjectLoadResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Project file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const result = parseAndValidateManifest(content);

    if (!result.valid || !result.manifest) {
      // Backup corrupted file to avoid accidental data loss if no backup exists
      try {
        const backupPath = `${filePath}.bak`;
        if (!fs.existsSync(backupPath)) {
          fs.copyFileSync(filePath, backupPath);
        }
      } catch {
        // Ignore failure if directory is read-only
      }
      throw new Error(`Failed to load project: ${result.error}`);
    }

    return {
      manifest: result.manifest,
      projectDir: path.dirname(filePath),
      filePath,
    };
  }

  /**
   * Saves changes to the current project manifest.
   */
  public static async saveProject(
    filePath: string,
    manifest: ProjectManifest
  ): Promise<ProjectManifest> {
    // Create backup of existing file before overwrite
    if (fs.existsSync(filePath)) {
      try {
        fs.copyFileSync(filePath, `${filePath}.bak`);
      } catch {
        // ignore backup copy failure in read-only environments
      }
    }

    const updated: ProjectManifest = {
      ...manifest,
      metadata: {
        ...manifest.metadata,
        updatedAt: new Date().toISOString(),
      },
    };

    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
    return updated;
  }

  /**
   * Restores a project from its .bak backup file.
   */
  public static async restoreBackup(filePath: string): Promise<ProjectLoadResult> {
    const backupPath = `${filePath}.bak`;
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    const result = await this.openProject(backupPath);
    fs.copyFileSync(backupPath, filePath);
    return {
      manifest: result.manifest,
      projectDir: path.dirname(filePath),
      filePath,
    };
  }

  /**
   * Saves project to a new directory/file and copies all assets.
   */
  public static async saveProjectAs(
    newFilePath: string,
    manifest: ProjectManifest,
    currentProjectDir?: string
  ): Promise<ProjectLoadResult> {
    const newDir = path.dirname(newFilePath);
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, { recursive: true });
    }

    const newAssetsDir = path.join(newDir, 'assets');
    if (!fs.existsSync(newAssetsDir)) {
      fs.mkdirSync(newAssetsDir, { recursive: true });
    }

    // Copy assets from old project dir or default sample assets to new project dir
    let sourceAssetsDir: string | null = null;
    if (currentProjectDir && fs.existsSync(path.join(currentProjectDir, 'assets'))) {
      sourceAssetsDir = path.join(currentProjectDir, 'assets');
    } else {
      const fallbackDir = path.resolve(process.cwd(), 'sample_avatar/assets');
      if (fs.existsSync(fallbackDir)) {
        sourceAssetsDir = fallbackDir;
      }
    }

    if (sourceAssetsDir && fs.existsSync(sourceAssetsDir)) {
      const files = fs.readdirSync(sourceAssetsDir);
      for (const file of files) {
        if (file.endsWith('.png')) {
          fs.copyFileSync(path.join(sourceAssetsDir, file), path.join(newAssetsDir, file));
        }
      }
    }

    const updated = await this.saveProject(newFilePath, manifest);

    return {
      manifest: updated,
      projectDir: newDir,
      filePath: newFilePath,
    };
  }
}
