import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import net from 'net';
import { ProjectService } from '../core/project/projectService';
import { CanvasAvatarRenderer } from '../core/renderer/CanvasAvatarRenderer';
import { resolveAvailablePort } from '../../electron/server/localServer';
import { ResolvedVisualState } from '../core/resolver/types';

describe('STEP 11 Hardening: Error Resilience & Recovery', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nvl-error-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }
  });

  it('should automatically create .bak backup before overwrite in saveProject', async () => {
    const projectPath = path.join(tempDir, 'project.nvl');
    const { manifest } = await ProjectService.newProject(tempDir, 'Backup Test');

    // First save creates initial file
    await ProjectService.saveProject(projectPath, manifest);
    expect(fs.existsSync(projectPath)).toBe(true);

    // Second save should create .bak of the first state
    const modified = { ...manifest, metadata: { ...manifest.metadata, name: 'Modified Name' } };
    await ProjectService.saveProject(projectPath, modified);

    const backupPath = `${projectPath}.bak`;
    expect(fs.existsSync(backupPath)).toBe(true);

    const backupContent = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    expect(backupContent.metadata.name).toBe('Backup Test');
  });

  it('should restore valid manifest from .bak when main project file is corrupted', async () => {
    const projectPath = path.join(tempDir, 'project.nvl');
    const { manifest } = await ProjectService.newProject(tempDir, 'Recovery Test');

    // Save initial project
    await ProjectService.saveProject(projectPath, manifest);

    // Save modified version -> triggers backup of 'Recovery Test' to .bak
    const modified = { ...manifest, metadata: { ...manifest.metadata, name: 'Valid Saved State' } };
    await ProjectService.saveProject(projectPath, modified);

    // Corrupt the main file
    fs.writeFileSync(projectPath, '{"invalid_json": corrupt content');

    // Trying to open corrupted file throws
    await expect(ProjectService.openProject(projectPath)).rejects.toThrow();

    // Restoring from backup should succeed and return the backed up state
    const restored = await ProjectService.restoreBackup(projectPath);
    expect(restored.manifest.metadata.name).toBe('Recovery Test');
    expect(fs.existsSync(projectPath)).toBe(true);
  });

  it('should render missing asset placeholder without crashing CanvasAvatarRenderer', () => {
    const fillRectSpy = vi.fn();
    const strokeRectSpy = vi.fn();
    const fillTextSpy = vi.fn();

    const mockCtx: any = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      fillRect: fillRectSpy,
      strokeRect: strokeRectSpy,
      fillText: fillTextSpy,
      setLineDash: vi.fn(),
      globalAlpha: 1,
    };

    const mockCanvas: any = {
      getContext: () => mockCtx,
      width: 1280,
      height: 720,
    };

    const renderer = new CanvasAvatarRenderer({
      canvas: mockCanvas,
      virtualWidth: 1280,
      virtualHeight: 720,
    });

    const missingState: ResolvedVisualState = {
      activeLayers: [
        {
          layer: {
            id: 'layer-missing',
            name: 'Nonexistent Asset Layer',
            type: 'sprite',
            assetId: 'asset-missing-404',
            role: 'custom',
            visible: true,
            opacity: 1,
            zIndex: 1,
            x: 100,
            y: 100,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
          },
          assetId: 'asset-missing-404',
          opacity: 1,
          x: 100,
          y: 100,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          zIndex: 1,
        },
      ],
      voiceState: 'idle',
      isBlinking: false,
      voiceLevel: 0,
    };

    // Rendering missing asset should not throw and should draw placeholder
    expect(() => renderer.render(missingState)).not.toThrow();
    expect(fillRectSpy).toHaveBeenCalled();
    expect(strokeRectSpy).toHaveBeenCalled();
    expect(fillTextSpy).toHaveBeenCalledWith('Missing Asset:', 0, -14);
  });

  it('should resolve next available port when preferred port is occupied', async () => {
    // Occupy a port with a dummy server
    const basePort = 19550;
    const dummyServer = net.createServer();
    await new Promise<void>((resolve) => {
      dummyServer.listen(basePort, '127.0.0.1', () => resolve());
    });

    try {
      const resolved = await resolveAvailablePort(basePort, 10);
      expect(resolved).toBe(basePort + 1);
    } finally {
      await new Promise<void>((resolve) => {
        dummyServer.close(() => resolve());
      });
    }
  });
});
