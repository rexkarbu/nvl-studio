import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketBroadcastManager } from '../../electron/server/wsBroadcast';
import { ProtocolSerializer } from '../core/protocol/serializer';
import { PROTOCOL_VERSION, LiveFrameMessage } from '../core/protocol/types';
import { EventEmitter } from 'events';

class MockWebSocket extends EventEmitter {
  public readyState = 1; // WebSocket.OPEN
  public sentData: string[] = [];

  public send(data: string): void {
    this.sentData.push(data);
  }

  public close(): void {
    this.emit('close');
  }

  public terminate(): void {
    this.close();
  }

  public ping(): void {}
}

class MockWebSocketServer extends EventEmitter {
  public close(): void {
    this.emit('close');
  }
}

describe('WebSocketBroadcastManager (Snapshot & Room Store)', () => {
  let manager: WebSocketBroadcastManager;
  let mockWss: MockWebSocketServer;

  beforeEach(() => {
    manager = new WebSocketBroadcastManager();
    mockWss = new MockWebSocketServer();
    manager.attach(mockWss as any);
  });

  afterEach(() => {
    manager.closeAll();
  });

  it('stores latest valid snapshot in room upon broadcast', () => {
    const ws1 = new MockWebSocket();
    mockWss.emit('connection', ws1, { url: '/ws/test-avatar' });

    const msg: LiveFrameMessage = {
      version: PROTOCOL_VERSION,
      type: 'parameters',
      projectId: 'test-avatar',
      sequence: 1,
      timestamp: Date.now(),
      parameters: { voiceActivity: true, voiceLevel: 0.9, blink: false },
    };

    ws1.emit('message', Buffer.from(ProtocolSerializer.serialize(msg)));

    const snapshot = manager.getLatestSnapshot('test-avatar');
    expect(snapshot).toEqual(msg);
  });

  it('immediately sends latest snapshot to a newly connected client', () => {
    // 1. First client connects and broadcasts a frame
    const ws1 = new MockWebSocket();
    mockWss.emit('connection', ws1, { url: '/ws/test-avatar' });

    const msg: LiveFrameMessage = {
      version: PROTOCOL_VERSION,
      type: 'parameters',
      projectId: 'test-avatar',
      sequence: 5,
      timestamp: Date.now(),
      parameters: { voiceActivity: true, voiceLevel: 0.75, blink: true },
    };

    ws1.emit('message', Buffer.from(ProtocolSerializer.serialize(msg)));

    // 2. Second client connects (e.g. OBS Browser Source)
    const ws2 = new MockWebSocket();
    mockWss.emit('connection', ws2, { url: '/ws/test-avatar' });

    // ws2 must immediately receive the latest snapshot without waiting for changes
    expect(ws2.sentData.length).toBe(1);
    const received = ProtocolSerializer.deserialize(ws2.sentData[0]);
    expect(received).toEqual(msg);
  });

  it('sends latest snapshot to reconnecting client after reload', () => {
    const ws1 = new MockWebSocket();
    mockWss.emit('connection', ws1, { url: '/ws/reload-room' });

    const msg: LiveFrameMessage = {
      version: PROTOCOL_VERSION,
      type: 'parameters',
      projectId: 'reload-room',
      sequence: 8,
      timestamp: Date.now(),
      parameters: { voiceActivity: false, voiceLevel: 0, blink: true },
    };
    ws1.emit('message', Buffer.from(ProtocolSerializer.serialize(msg)));

    // Client reloads in OBS (closes old socket and opens new one)
    ws1.close();
    expect(manager.getClientCount('reload-room')).toBe(0);

    const reloadedWs = new MockWebSocket();
    mockWss.emit('connection', reloadedWs, { url: '/ws/reload-room' });

    expect(reloadedWs.sentData.length).toBe(1);
    const received = ProtocolSerializer.deserialize(reloadedWs.sentData[0]);
    expect(received.sequence).toBe(8);
    expect(received.parameters.blink).toBe(true);
  });
});
