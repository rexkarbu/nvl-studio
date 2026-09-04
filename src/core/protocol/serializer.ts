import { PROTOCOL_VERSION, LiveFrameMessage } from './types';

export class ProtocolSerializer {
  /**
   * Serializes a LiveFrameMessage to a JSON string.
   */
  public static serialize(message: LiveFrameMessage): string {
    return JSON.stringify(message);
  }

  /**
   * Deserializes and strictly validates a message from raw string data.
   * Throws an Error if the message is invalid, malformed, or has an unsupported protocol version.
   */
  public static deserialize(raw: string): LiveFrameMessage {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('[ProtocolSerializer] Failed to parse JSON string');
    }

    if (!parsed || typeof parsed !== 'object') {
      throw new Error('[ProtocolSerializer] Payload must be a non-null object');
    }

    const obj = parsed as Record<string, any>;

    if (typeof obj.version !== 'number' || obj.version !== PROTOCOL_VERSION) {
      throw new Error(
        `[ProtocolSerializer] Unsupported protocol version: ${obj.version}, expected: ${PROTOCOL_VERSION}`
      );
    }

    if (obj.type !== 'parameters') {
      throw new Error(`[ProtocolSerializer] Unknown message type: ${obj.type}`);
    }

    if (typeof obj.projectId !== 'string' || obj.projectId.trim() === '') {
      throw new Error('[ProtocolSerializer] Invalid or missing projectId');
    }

    if (typeof obj.sequence !== 'number' || obj.sequence < 0) {
      throw new Error('[ProtocolSerializer] Invalid or missing sequence counter');
    }

    if (typeof obj.timestamp !== 'number' || obj.timestamp <= 0) {
      throw new Error('[ProtocolSerializer] Invalid or missing timestamp');
    }

    if (!obj.parameters || typeof obj.parameters !== 'object') {
      throw new Error('[ProtocolSerializer] Missing parameters object');
    }

    const params = obj.parameters;
    if (
      typeof params.voiceActivity !== 'boolean' ||
      typeof params.voiceLevel !== 'number' ||
      typeof params.blink !== 'boolean'
    ) {
      throw new Error(
        '[ProtocolSerializer] Invalid avatar parameter fields (must contain voiceActivity, voiceLevel, blink)'
      );
    }

    return {
      version: obj.version,
      type: 'parameters',
      projectId: obj.projectId,
      sequence: obj.sequence,
      timestamp: obj.timestamp,
      parameters: {
        voiceActivity: params.voiceActivity,
        voiceLevel: params.voiceLevel,
        blink: params.blink,
        mouthShape: typeof params.mouthShape === 'string' ? params.mouthShape : undefined,
        expression: typeof params.expression === 'string' ? params.expression : undefined,
        custom: typeof params.custom === 'object' && params.custom !== null ? params.custom : undefined,
      },
    };
  }
}
