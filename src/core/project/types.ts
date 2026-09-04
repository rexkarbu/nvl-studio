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
