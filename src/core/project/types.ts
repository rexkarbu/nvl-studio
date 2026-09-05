export type SemanticLayerRole =
  | 'body'
  | 'eye_open'
  | 'eye_closed'
  | 'mouth_closed'
  | 'mouth_open'
  | 'mouth_small'
  | 'mouth_medium'
  | 'mouth_wide'
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
  /** Whether avatar dims (becomes darker) in idle/silent state and brightens when speaking */
  dimWhenSilent?: boolean;
  /** Brightness multiplier when silent (0.20 - 1.00, default 0.75 = 75% brightness) */
  idleBrightness?: number;
}

export interface BlinkSettings {
  enabled: boolean;
  minIntervalMs: number; // e.g. 3000ms
  maxIntervalMs: number; // e.g. 6000ms
  durationMs: number;    // e.g. 150ms
}

export interface HotkeyMapping {
  expressionId: string;
  key: string; // e.g. 'F1', 'F2', 'Digit1'
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface ExpressionDefinition {
  id: string;
  name: string;
  /** Layer overrides applied when this expression is active */
  layerOverrides: Record<string, Partial<CharacterLayer>>;
}

export interface ExpressionConfig {
  /** Currently active expression identifier */
  activeExpression: string;
  /** Available expressions for this avatar */
  expressions: ExpressionDefinition[];
  /** Global hotkey mappings */
  hotkeys?: HotkeyMapping[];
}

export interface MouthThresholds {
  closed: number; // default: 0.15 — below this = closed
  small: number;  // default: 0.35 — below this = small
  medium: number; // default: 0.65 — below this = medium
  // above medium = wide
}

export interface MouthConfig {
  /** Voice level thresholds for each mouth shape (0.0 - 1.0) */
  thresholds: MouthThresholds;
  /** Whether to use continuous mouthOpen parameter instead of discrete shapes */
  continuousMode: boolean;
  /** When true, avatar behaves in 2-frame reactive mode */
  reactive2Frame?: boolean;
}

export interface ProjectManifest {
  schemaVersion: 1;
  projectId: string;
  /** When true, avatar is configured in 2-Frame Reactive mode (Idle/Talking) */
  reactive2Frame?: boolean;
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
  expressionConfig?: ExpressionConfig;
  mouthConfig?: MouthConfig;
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
