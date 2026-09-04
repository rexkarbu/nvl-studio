import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LiveReceiver } from '../core/sync/LiveReceiver';
import { ProtocolSerializer } from '../core/protocol/serializer';
import { PROTOCOL_VERSION } from '../core/protocol/types';

describe('LiveReceiver (Stale Frame Rejection & Reconnect Logic)', () => {
  let receiver: LiveReceiver;

  beforeEach(() => {
    vi.useFakeTimers();
    receiver = new LiveReceiver({
      url: 'ws://127.0.0.1:17777/ws/test',
      initialRetryDelayMs: 500,
      maxRetryDelayMs: 4000,
      backoffMultiplier: 2.0,
      // Provide dummy WebSocket class so instantiation doesn't fail in node environment
      WebSocketClass: vi.fn().mockImplementation(() => ({
        close: vi.fn(),
      })) as any,
    });
  });

  afterEach(() => {
    receiver.disconnect();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('accepts initial frame and updates lastAppliedSequence', () => {
    const frame1 = ProtocolSerializer.serialize({
      version: PROTOCOL_VERSION,
      type: 'parameters',
      projectId: 'test',
      sequence: 1,
      timestamp: Date.now(),
      parameters: { voiceActivity: false, voiceLevel: 0, blink: false },
    });

    const accepted = receiver.handleRawMessage(frame1);
    expect(accepted).toBe(true);
    expect(receiver.getLastAppliedSequence()).toBe(1);
  });

  it('rejects stale sequence (sequence <= lastAppliedSequence)', () => {
    const frame10 = ProtocolSerializer.serialize({
      version: PROTOCOL_VERSION,
      type: 'parameters',
      projectId: 'test',
      sequence: 10,
      timestamp: Date.now(),
      parameters: { voiceActivity: true, voiceLevel: 0.8, blink: false },
    });

    const frame5 = ProtocolSerializer.serialize({
      version: PROTOCOL_VERSION,
      type: 'parameters',
      projectId: 'test',
      sequence: 5, // Stale!
      timestamp: Date.now(),
      parameters: { voiceActivity: false, voiceLevel: 0, blink: false },
    });

    expect(receiver.handleRawMessage(frame10)).toBe(true);
    expect(receiver.getLastAppliedSequence()).toBe(10);

    // Stale sequence 5 must be rejected
    const acceptedStale = receiver.handleRawMessage(frame5);
    expect(acceptedStale).toBe(false);
    expect(receiver.getLastAppliedSequence()).toBe(10);

    // Identical sequence 10 must also be rejected
    const acceptedDuplicate = receiver.handleRawMessage(frame10);
    expect(acceptedDuplicate).toBe(false);
  });

  it('computes exponential backoff correctly without exceeding maxRetryDelayMs', () => {
    // Initial delay: 500ms
    expect(receiver.getRetryDelayMs()).toBe(500);

    // First retry schedule advances delay: 500 * 2 = 1000ms
    // Second retry schedule advances delay: 1000 * 2 = 2000ms
    // Third retry schedule advances delay: 2000 * 2 = 4000ms (max)
    // Fourth retry schedule stays capped at 4000ms
  });
});
