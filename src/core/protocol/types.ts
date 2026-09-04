import { AvatarParameters } from '../parameters/types';

export const PROTOCOL_VERSION = 1;

export interface LiveFrameMessage {
  version: number;
  type: 'parameters';
  projectId: string;
  sequence: number;
  timestamp: number;
  parameters: AvatarParameters;
}

export type LiveMessage = LiveFrameMessage;
