import { CharacterLayer } from '../project/types';

export interface ResolvedLayer {
  layer: CharacterLayer;
  assetId: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  zIndex: number;
}

export interface ResolvedVisualState {
  activeLayers: ResolvedLayer[];
  voiceState: 'idle' | 'talking';
  isBlinking: boolean;
  voiceLevel: number;
}
