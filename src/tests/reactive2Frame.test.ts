import { describe, it, expect, vi } from 'vitest';
import { validateRoleMapping, autoAssignRoles } from '../core/project/roleAssignment';
import { CharacterResolver } from '../core/resolver/CharacterResolver';
import { CharacterLayer, IdleConfig, ProjectManifest } from '../core/project/types';
import { AvatarParameters } from '../core/parameters/types';
import { validateManifest } from '../core/project/manifestSchema';
import { DEFAULT_PROJECT_MANIFEST } from '../core/project/defaultProject';
import { CanvasAvatarRenderer } from '../core/renderer/CanvasAvatarRenderer';
import { AudioVAD } from '../core/audio/AudioVAD';
import { ParameterStore } from '../core/parameters/ParameterStore';

describe('2-Frame Reactive Avatar System & Idle Dimming', () => {
  const twoFrameLayers: CharacterLayer[] = [
    {
      id: 'layer-idle',
      name: 'Idle (Diam)',
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
      id: 'layer-talk',
      name: 'Talk (Bicara)',
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

  describe('1. Role Assignment & Validation for 2-Frame Avatars', () => {
    it('validates a 2-frame avatar without warnings or errors', () => {
      const result = validateRoleMapping(twoFrameLayers);
      expect(result.isValid).toBe(true);
      expect(result.is2FrameReactive).toBe(true);
      expect(result.warnings.length).toBe(0);
      expect(result.missingRoles).toEqual([]);
    });

    it('identifies standard multi-layer rigs as valid but not 2-frame reactive', () => {
      const result = validateRoleMapping(DEFAULT_PROJECT_MANIFEST.layers);
      expect(result.isValid).toBe(true);
      expect(result.is2FrameReactive).toBe(false);
    });

    it('auto-assigns Indonesian & English 2-frame naming patterns correctly', () => {
      const unassignedLayers: CharacterLayer[] = [
        { ...twoFrameLayers[0], name: 'Karakter_Diam', role: 'custom' },
        { ...twoFrameLayers[1], name: 'Karakter_Bicara', role: 'custom' },
      ];
      const result = autoAssignRoles(unassignedLayers);
      expect(result.updatedLayers[0].role).toBe('mouth_closed');
      expect(result.updatedLayers[1].role).toBe('mouth_open');
    });

    it('auto-assigns Frame 1 and Frame 2 naming patterns', () => {
      const unassignedLayers: CharacterLayer[] = [
        { ...twoFrameLayers[0], name: 'avatar-frame1', role: 'custom' },
        { ...twoFrameLayers[1], name: 'avatar-frame2', role: 'custom' },
      ];
      const result = autoAssignRoles(unassignedLayers);
      expect(result.updatedLayers[0].role).toBe('mouth_closed');
      expect(result.updatedLayers[1].role).toBe('mouth_open');
    });
  });

  describe('2. CharacterResolver Idle Bob on 2-Frame Avatar', () => {
    const idleParams: AvatarParameters = {
      blink: false,
      mouthOpen: 0,
      voiceActivity: false,
      voiceLevel: 0,
      expression: 'neutral',
      mouthShape: 'closed',
    };

    const talkParams: AvatarParameters = {
      blink: false,
      mouthOpen: 0.8,
      voiceActivity: true,
      voiceLevel: 0.65,
      expression: 'neutral',
      mouthShape: 'open',
    };

    it('applies idleBobOffset to mouth_closed when rig has no body layer', () => {
      const bobOffset = 8;
      const resolved = CharacterResolver.resolve(twoFrameLayers, idleParams, bobOffset);

      expect(resolved.activeLayers.length).toBe(1);
      const active = resolved.activeLayers[0];
      expect(active.layer.role).toBe('mouth_closed');
      expect(active.y).toBe(540 + bobOffset);
    });

    it('does NOT apply idleBobOffset when avatar is speaking', () => {
      const bobOffset = 8;
      const resolved = CharacterResolver.resolve(twoFrameLayers, talkParams, bobOffset);

      expect(resolved.activeLayers.length).toBe(1);
      const active = resolved.activeLayers[0];
      expect(active.layer.role).toBe('mouth_open');
      expect(active.y).toBe(540); // Bobbing paused while talking
    });

    it('applies idleBobOffset only to body (not mouth_closed) in a multi-layer rig', () => {
      const bobOffset = 6;
      const resolved = CharacterResolver.resolve(DEFAULT_PROJECT_MANIFEST.layers, idleParams, bobOffset);

      const bodyLayer = resolved.activeLayers.find((al) => al.layer.role === 'body');
      const mouthLayer = resolved.activeLayers.find((al) => al.layer.role === 'mouth_closed');

      expect(bodyLayer).toBeDefined();
      expect(mouthLayer).toBeDefined();
      expect(bodyLayer!.y).toBe(540 + bobOffset);
      expect(mouthLayer!.y).toBe(540); // Kept steady relative to body when body exists
    });
  });

  describe('3. Manifest Schema Validation with Idle Dimming', () => {
    it('accepts valid dimWhenSilent and idleBrightness configuration', () => {
      const manifest: ProjectManifest = {
        ...DEFAULT_PROJECT_MANIFEST,
        idleConfig: {
          enabled: true,
          amplitude: 8,
          speed: 1.5,
          dimWhenSilent: true,
          idleBrightness: 0.75,
        },
      };

      const res = validateManifest(manifest);
      expect(res.valid).toBe(true);
      expect(res.manifest?.idleConfig?.dimWhenSilent).toBe(true);
      expect(res.manifest?.idleConfig?.idleBrightness).toBe(0.75);
    });

    it('rejects invalid idleBrightness out of range', () => {
      const invalidManifestLow: any = {
        ...DEFAULT_PROJECT_MANIFEST,
        idleConfig: {
          enabled: true,
          amplitude: 8,
          speed: 1.5,
          dimWhenSilent: true,
          idleBrightness: 0.05,
        },
      };
      expect(validateManifest(invalidManifestLow).valid).toBe(false);

      const invalidManifestHigh: any = {
        ...DEFAULT_PROJECT_MANIFEST,
        idleConfig: {
          enabled: true,
          amplitude: 8,
          speed: 1.5,
          dimWhenSilent: true,
          idleBrightness: 1.5,
        },
      };
      expect(validateManifest(invalidManifestHigh).valid).toBe(false);
    });

    it('rejects non-boolean dimWhenSilent', () => {
      const invalidManifest: any = {
        ...DEFAULT_PROJECT_MANIFEST,
        idleConfig: {
          enabled: true,
          amplitude: 8,
          speed: 1.5,
          dimWhenSilent: 'yes',
        },
      };
      expect(validateManifest(invalidManifest).valid).toBe(false);
    });
  });

  describe('4. CanvasAvatarRenderer with Idle Dimming', () => {
    const createMockCanvas = () => {
      const filterAssignments: string[] = [];
      let currentFilter = 'none';

      const mockCtx = {
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        scale: vi.fn(),
        drawImage: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText: vi.fn(),
        setLineDash: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        rect: vi.fn(),
        get filter() {
          return currentFilter;
        },
        set filter(val: string) {
          currentFilter = val;
          filterAssignments.push(val);
        },
        globalAlpha: 1,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: '',
        textBaseline: '',
      } as unknown as CanvasRenderingContext2D;

      const mockCanvas = {
        getContext: vi.fn().mockReturnValue(mockCtx),
        width: 1920,
        height: 1080,
      } as unknown as HTMLCanvasElement;

      return { mockCanvas, mockCtx, filterAssignments, getCurrentFilter: () => currentFilter };
    };

    it('sets brightness filter when dimWhenSilent is true and avatar is idle, then resets to none', () => {
      const { mockCanvas, filterAssignments, getCurrentFilter } = createMockCanvas();
      const renderer = new CanvasAvatarRenderer({
        canvas: mockCanvas,
        virtualWidth: 1920,
        virtualHeight: 1080,
      });

      const idleConfig: IdleConfig = {
        enabled: true,
        amplitude: 8,
        speed: 1.5,
        dimWhenSilent: true,
        idleBrightness: 0.7,
      };

      const resolvedIdle = {
        activeLayers: [
          {
            layer: twoFrameLayers[0],
            assetId: 'asset-idle',
            x: 960,
            y: 540,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 1,
            zIndex: 0,
          },
        ],
        voiceState: 'idle' as const,
        isBlinking: false,
        voiceLevel: 0,
        mouthShape: 'closed' as const,
        expression: 'neutral',
      };

      renderer.render(resolvedIdle, idleConfig);

      // Filter was set to brightness(70%) during rendering
      expect(filterAssignments).toContain('brightness(70%)');
      // After render completes, filter is guaranteed reset to 'none'
      expect(getCurrentFilter()).toBe('none');
    });

    it('keeps filter as none when speaking, even with dimWhenSilent enabled', () => {
      const { mockCanvas, filterAssignments, getCurrentFilter } = createMockCanvas();
      const renderer = new CanvasAvatarRenderer({
        canvas: mockCanvas,
        virtualWidth: 1920,
        virtualHeight: 1080,
      });

      const idleConfig: IdleConfig = {
        enabled: true,
        amplitude: 8,
        speed: 1.5,
        dimWhenSilent: true,
        idleBrightness: 0.7,
      };

      const resolvedTalking = {
        activeLayers: [
          {
            layer: twoFrameLayers[1],
            assetId: 'asset-talk',
            x: 960,
            y: 540,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            opacity: 1,
            zIndex: 1,
          },
        ],
        voiceState: 'talking' as const,
        isBlinking: false,
        voiceLevel: 0.8,
        mouthShape: 'open' as const,
        expression: 'neutral',
      };

      renderer.render(resolvedTalking, idleConfig);

      // Brightness filter was never set
      expect(filterAssignments).not.toContain('brightness(70%)');
      expect(getCurrentFilter()).toBe('none');
    });

    it('guarantees filter is reset to none in drawSelectionOverlay', () => {
      const { mockCanvas, getCurrentFilter } = createMockCanvas();
      const renderer = new CanvasAvatarRenderer({
        canvas: mockCanvas,
        virtualWidth: 1920,
        virtualHeight: 1080,
      });

      renderer.drawSelectionOverlay(twoFrameLayers[0], 300, 300);
      expect(getCurrentFilter()).toBe('none');
    });
  });

  describe('5. AudioVAD Speaking Release Delay (Up to 1000ms)', () => {
    it('allows updating releaseDelayMs up to 1000ms', () => {
      const store = new ParameterStore();
      const vad = new AudioVAD(store);

      vad.updateConfig({ releaseDelayMs: 850 });
      expect(vad.getConfig().releaseDelayMs).toBe(850);

      vad.updateConfig({ releaseDelayMs: 1000 });
      expect(vad.getConfig().releaseDelayMs).toBe(1000);
    });
  });
});
