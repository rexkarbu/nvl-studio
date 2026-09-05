import { DEFAULT_PROJECT_MANIFEST } from '../../core/project/defaultProject';
import { CharacterLayer, ProjectManifest } from '../../core/project/types';

export const FRAME_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

export function createReactiveManifest(projectId = 'custom-project'): ProjectManifest {
  const manifest = structuredClone(DEFAULT_PROJECT_MANIFEST);
  return {
    ...manifest,
    projectId,
    reactive2Frame: true,
    mouthConfig: { ...manifest.mouthConfig!, reactive2Frame: true },
    idleConfig: { enabled: false, amplitude: 8, speed: 1.5, dimWhenSilent: true, idleBrightness: 0.4 },
    assets: [
      ...manifest.assets,
      { id: 'user-idle', name: 'Portrait A', path: FRAME_DATA_URL, format: 'png' },
      { id: 'user-talk', name: 'Portrait B', path: 'assets/user-talk.png', format: 'png' },
    ],
    layers: (['mouth_closed', 'mouth_open'] as const).map((role, index): CharacterLayer => ({
      id: `frame-${index}`, name: role, type: 'sprite', assetId: index ? 'user-talk' : 'user-idle',
      role, x: 960, y: 540, scaleX: 1.2, scaleY: 1.2, rotation: 5, opacity: 1, visible: true, zIndex: index,
    })),
  };
}
