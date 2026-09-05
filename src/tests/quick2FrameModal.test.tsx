// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Quick2FrameModal, Quick2FrameModalProps } from '../modules/workspace/Quick2FrameModal';
import { CharacterResolver } from '../core/resolver/CharacterResolver';
import { createReactiveManifest } from './helpers/reactiveAvatar';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Quick 2-Frame modal sessions', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let manifest: ReturnType<typeof createReactiveManifest>;
  let applied: Parameters<Quick2FrameModalProps['onApply2FrameRig']>[0] | undefined;

  const render = (isOpen = true) => act(() => root.render(
    <Quick2FrameModal isOpen={isOpen} manifest={manifest} onClose={() => {}} onApply2FrameRig={(value) => { applied = value; }} />
  ));
  const select = (label: string) => container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
  const apply = () => act(() => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Terapkan Avatar'))!.click());

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    manifest = createReactiveManifest();
    applied = undefined;
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('reopens the assigned portraits, not eye sample assets, and applies the current idle settings', () => {
    render(false);
    render();
    expect(select('Frame diam').value).toBe('user-idle');
    expect(select('Frame bicara').value).toBe('user-talk');
    apply();
    expect(applied?.layers.map((layer) => layer.assetId)).toEqual(['user-idle', 'user-talk']);
    expect(applied?.idleConfig).toEqual(manifest.idleConfig);
    render(false);
    manifest = { ...manifest, idleConfig: { ...manifest.idleConfig!, idleBrightness: 0.8, enabled: true, dimWhenSilent: false } };
    render();
    apply();
    expect(applied?.idleConfig).toEqual(manifest.idleConfig);
  });

  it('keeps draft choices during manifest updates and resets invalid choices on project switch', () => {
    render();
    act(() => {
      select('Frame bicara').value = 'user-idle';
      select('Frame bicara').dispatchEvent(new Event('change', { bubbles: true }));
    });
    manifest = { ...manifest, assets: [...manifest.assets], idleConfig: { ...manifest.idleConfig!, idleBrightness: 0.9 } };
    render();
    expect(select('Frame bicara').value).toBe('user-idle');
    expect(container.querySelector<HTMLInputElement>('input[type="range"]')!.value).toBe('0.4');
    manifest = { ...createReactiveManifest('another-project'), assets: [], layers: [] };
    render();
    expect(select('Frame diam').value).toBe('');
    expect(select('Frame bicara').value).toBe('');
    apply();
    expect(applied).toBeUndefined();
  });

  it('does not guess eye-only assets as full avatar frames', () => {
    manifest = { ...manifest, layers: [], assets: manifest.assets.filter((asset) => asset.name.toLowerCase().includes('eye')) };
    render();
    expect(select('Frame diam').value).toBe('');
    expect(select('Frame bicara').value).toBe('');
  });

  it('runs the real Apply five times, preserving transforms and hiding all superseded mouths', () => {
    const body = createReactiveManifest().layers[0];
    manifest.layers.push(
      { ...body, id: 'body', role: 'body' },
      { ...body, id: 'closed-duplicate' },
      { ...body, id: 'open-duplicate', role: 'mouth_open' },
      { ...body, id: 'old-small', role: 'mouth_small' }
    );
    const originalLayers = structuredClone(manifest.layers);
    for (let iteration = 0; iteration < 5; iteration++) {
      render();
      act(() => Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).at(-1)!.click());
      apply();
      expect(applied!.layers).toHaveLength(originalLayers.length);
      expect(applied!.layers.slice(0, 3)).toEqual(originalLayers.slice(0, 3));
      expect(applied!.layers.slice(3).every((layer) => layer.role === 'custom' && !layer.visible)).toBe(true);
      const resolved = CharacterResolver.resolve(applied!.layers, { voiceActivity: true, voiceLevel: 0, blink: false }, 0, undefined, manifest.mouthConfig);
      expect(resolved.activeLayers.map((item) => item.layer.id).sort()).toEqual(['body', 'frame-1']);
      manifest = { ...manifest, ...applied };
      render(false);
    }
  });
});
