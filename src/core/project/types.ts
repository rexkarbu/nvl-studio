export type SemanticLayerRole =
  | 'body'
  | 'eye_open'
  | 'eye_closed'
  | 'mouth_closed'
  | 'mouth_open'
  | 'accessory'
  | 'custom';

export interface ProjectAssetEntry {
  id: string;
  name: string;
  path: string; // Relative path e.g. "assets/body.png"
  format: 'png';
}

export type CharacterLayerType = 'sprite' | 'mesh';

export interface CharacterLayer {
  id: string;
  name: string;
  type: 'sprite'; // Ready for future 'mesh' without redesign
  assetId: string;
  role: SemanticLayerRole;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  zIndex: number;
}

export interface IdleConfig {
  enabled: boolean;
  amplitude: number; // 0 - 50 px, default 8
  speed: number;     // 0.1 - 5.0, default 1.5
}

export interface BlinkSettings {
  enabled: boolean;
  minIntervalMs: number; // e.g. 3000ms
  maxIntervalMs: number; // e.g. 6000ms
  durationMs: number;    // e.g. 150ms
}

export interface ProjectManifest {
  schemaVersion: 1;
  projectId: string;
  metadata: {
    name: string;
    createdAt: string;
    updatedAt: string;
    version: string;
  };
  canvas: {
    width: number;
    height: number;
    fps: number;
  };
  assets: ProjectAssetEntry[];
  layers: CharacterLayer[];
  idleConfig?: IdleConfig;
  blinkConfig?: BlinkSettings;
  audioConfig: {
    threshold: number;      // 0.0 - 1.0 (default: 0.15)
    sensitivity: number;    // 1.0 - 5.0 (default: 2.0)
    releaseDelayMs: number; // default: 150ms
  };
  outputConfig: {
    preferredPort: number;  // default: 17777 (resolved at runtime)
    transparent: boolean;   // always true
  };
}
