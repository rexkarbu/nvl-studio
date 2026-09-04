import { contextBridge, ipcRenderer } from 'electron';
import { ProjectManifest, ProjectAssetEntry } from '../src/core/project/types';

export interface ServerInfo {
  host: string;
  port: number;
  liveUrlTemplate: string;
  wsUrlTemplate: string;
}

export interface ProjectOperationResult {
  canceled: boolean;
  filePath?: string;
  projectDir?: string;
  manifest?: ProjectManifest;
  error?: string;
}

export interface AssetImportResult {
  canceled: boolean;
  assets?: ProjectAssetEntry[];
  error?: string;
}

export interface NvlDesktopApi {
  getServerInfo: () => Promise<ServerInfo>;
  newProject: (projectName?: string) => Promise<ProjectOperationResult>;
  openProject: () => Promise<ProjectOperationResult>;
  saveProject: (manifest: ProjectManifest) => Promise<ProjectOperationResult>;
  saveProjectAs: (manifest: ProjectManifest) => Promise<ProjectOperationResult>;
  getCurrentProject: () => Promise<{ filePath: string | null; projectDir: string | null }>;
  setDirty: (dirty: boolean) => Promise<void>;
  promptSaveChanges: () => Promise<'save' | 'discard' | 'cancel'>;
  onTriggerSave: (callback: (options?: { closeAfterSave?: boolean }) => void) => () => void;
  onProjectDirty: (callback: (dirty: boolean) => void) => () => void;
  importPng: () => Promise<AssetImportResult>;
}

const nvlDesktopApi: NvlDesktopApi = {
  getServerInfo: () => ipcRenderer.invoke('nvl:get-server-info'),
  newProject: (projectName?: string) => ipcRenderer.invoke('nvl:project-new', projectName),
  openProject: () => ipcRenderer.invoke('nvl:project-open'),
  saveProject: (manifest: ProjectManifest) => ipcRenderer.invoke('nvl:project-save', manifest),
  saveProjectAs: (manifest: ProjectManifest) => ipcRenderer.invoke('nvl:project-save-as', manifest),
  getCurrentProject: () => ipcRenderer.invoke('nvl:project-get-current'),
  setDirty: (dirty: boolean) => ipcRenderer.invoke('nvl:project-set-dirty', dirty),
  promptSaveChanges: () => ipcRenderer.invoke('nvl:prompt-save-changes'),
  onTriggerSave: (callback: (options?: { closeAfterSave?: boolean }) => void) => {
    const listener = (_event: any, opts: any) => callback(opts);
    ipcRenderer.on('nvl:trigger-save', listener);
    return () => {
      ipcRenderer.removeListener('nvl:trigger-save', listener);
    };
  },
  onProjectDirty: (callback: (dirty: boolean) => void) => {
    const listener = (_event: any, dirty: boolean) => callback(dirty);
    ipcRenderer.on('nvl:project-dirty-changed', listener);
    return () => {
      ipcRenderer.removeListener('nvl:project-dirty-changed', listener);
    };
  },
  importPng: () => ipcRenderer.invoke('nvl:asset-import-png'),
};

// Expose safe API to renderer through contextBridge
contextBridge.exposeInMainWorld('nvlDesktop', nvlDesktopApi);
