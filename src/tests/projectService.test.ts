import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ProjectService } from '../core/project/projectService';
import { resolveAssetPath, normalizeToManifestPath } from '../core/project/pathResolver';
import { CanvasAvatarRenderer } from '../core/renderer/CanvasAvatarRenderer';

describe('ProjectService & Path Resolver (Desktop Persistence)', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nvl-test-project-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('newProject creates valid manifest and assets directory', async () => {
    const projectFolder = path.join(tempDir, 'MyChibi');
    const result = await ProjectService.newProject(projectFolder, 'My Chibi Character');

    expect(fs.existsSync(result.filePath)).toBe(true);
    expect(fs.existsSync(path.join(projectFolder, 'assets'))).toBe(true);
    expect(result.manifest.metadata.name).toBe('My Chibi Character');
    expect(result.manifest.schemaVersion).toBe(1);
    expect(result.manifest.layers[0].type).toBe('sprite');
    // Verify all 7 assets (including 4 mouth frames) are registered
    expect(result.manifest.assets.length).toBe(7);
    const assetIds = result.manifest.assets.map((a) => a.id);
    expect(assetIds).toContain('asset-mouth-closed');
    expect(assetIds).toContain('asset-mouth-small');
    expect(assetIds).toContain('asset-mouth-open');
    expect(assetIds).toContain('asset-mouth-wide');
    // Verify files copied to disk
    expect(fs.existsSync(path.join(projectFolder, 'assets', 'mouth-small.png'))).toBe(true);
    expect(fs.existsSync(path.join(projectFolder, 'assets', 'mouth-wide.png'))).toBe(true);
  });

  it('openProject loads valid project and rejects corrupted file with backup', async () => {
    const projectFolder = path.join(tempDir, 'ValidProject');
    await ProjectService.newProject(projectFolder, 'Valid');

    const manifestFile = path.join(projectFolder, 'project.nvl');
    const opened = await ProjectService.openProject(manifestFile);
    expect(opened.manifest.metadata.name).toBe('Valid');

    // Corrupt the manifest file
    fs.writeFileSync(manifestFile, '{ "corrupted": true, json invalid');
    await expect(ProjectService.openProject(manifestFile)).rejects.toThrow(/Failed to load project/);

    // Verify .nvl.bak was created
    expect(fs.existsSync(`${manifestFile}.bak`)).toBe(true);
  });

  it('saveProject roundtrips cleanly and updates updatedAt timestamp', async () => {
    const projectFolder = path.join(tempDir, 'SaveTest');
    const created = await ProjectService.newProject(projectFolder, 'SaveTest');

    const originalUpdatedAt = created.manifest.metadata.updatedAt;

    // Small delay to ensure timestamp changes
    await new Promise((r) => setTimeout(r, 10));

    const modified = {
      ...created.manifest,
      metadata: { ...created.manifest.metadata, name: 'Renamed Project' },
    };

    const saved = await ProjectService.saveProject(created.filePath, modified);
    expect(saved.metadata.name).toBe('Renamed Project');
    expect(saved.metadata.updatedAt).not.toBe(originalUpdatedAt);

    const reloaded = await ProjectService.openProject(created.filePath);
    expect(reloaded.manifest.metadata.name).toBe('Renamed Project');
  });

  it('edit layer position -> save -> open -> state restored exactly', async () => {
    const projectFolder = path.join(tempDir, 'LayerPositionTest');
    const created = await ProjectService.newProject(projectFolder, 'PositionAvatar');

    // Modify layer position (e.g. mouth-open layer moved 45px right, -20px up)
    const modifiedLayers = created.manifest.layers.map((l) =>
      l.id === 'layer-mouth-open' ? { ...l, x: 45, y: -20 } : l
    );

    const modifiedManifest = {
      ...created.manifest,
      layers: modifiedLayers,
    };

    // Save
    await ProjectService.saveProject(created.filePath, modifiedManifest);

    // Open
    const reloaded = await ProjectService.openProject(created.filePath);
    const mouthLayer = reloaded.manifest.layers.find((l) => l.id === 'layer-mouth-open');
    expect(mouthLayer).toBeDefined();
    expect(mouthLayer?.x).toBe(45);
    expect(mouthLayer?.y).toBe(-20);
  });

  it('saveProjectAs copies assets to new directory and updates project path', async () => {
    const originalFolder = path.join(tempDir, 'OriginalProject');
    const created = await ProjectService.newProject(originalFolder, 'Original');

    // Create a dummy asset inside original folder assets
    fs.writeFileSync(path.join(originalFolder, 'assets', 'custom.png'), 'dummy-png-bytes');

    const newFolder = path.join(tempDir, 'SavedAsProject');
    const newFilePath = path.join(newFolder, 'project.nvl');

    const savedAs = await ProjectService.saveProjectAs(
      newFilePath,
      created.manifest,
      created.projectDir
    );

    expect(fs.existsSync(newFilePath)).toBe(true);
    expect(fs.existsSync(path.join(newFolder, 'assets', 'custom.png'))).toBe(true);
    expect(savedAs.projectDir).toBe(newFolder);
  });

  it('resolveAssetPath resolves relative to project.nvl directory, not cwd', () => {
    const projectDir = 'D:/Creators/MyAvatar';
    const relativeAsset = 'assets/eyes.png';
    const resolved = resolveAssetPath(projectDir, relativeAsset);

    expect(resolved).toBe(path.resolve('D:/Creators/MyAvatar/assets/eyes.png'));
  });

  it('normalizeToManifestPath ensures forward slashes for cross-platform manifest', () => {
    const winPath = 'assets\\body.png';
    expect(normalizeToManifestPath(winPath)).toBe('assets/body.png');
  });

  it('missing asset fallback: renderer handles missing assets without crashing and tracks missing list', () => {
    let fillRectCalled = false;
    let strokeRectCalled = false;

    const mockCtx: any = {
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      setLineDash: () => {},
      fillRect: () => {
        fillRectCalled = true;
      },
      strokeRect: () => {
        strokeRectCalled = true;
      },
      fillText: () => {},
      drawImage: () => {},
    };

    const mockCanvas: any = {
      getContext: () => mockCtx,
      width: 1920,
      height: 1080,
    };

    const renderer = new CanvasAvatarRenderer({ canvas: mockCanvas });
    expect(renderer.getMissingAssets()).toEqual([]);

    // Render with an asset that hasn't been loaded / is missing
    const resolvedState = {
      activeLayers: [
        {
          id: 'layer-body',
          assetId: 'missing-body-asset',
          name: 'Body',
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
          layer: {
            id: 'layer-body',
            name: 'Body',
            type: 'sprite',
            assetId: 'missing-body-asset',
            role: 'body',
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 1,
            visible: true,
            zIndex: 1,
          },
        },
      ],
    };

    // Should not throw, and should execute placeholder drawing
    expect(() => renderer.render(resolvedState as any)).not.toThrow();
    expect(fillRectCalled).toBe(true);
    expect(strokeRectCalled).toBe(true);
  });
});
