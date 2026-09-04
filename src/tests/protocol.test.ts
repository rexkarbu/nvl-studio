import { describe, it, expect } from 'vitest';
import { ProtocolSerializer } from '../core/protocol/serializer';
import { PROTOCOL_VERSION, LiveFrameMessage } from '../core/protocol/types';

describe('ProtocolSerializer', () => {
  const validMessage: LiveFrameMessage = {
    version: PROTOCOL_VERSION,
    type: 'parameters',
    projectId: 'default-avatar',
    sequence: 42,
    timestamp: 1725500000000,
    parameters: {
      voiceActivity: true,
      voiceLevel: 0.65,
      blink: false,
    },
  };

  it('serializes and deserializes a valid LiveFrameMessage', () => {
    const serialized = ProtocolSerializer.serialize(validMessage);
    expect(typeof serialized).toBe('string');

    const deserialized = ProtocolSerializer.deserialize(serialized);
    expect(deserialized).toEqual(validMessage);
  });

  it('rejects invalid JSON syntax', () => {
    expect(() => ProtocolSerializer.deserialize('not a json string')).toThrow(
      /Failed to parse JSON/
    );
  });

  it('rejects unsupported protocol version', () => {
    const wrongVersion = { ...validMessage, version: 999 };
    expect(() => ProtocolSerializer.deserialize(JSON.stringify(wrongVersion))).toThrow(
      /Unsupported protocol version/
    );
  });

  it('rejects unknown message types', () => {
    const unknownType = { ...validMessage, type: 'unknown_cmd' };
    expect(() => ProtocolSerializer.deserialize(JSON.stringify(unknownType))).toThrow(
      /Unknown message type/
    );
  });

  it('rejects missing or empty projectId', () => {
    const emptyProject = { ...validMessage, projectId: '   ' };
    expect(() => ProtocolSerializer.deserialize(JSON.stringify(emptyProject))).toThrow(
      /Invalid or missing projectId/
    );
  });

  it('rejects invalid sequence counter', () => {
    const negativeSeq = { ...validMessage, sequence: -1 };
    expect(() => ProtocolSerializer.deserialize(JSON.stringify(negativeSeq))).toThrow(
      /Invalid or missing sequence counter/
    );
  });

  it('rejects missing or invalid parameter fields', () => {
    const missingBlink = {
      ...validMessage,
      parameters: { voiceActivity: true, voiceLevel: 0.5 },
    };
    expect(() => ProtocolSerializer.deserialize(JSON.stringify(missingBlink))).toThrow(
      /Invalid avatar parameter fields/
    );
  });
});
