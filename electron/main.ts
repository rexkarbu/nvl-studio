import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { LocalServer } from './server/localServer';
import { ProjectService } from '../src/core/project/projectService';
import { ProjectManifest, ProjectAssetEntry } from '../src/core/project/types';
import {
  sanitizeFilename,
  generateAssetId,
  validatePngBuffer,
  resolveUniqueAssetFilename,
} from '../src/core/project/assetImporter';

let mainWindow: BrowserWindow | null = null;
let localServer: LocalServer | null = null;

let currentProjectPath: string | null = null;
let currentProjectDir: string | null = null;
let isAppDirty: boolean = false;
let closePendingAfterSave: boolean = false;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Production hardening: suppress console.log in packaged builds
if (!isDev) {
  console.log = () => {};
}

// Single Instance Lock: prevent running multiple app instances simultaneously
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

async function startAppServer(): Promise<LocalServer> {
  const server = new LocalServer({
    preferredPort: 17777,
    staticDir: isDev ? path.resolve(process.cwd(), 'dist') : path.resolve(__dirname, '../dist'),
  });
  await server.start();
  return server;
}

function setupSecurityAndPermissions(): void {
  // Explicitly allow only microphone media requests from NVL
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'media') {
      return callback(true);
    }
    // Deny all other unsolicited permissions
    return callback(false);
  });

  // Block opening arbitrary external URLs in the app window
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    if (permission === 'media') return true;
    return false;
  });
}

function setupIpcHandlers(): void {
  ipcMain.handle('nvl:get-server-info', async () => {
    if (!localServer) {
      throw new Error('Local server is not initialized');
    }
    return localServer.getServerInfo();
  });

  ipcMain.handle('nvl:project-new', async (_event, projectName?: string) => {
    if (!mainWindow) return { canceled: true };

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Create New NVL Project (Choose Folder & Name)',
      defaultPath: projectName ? `${projectName}/project.nvl` : 'MyAvatar/project.nvl',
      filters: [{ name: 'NVL Project (*.nvl)', extensions: ['nvl'] }],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    const selectedFile = result.filePath;
    const targetDir = path.dirname(selectedFile);
    const sampleAssetsDir = isDev
      ? path.resolve(process.cwd(), 'sample_avatar/assets')
      : path.resolve(__dirname, '../sample_avatar/assets');

    try {
      const name = projectName || path.basename(targetDir);
      const res = await ProjectService.newProject(targetDir, name, sampleAssetsDir);
      currentProjectPath = res.filePath;
      currentProjectDir = res.projectDir;
      if (localServer) {
        localServer.setProjectDir(res.projectDir);
      }
      isAppDirty = false;
      mainWindow.webContents.send('nvl:project-dirty-changed', false);
      return { canceled: false, filePath: res.filePath, projectDir: res.projectDir, manifest: res.manifest };
    } catch (err: any) {
      return { canceled: false, error: err.message };
    }
  });

  ipcMain.handle('nvl:project-open', async () => {
    if (!mainWindow) return { canceled: true };

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Open NVL Project',
      filters: [
        { name: 'NVL Project (*.nvl)', extensions: ['nvl'] },
        { name: 'JSON (*.json)', extensions: ['json'] },
      ],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    try {
      const res = await ProjectService.openProject(filePath);
      currentProjectPath = res.filePath;
      currentProjectDir = res.projectDir;
      if (localServer) {
        localServer.setProjectDir(res.projectDir);
      }
      isAppDirty = false;
      mainWindow.webContents.send('nvl:project-dirty-changed', false);
      return { canceled: false, filePath: res.filePath, projectDir: res.projectDir, manifest: res.manifest };
    } catch (err: any) {
      const backupPath = `${filePath}.bak`;
      if (fs.existsSync(backupPath) && mainWindow) {
        const choice = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          buttons: ['Restore Backup', 'Cancel'],
          defaultId: 0,
          cancelId: 1,
          title: 'Corrupted Project Detected',
          message: 'The selected project file is corrupted or failed validation.',
          detail: `${err.message}\n\nA backup copy (.bak) exists. Would you like to restore from backup?`,
        });

        if (choice.response === 0) {
          try {
            const restored = await ProjectService.openProject(backupPath);
            fs.copyFileSync(backupPath, filePath);
            currentProjectPath = filePath;
            currentProjectDir = restored.projectDir;
            if (localServer) {
              localServer.setProjectDir(restored.projectDir);
            }
            isAppDirty = false;
            mainWindow.webContents.send('nvl:project-dirty-changed', false);
            return { canceled: false, filePath, projectDir: restored.projectDir, manifest: restored.manifest };
          } catch (restoreErr: any) {
            return { canceled: false, error: `Backup restore failed: ${restoreErr.message}` };
          }
        }
      }
      return { canceled: false, error: err.message };
    }
  });

  ipcMain.handle('nvl:project-save', async (_event, manifest: ProjectManifest) => {
    if (!currentProjectPath) {
      return handleSaveAs(manifest);
    }

    try {
      const updated = await ProjectService.saveProject(currentProjectPath, manifest);
      isAppDirty = false;
      mainWindow?.webContents.send('nvl:project-dirty-changed', false);

      if (closePendingAfterSave && mainWindow) {
        closePendingAfterSave = false;
        mainWindow.destroy();
      }

      return { canceled: false, filePath: currentProjectPath, projectDir: currentProjectDir || undefined, manifest: updated };
    } catch (err: any) {
      closePendingAfterSave = false;
      return { canceled: false, error: err.message };
    }
  });

  ipcMain.handle('nvl:project-save-as', async (_event, manifest: ProjectManifest) => {
    return handleSaveAs(manifest);
  });

  ipcMain.handle('nvl:project-get-current', async () => {
    return { filePath: currentProjectPath, projectDir: currentProjectDir };
  });

  ipcMain.handle('nvl:project-set-dirty', async (_event, dirty: boolean) => {
    isAppDirty = Boolean(dirty);
    mainWindow?.webContents.send('nvl:project-dirty-changed', isAppDirty);
  });

  ipcMain.handle('nvl:prompt-save-changes', async () => {
    if (!mainWindow) return 'discard';
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved Changes',
      message: 'You have unsaved changes in your NVL project. Do you want to save before proceeding?',
    });

    if (choice.response === 0) return 'save';
    if (choice.response === 1) return 'discard';
    return 'cancel';
  });

  ipcMain.handle('nvl:asset-import-png', async () => {
    if (!mainWindow) return { canceled: true };

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Import PNG Asset(s)',
      filters: [{ name: 'PNG Images (*.png)', extensions: ['png'] }],
      properties: ['openFile', 'multiSelections'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    let targetDir = currentProjectDir;
    if (!targetDir) {
      targetDir = path.join(app.getPath('temp'), 'nvl_staging');
      currentProjectDir = targetDir;
      if (localServer) {
        localServer.setProjectDir(targetDir);
      }
    }
    const assetsDir = path.join(targetDir, 'assets');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const importedAssets: ProjectAssetEntry[] = [];

    for (const filePath of result.filePaths) {
      try {
        const buffer = fs.readFileSync(filePath);
        if (!validatePngBuffer(buffer)) {
          continue; // Skip non-PNG or corrupted files
        }

        const baseName = path.basename(filePath, path.extname(filePath));
        const sanitized = sanitizeFilename(baseName);
        const uniqueFileName = resolveUniqueAssetFilename(assetsDir, sanitized);
        const destPath = path.join(assetsDir, uniqueFileName);

        fs.copyFileSync(filePath, destPath);

        const assetEntry: ProjectAssetEntry = {
          id: generateAssetId(baseName),
          name: baseName,
          path: `assets/${uniqueFileName}`,
          format: 'png',
        };

        importedAssets.push(assetEntry);
      } catch (err) {
        console.error('[Main IPC] Failed to import asset:', filePath, err);
      }
    }

    return { canceled: false, assets: importedAssets };
  });

  ipcMain.handle('nvl:show-message-box', async (_event, options: any) => {
    if (!mainWindow) return { response: 0 };
    return dialog.showMessageBox(mainWindow, options);
  });
}

async function handleSaveAs(manifest: ProjectManifest) {
  if (!mainWindow) return { canceled: true };

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save NVL Project As...',
    defaultPath: currentProjectPath || 'project.nvl',
    filters: [{ name: 'NVL Project (*.nvl)', extensions: ['nvl'] }],
  });

  if (result.canceled || !result.filePath) {
    closePendingAfterSave = false;
    return { canceled: true };
  }

  const newFilePath = result.filePath;
  try {
    const res = await ProjectService.saveProjectAs(newFilePath, manifest, currentProjectDir || undefined);
    currentProjectPath = res.filePath;
    currentProjectDir = res.projectDir;
    if (localServer) {
      localServer.setProjectDir(res.projectDir);
    }
    isAppDirty = false;
    mainWindow.webContents.send('nvl:project-dirty-changed', false);

    if (closePendingAfterSave && mainWindow) {
      closePendingAfterSave = false;
      mainWindow.destroy();
    }

    return { canceled: false, filePath: res.filePath, projectDir: res.projectDir, manifest: res.manifest };
  } catch (err: any) {
    closePendingAfterSave = false;
    return { canceled: false, error: err.message };
  }
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 650,
    title: 'NVL — Desktop PNGtuber Studio',
    backgroundColor: '#0f0e17',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  // Intercept window close when project has unsaved changes
  mainWindow.on('close', async (e) => {
    if (isAppDirty && mainWindow) {
      e.preventDefault();
      const choice = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        cancelId: 2,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes in your NVL project. Do you want to save before closing?',
      });

      if (choice.response === 0) {
        // Save requested: ask renderer to save, and close on completion
        closePendingAfterSave = true;
        mainWindow.webContents.send('nvl:trigger-save', { closeAfterSave: true });
      } else if (choice.response === 1) {
        // Discard changes and close window
        isAppDirty = false;
        closePendingAfterSave = false;
        mainWindow.destroy();
      }
      // If response === 2 (Cancel), do nothing
    }
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Application Lifecycle
app.whenReady().then(async () => {
  setupSecurityAndPermissions();
  setupIpcHandlers();

  try {
    localServer = await startAppServer();
    const info = localServer.getServerInfo();
    console.log(`[NVL Desktop] Local Server running on http://${info.host}:${info.port}`);
  } catch (err) {
    console.error('[NVL Desktop] Failed to start local server:', err);
  }

  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Graceful shutdown on app quit
app.on('before-quit', async () => {
  if (localServer) {
    console.log('[NVL Desktop] Shutting down local server gracefully...');
    await localServer.stop();
    localServer = null;
  }
});

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    if (localServer) {
      await localServer.stop();
      localServer = null;
    }
    app.quit();
  }
});

app.on('will-quit', async () => {
  if (localServer) {
    await localServer.stop();
    localServer = null;
  }
});
