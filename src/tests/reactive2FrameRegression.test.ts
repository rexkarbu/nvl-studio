import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveAssetUrl } from '../core/project/assetUrl';
import { CharacterResolver } from '../core/resolver/CharacterResolver';
import { AudioVAD } from '../core/audio/AudioVAD';
import { ParameterStore } from '../core/parameters/ParameterStore';
import { CharacterLayer, MouthConfig } from '../core/project/types';
import { DEFAULT_MOUTH_THRESHOLDS } from '../core/audio/MouthShapeMapper';
import { AvatarParameters } from '../core/parameters/types';
import { applyReactive2FrameLayers } from '../core/project/reactive2Frame';
import { CanvasAvatarRenderer } from '../core/renderer/CanvasAvatarRenderer';
import { createCanvasHarness } from './helpers/canvasHarness';

describe('2-Frame Reactive PNGtuber Hardening & Regression Suite', () => {
  // =========================================================================
  // Suite 1: resolveAssetUrl Contract & Context Normalization
  // =========================================================================
  describe('1. resolveAssetUrl Contract & Context Normalization', () => {
    it('normalizes sample context without port to root-relative path', () => {
      const url = resolveAssetUrl('assets/body.png', { context: 'sample' });
      expect(url).toBe('/sample_avatar/assets/body.png');
    });

    it('normalizes sample context with serverPort to absolute server origin', () => {
      const url = resolveAssetUrl('assets/body.png', {
        context: 'sample',
        serverPort: 17777,
      });
      expect(url).toBe('http://127.0.0.1:17777/sample_avatar/assets/body.png');
    });

    it('prevents double prefix when sample_avatar/ is already in path (no port)', () => {
      const url = resolveAssetUrl('sample_avatar/assets/mouth-open.png', {
        context: 'sample',
      });
      expect(url).toBe('/sample_avatar/assets/mouth-open.png');
    });

    it('prevents double prefix when sample_avatar/ is already in path (with port)', () => {
      const url = resolveAssetUrl('sample_avatar/assets/mouth-open.png', {
        context: 'sample',
        serverPort: 17777,
      });
      expect(url).toBe('http://127.0.0.1:17777/sample_avatar/assets/mouth-open.png');
    });

    it('collapses accidental multiple sample_avatar/ prefixes', () => {
      const url = resolveAssetUrl('sample_avatar/sample_avatar/assets/body.png', {
        context: 'sample',
      });
      expect(url).toBe('/sample_avatar/assets/body.png');
    });

    it('resolves active project assets without port to root-relative path', () => {
      const url = resolveAssetUrl('assets/character-talking.png');
      expect(url).toBe('/assets/character-talking.png');
    });

    it('resolves active project assets with serverPort to absolute server origin', () => {
      const url = resolveAssetUrl('assets/character-talking.png', {
        serverPort: 17777,
      });
      expect(url).toBe('http://127.0.0.1:17777/assets/character-talking.png');
    });

    it('appends cache-busting version token properly', () => {
      const urlNoPort = resolveAssetUrl('assets/frame.png', { version: '123' });
      expect(urlNoPort).toBe('/assets/frame.png?v=123');

      const urlWithPort = resolveAssetUrl('assets/frame.png', {
        serverPort: 17777,
        version: '123',
      });
      expect(urlWithPort).toBe('http://127.0.0.1:17777/assets/frame.png?v=123');
    });

    it('keeps Data URLs, Blob URLs, and HTTP URLs completely untouched', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      expect(resolveAssetUrl(dataUrl)).toBe(dataUrl);
      expect(resolveAssetUrl(dataUrl, { context: 'sample', serverPort: 17777 })).toBe(dataUrl);

      const blobUrl = 'blob:http://localhost:17777/some-guid';
      expect(resolveAssetUrl(blobUrl, { serverPort: 17777 })).toBe(blobUrl);

      const httpUrl = 'https://example.com/remote-avatar.png';
      expect(resolveAssetUrl(httpUrl, { context: 'sample', serverPort: 17777 })).toBe(httpUrl);
    });
  });

  // =========================================================================
  // Suite 2: VAD Release Delay Timing (delay-1, exact delay, delay+1) & Frame/Brightness Sync
  // =========================================================================
  describe('2. Speaking Release Delay Precision & Frame/Brightness Sync', () => {
    let perfNowMock: any;
    let mockTime = 1000;

    beforeEach(() => {
      mockTime = 1000;
      perfNowMock = vi.spyOn(performance, 'now').mockImplementation(() => mockTime);
      vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
      vi.stubGlobal('cancelAnimationFrame', vi.fn());
    });

    afterEach(() => {
      perfNowMock.mockRestore();
      vi.unstubAllGlobals();
    });

    it.each([50, 200, 1000])('holds the talking image and renderer brightness until the %i ms deadline', (releaseDelay) => {
      const store = new ParameterStore();
      const vad = new AudioVAD(store);

      vad.updateConfig({
        threshold: 0.1,
        sensitivity: 1.0,
        releaseDelayMs: releaseDelay,
      });

      // Provide mock analyser to drive loop() directly
      let audioBuffer = new Float32Array(512);
      (vad as any).analyser = {
        fftSize: 512,
        disconnect: vi.fn(),
        getFloatTimeDomainData: (arr: Float32Array) => {
          arr.set(audioBuffer);
        },
      };
      (vad as any).isRunning = true;

      const layers: CharacterLayer[] = [
        {
          id: 'l-idle',
          name: 'Idle',
          type: 'sprite',
          assetId: 'asset-idle',
          role: 'mouth_closed',
          x: 960,
          y: 540,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
          visible: true,
          zIndex: 0,
        },
        {
          id: 'l-talk',
          name: 'Talking',
          type: 'sprite',
          assetId: 'asset-talk',
          role: 'mouth_open',
          x: 960,
          y: 540,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
          visible: true,
          zIndex: 1,
        },
      ];

      const mouthConfig: MouthConfig = {
        thresholds: { ...DEFAULT_MOUTH_THRESHOLDS },
        continuousMode: false,
        reactive2Frame: true,
      };

      const { context, draws } = createCanvasHarness();
      const canvas = { getContext: () => context } as unknown as HTMLCanvasElement;
      const renderer = new CanvasAvatarRenderer({ canvas });
      const idleImage = { complete: true, naturalWidth: 10, naturalHeight: 10 } as HTMLImageElement;
      const talkImage = { complete: true, naturalWidth: 10, naturalHeight: 10 } as HTMLImageElement;
      renderer.setAsset('asset-idle', idleImage);
      renderer.setAsset('asset-talk', talkImage);
      const idleConfig = { enabled: false, amplitude: 8, speed: 1.5, dimWhenSilent: true, idleBrightness: 0.4 };
      const checkRendered = (resolved: ReturnType<typeof CharacterResolver.resolve>, talking: boolean) => {
        renderer.render(resolved, idleConfig);
        expect(draws.at(-1)).toEqual({ image: talking ? talkImage : idleImage, filter: talking ? 'none' : 'brightness(40%)' });
        expect(context.filter).toBe('none');
      };

      // Tick 1: User speaks at t = 1000ms with energy > threshold (0.5)
      mockTime = 1000;
      audioBuffer.fill(0.5);
      (vad as any).loop();

      const snapshot1 = store.getSnapshot();
      expect(snapshot1.voiceActivity).toBe(true);

      const resolved1 = CharacterResolver.resolve(layers, snapshot1, 0, undefined, mouthConfig);
      expect(resolved1.activeLayers[0].layer.role).toBe('mouth_open');
      expect(resolved1.voiceState).toBe('talking'); // 100% brightness
      checkRendered(resolved1, true);

      // Tick 2: User stops speaking (silence). Check at t = 1000 + releaseDelay - 1 (delay - 1)
      mockTime = 1000 + releaseDelay - 1;
      audioBuffer.fill(0.0);
      (vad as any).loop();

      const snapshotDelayMinus1 = store.getSnapshot();
      expect(snapshotDelayMinus1.voiceActivity).toBe(true);

      const resolvedDelayMinus1 = CharacterResolver.resolve(layers, snapshotDelayMinus1, 0, undefined, mouthConfig);
      // At delay - 1: Talking frame held, brightness is 100% (voiceState === 'talking')
      expect(resolvedDelayMinus1.activeLayers[0].layer.role).toBe('mouth_open');
      expect(resolvedDelayMinus1.voiceState).toBe('talking');
      checkRendered(resolvedDelayMinus1, true);

      // Tick 3: Exactly at t = 1000 + releaseDelay (exact delay)
      mockTime = 1000 + releaseDelay;
      audioBuffer.fill(0.0);
      (vad as any).loop();

      const snapshotExactDelay = store.getSnapshot();
      expect(snapshotExactDelay.voiceActivity).toBe(false);

      const resolvedExactDelay = CharacterResolver.resolve(layers, snapshotExactDelay, 0, undefined, mouthConfig);
      // At exact delay: Frame switched to mouth_closed, brightness switched to idle (voiceState === 'idle')
      expect(resolvedExactDelay.activeLayers[0].layer.role).toBe('mouth_closed');
      expect(resolvedExactDelay.voiceState).toBe('idle');
      checkRendered(resolvedExactDelay, false);

      // Tick 4: After delay at t = 1000 + releaseDelay + 1 (delay + 1)
      mockTime = 1000 + releaseDelay + 1;
      audioBuffer.fill(0.0);
      (vad as any).loop();

      const snapshotDelayPlus1 = store.getSnapshot();
      expect(snapshotDelayPlus1.voiceActivity).toBe(false);

      const resolvedDelayPlus1 = CharacterResolver.resolve(layers, snapshotDelayPlus1, 0, undefined, mouthConfig);
      expect(resolvedDelayPlus1.activeLayers[0].layer.role).toBe('mouth_closed');
      expect(resolvedDelayPlus1.voiceState).toBe('idle');
      checkRendered(resolvedDelayPlus1, false);

      vad.stop();
    });
  });

  // =========================================================================
  // Suite 3: Legacy Continuous Mode Contract vs Reactive 2-Frame Mode
  // =========================================================================
  describe('3. Legacy Continuous Mode Non-Regression vs Reactive 2-Frame', () => {
    const twoMouthLayers: CharacterLayer[] = [
      {
        id: 'l-closed',
        name: 'Mouth Closed',
        type: 'sprite',
        assetId: 'asset-mouth-closed',
        role: 'mouth_closed',
        x: 960,
        y: 540,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        visible: true,
        zIndex: 0,
      },
      {
        id: 'l-open',
        name: 'Mouth Open',
        type: 'sprite',
        assetId: 'asset-mouth-open',
        role: 'mouth_open',
        x: 960,
        y: 540,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        visible: true,
        zIndex: 1,
      },
    ];

    it('preserves legacy continuous mode contract: mouthOpen <= 0.05 resolves to mouth_closed even with voiceActivity=true', () => {
      const legacyContinuousConfig: MouthConfig = {
        thresholds: { ...DEFAULT_MOUTH_THRESHOLDS },
        continuousMode: true,
      };

      const paramsLowVolume: AvatarParameters = {
        voiceActivity: true,
        voiceLevel: 0.02,
        mouthOpen: 0.02,
        blink: false,
      };

      const res = CharacterResolver.resolve(twoMouthLayers, paramsLowVolume, 0, undefined, legacyContinuousConfig);
      expect(res.activeLayers.map((l) => l.layer.role)).toContain('mouth_closed');
      expect(res.activeLayers.map((l) => l.layer.role)).not.toContain('mouth_open');
    });

    it('in reactive 2-frame mode, voiceActivity=true always resolves to mouth_open regardless of mouthOpen level', () => {
      const reactiveConfig: MouthConfig = {
        thresholds: { ...DEFAULT_MOUTH_THRESHOLDS },
        continuousMode: true,
        reactive2Frame: true,
      };

      const paramsLowVolume: AvatarParameters = {
        voiceActivity: true,
        voiceLevel: 0.02,
        mouthOpen: 0.02,
        blink: false,
      };

      const res = CharacterResolver.resolve(twoMouthLayers, paramsLowVolume, 0, undefined, reactiveConfig);
      expect(res.activeLayers.map((l) => l.layer.role)).toContain('mouth_open');
      expect(res.activeLayers.map((l) => l.layer.role)).not.toContain('mouth_closed');
    });

    it('falls back gracefully if reactive2Frame is requested but required mouth_open role is absent', () => {
      const singleMouthLayers: CharacterLayer[] = [
        { ...twoMouthLayers[0], role: 'mouth_closed' },
      ];
      const reactiveConfig: Partial<MouthConfig> = {
        reactive2Frame: true,
      };
      const params: AvatarParameters = {
        voiceActivity: true,
        voiceLevel: 0.6,
        mouthOpen: 0.6,
        blink: false,
      };
      const res = CharacterResolver.resolve(singleMouthLayers, params, 0, undefined, reactiveConfig);
      expect(res.activeLayers.length).toBe(1);
      expect(res.activeLayers[0].layer.role).toBe('mouth_closed');
    });
  });

  // =========================================================================
  // Suite 4: Idle Bobbing on Reactive 2-Frame Full Avatar (Clean Replace OFF)
  // =========================================================================
  describe('4. Idle Bobbing on Reactive 2-Frame Avatar with Preserved Body Layer', () => {
    it('applies idleBobOffset to mouth_closed even when old body layer is present', () => {
      const layersWithOldBody: CharacterLayer[] = [
        {
          id: 'old-body',
          name: 'Old Body',
          type: 'sprite',
          assetId: 'asset-old-body',
          role: 'body',
          x: 960,
          y: 540,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
          visible: true,
          zIndex: 0,
        },
        {
          id: 'layer-idle',
          name: 'Idle Full Avatar',
          type: 'sprite',
          assetId: 'asset-idle',
          role: 'mouth_closed',
          x: 960,
          y: 540,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
          visible: true,
          zIndex: 1,
        },
        {
          id: 'layer-talk',
          name: 'Talking Full Avatar',
          type: 'sprite',
          assetId: 'asset-talk',
          role: 'mouth_open',
          x: 960,
          y: 540,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
          visible: true,
          zIndex: 2,
        },
      ];

      const reactiveMouthConfig: Partial<MouthConfig> = {
        reactive2Frame: true,
      };

      const idleParams: AvatarParameters = {
        voiceActivity: false,
        voiceLevel: 0,
        mouthOpen: 0,
        blink: false,
      };

      const bobOffset = 10;
      const res = CharacterResolver.resolve(layersWithOldBody, idleParams, bobOffset, undefined, reactiveMouthConfig);

      const idleMouth = res.activeLayers.find((l) => l.layer.role === 'mouth_closed');
      expect(idleMouth).toBeDefined();
      // In reactive 2-frame mode, mouth_closed is the avatar frame and receives the bob offset
      expect(idleMouth!.y).toBe(540 + bobOffset);

      // In multi-frame mode (reactive2Frame=false), legacy behavior targets body
      const multiFrameConfig: Partial<MouthConfig> = {
        reactive2Frame: false,
      };
      const resMulti = CharacterResolver.resolve(layersWithOldBody, idleParams, bobOffset, undefined, multiFrameConfig);
      const multiBody = resMulti.activeLayers.find((l) => l.layer.role === 'body');
      const multiMouth = resMulti.activeLayers.find((l) => l.layer.role === 'mouth_closed');
      expect(multiBody!.y).toBe(540 + bobOffset);
      expect(multiMouth!.y).toBe(540); // Mouth stayed steady while body moved
    });
  });

  // =========================================================================
  // Suite 5: Role Conflict Resolution & Deactivation (Clean Replace OFF)
  // =========================================================================
  describe('5. Clean Replace OFF Duplicate Deactivation & Transform Preservation', () => {
    it('deactivates superseded mouth layers and duplicates without stacking', () => {
      // Simulate existing complex multi-frame rig
      const initialLayers: CharacterLayer[] = [
        {
          id: 'layer-body',
          name: 'Body',
          type: 'sprite',
          assetId: 'asset-body',
          role: 'body',
          x: 960,
          y: 540,
          scaleX: 1.2,
          scaleY: 1.2,
          rotation: 5,
          opacity: 1,
          visible: true,
          zIndex: 0,
        },
        {
          id: 'layer-mouth-closed-1',
          name: 'Primary Mouth Closed',
          type: 'sprite',
          assetId: 'asset-old-closed-1',
          role: 'mouth_closed',
          x: 960,
          y: 560,
          scaleX: 1.1,
          scaleY: 1.1,
          rotation: 0,
          opacity: 1,
          visible: true,
          zIndex: 1,
        },
        {
          id: 'layer-mouth-closed-dup',
          name: 'Duplicate Mouth Closed',
          type: 'sprite',
          assetId: 'asset-old-closed-dup',
          role: 'mouth_closed',
          x: 960,
          y: 560,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
          visible: true,
          zIndex: 2,
        },
        {
          id: 'layer-mouth-open-1',
          name: 'Primary Mouth Open',
          type: 'sprite',
          assetId: 'asset-old-open-1',
          role: 'mouth_open',
          x: 960,
          y: 560,
          scaleX: 1.1,
          scaleY: 1.1,
          rotation: 0,
          opacity: 1,
          visible: true,
          zIndex: 3,
        },
        {
          id: 'layer-mouth-small',
          name: 'Mouth Small',
          type: 'sprite',
          assetId: 'asset-small',
          role: 'mouth_small',
          x: 960,
          y: 560,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
          visible: true,
          zIndex: 4,
        },
        {
          id: 'layer-mouth-medium',
          name: 'Mouth Medium',
          type: 'sprite',
          assetId: 'asset-med',
          role: 'mouth_medium',
          x: 960,
          y: 560,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
          visible: true,
          zIndex: 5,
        },
        {
          id: 'layer-mouth-wide',
          name: 'Mouth Wide',
          type: 'sprite',
          assetId: 'asset-wide',
          role: 'mouth_wide',
          x: 960,
          y: 560,
          scaleX: 1,
          scaleY: 1,
          rotation: 0,
          opacity: 1,
          visible: true,
          zIndex: 6,
        },
      ];

      // Call the production helper used by the modal, including its append path.
      const apply2Frame = (layers: CharacterLayer[], closedId: string, openId: string) =>
        applyReactive2FrameLayers(layers,
          { ...initialLayers[1], id: 'new-idle', assetId: closedId },
          { ...initialLayers[3], id: 'new-talking', assetId: openId }, false);

      const result1 = apply2Frame(initialLayers, 'new-frame1', 'new-frame2');

      // 1. Primary mouth layers updated with new assets, transforms preserved
      const primaryClosed = result1.find((l) => l.id === 'layer-mouth-closed-1');
      expect(primaryClosed?.assetId).toBe('new-frame1');
      expect(primaryClosed?.scaleX).toBe(1.1);
      expect(primaryClosed?.visible).toBe(true);
      expect(primaryClosed?.role).toBe('mouth_closed');

      const primaryOpen = result1.find((l) => l.id === 'layer-mouth-open-1');
      expect(primaryOpen?.assetId).toBe('new-frame2');
      expect(primaryOpen?.scaleX).toBe(1.1);
      expect(primaryOpen?.visible).toBe(true);
      expect(primaryOpen?.role).toBe('mouth_open');

      // 2. Old multi-frame mouths deactivated and hidden
      const small = result1.find((l) => l.id === 'layer-mouth-small');
      expect(small?.role).toBe('custom');
      expect(small?.visible).toBe(false);

      const dup = result1.find((l) => l.id === 'layer-mouth-closed-dup');
      expect(dup?.role).toBe('custom');
      expect(dup?.visible).toBe(false);

      // 3. Body preserved untouched
      const body = result1.find((l) => l.id === 'layer-body');
      expect(body?.visible).toBe(true);
      expect(body?.scaleX).toBe(1.2);

      // 4. CharacterResolver never renders deactivated layers
      const resolved = CharacterResolver.resolve(result1, {
        voiceActivity: false,
        voiceLevel: 0,
        mouthOpen: 0,
        blink: false,
      });
      const renderedRoles = resolved.activeLayers.map((l) => l.layer.id);
      expect(renderedRoles).toContain('layer-body');
      expect(renderedRoles).toContain('layer-mouth-closed-1');
      expect(renderedRoles).not.toContain('layer-mouth-small');
      expect(renderedRoles).not.toContain('layer-mouth-medium');
      expect(renderedRoles).not.toContain('layer-mouth-wide');
      expect(renderedRoles).not.toContain('layer-mouth-closed-dup');

      // 5. Re-applying repeatedly never creates duplicate layers or stacks frames
      const result2 = apply2Frame(result1, 'newer-frame1', 'newer-frame2');
      expect(result2.length).toBe(result1.length);
      const reClosed = result2.find((l) => l.id === 'layer-mouth-closed-1');
      expect(reClosed?.assetId).toBe('newer-frame1');
    });
  });
});
