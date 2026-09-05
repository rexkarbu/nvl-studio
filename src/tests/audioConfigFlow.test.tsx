// @vitest-environment jsdom
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { AudioVAD } from '../core/audio/AudioVAD';
import { ProjectService } from '../core/project/projectService';
import { ProjectManifest } from '../core/project/types';
import { CanvasAvatarRenderer } from '../core/renderer/CanvasAvatarRenderer';
import { createCanvasHarness } from './helpers/canvasHarness';
import { createReactiveManifest } from './helpers/reactiveAvatar';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Audio settings across App, panels and project persistence', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let tempDir: string;
  let projectFile: string;

  const clickText = async (text: string) => act(async () => {
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.includes(text));
    expect(button, `Button ${text}`).toBeDefined();
    button!.click();
  });
  const slider = (label: string) => container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
  const changeSlider = async (label: string, value: string) => act(async () => {
    const input = slider(label);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  beforeEach(async () => {
    window.history.replaceState({}, '', '/');
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nvl-audio-flow-'));
    projectFile = path.join(tempDir, 'project.nvl');
    const manifest = createReactiveManifest();
    manifest.audioConfig = { ...manifest.audioConfig, threshold: 0.12, sensitivity: 5, releaseDelayMs: 850 };
    await ProjectService.saveProject(projectFile, manifest);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('WebSocket', class { close() {} send() {} });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(createCanvasHarness().context);
    vi.spyOn(CanvasAvatarRenderer.prototype, 'registerAsset').mockResolvedValue({} as HTMLImageElement);
    vi.spyOn(AudioVAD.prototype, 'start').mockResolvedValue();
    vi.spyOn(AudioVAD.prototype, 'autoCalibrate').mockResolvedValue(0.18);
    Object.defineProperty(window, 'nvlDesktop', { configurable: true, value: {
      getServerInfo: async () => ({ port: 17777 }),
      openProject: async () => ({ canceled: false, ...await ProjectService.openProject(projectFile) }),
      saveProject: async (value: ProjectManifest) => ({ canceled: false, manifest: await ProjectService.saveProject(projectFile, value) }),
      promptSaveChanges: async () => 'discard',
    } });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    Reflect.deleteProperty(window, 'nvlDesktop');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    const resolved = path.resolve(tempDir);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir())) throw new Error('Unexpected test cleanup directory');
    fs.rmSync(resolved, { recursive: true, force: true });
  });

  it('hydrates VAD without a mounted panel, shares sliders and calibration, then saves/reopens the same settings', async () => {
    const sync = vi.spyOn(AudioVAD.prototype, 'updateConfig');
    await act(async () => root.render(<App />));
    await act(async () => container.querySelector<HTMLButtonElement>('button[title="Open project.nvl"]')!.click());
    const engine = sync.mock.contexts.at(-1)! as AudioVAD;
    expect(container.querySelector('.controls-panel')).toBeNull();
    expect(engine.getConfig()).toMatchObject({ threshold: 0.12, sensitivity: 5, releaseDelayMs: 850 });

    await clickText('Live Controls');
    expect(slider('Speaking release delay').value).toBe('850');
    await changeSlider('Speaking release delay', '1000');
    await changeSlider('Voice threshold', '0.2');
    await changeSlider('Microphone sensitivity', '6');
    await clickText('Simulator');
    expect(slider('Speaking release delay').value).toBe('1000');
    expect(slider('Voice threshold').value).toBe('0.2');
    expect(slider('Microphone sensitivity').value).toBe('6');
    await changeSlider('Speaking release delay', '200');
    await changeSlider('Microphone sensitivity', '7');
    await clickText('Auto Calibrate Noise');
    await clickText('Animator');
    expect(slider('Voice threshold').value).toBe('0.18');
    expect(slider('Microphone sensitivity').value).toBe('7');
    expect(slider('Speaking release delay').value).toBe('200');
    expect(engine.getConfig()).toMatchObject({ threshold: 0.18, sensitivity: 7, releaseDelayMs: 200 });

    await act(async () => container.querySelector<HTMLButtonElement>('button[title="Save Project (Ctrl+S)"]')!.click());
    const saved = await ProjectService.openProject(projectFile);
    expect(saved.manifest.audioConfig).toMatchObject(engine.getConfig());
    expect(saved.manifest.reactive2Frame).toBe(true);
    expect(saved.manifest.mouthConfig?.reactive2Frame).toBe(true);
    expect(saved.manifest.idleConfig?.idleBrightness).toBe(0.4);

    await changeSlider('Speaking release delay', '50');
    await clickText('Inspector');
    await act(async () => container.querySelector<HTMLButtonElement>('button[title="Open project.nvl"]')!.click());
    expect(engine.getConfig().releaseDelayMs).toBe(200);
    await clickText('Live Controls');
    expect(slider('Speaking release delay').value).toBe('200');
  });
});
