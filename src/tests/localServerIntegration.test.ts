import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LocalServer } from '../../electron/server/localServer';
import http from 'http';
import { WebSocket } from 'ws';
import { PROTOCOL_VERSION, LiveFrameMessage } from '../core/protocol/types';
import { ProtocolSerializer } from '../core/protocol/serializer';
import path from 'path';

describe('LocalServer End-to-End Integration (HTTP & WebSocket)', () => {
  let server: LocalServer;
  let port: number;

  beforeAll(async () => {
    server = new LocalServer({
      preferredPort: 19876, // Distinct port for testing
      staticDir: path.resolve(__dirname, '../../public'),
    });
    const info = await server.start();
    port = info.port;
  });

  afterAll(async () => {
    await server.stop();
  });

  it('binds to 127.0.0.1 and responds to /health', async () => {
    const res = await new Promise<{ statusCode?: number; data: any }>((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${port}/health`, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ statusCode: res.statusCode, data: JSON.parse(body) }));
        })
        .on('error', reject);
    });

    expect(res.statusCode).toBe(200);
    expect(res.data.status).toBe('ok');
    expect(res.data.resolvedPort).toBe(port);
  });

  it('serves /live/:projectId with transparent HTML', async () => {
    const res = await new Promise<{ statusCode?: number; html: string }>((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${port}/live/default-avatar`, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ statusCode: res.statusCode, html: body }));
        })
        .on('error', reject);
    });

    expect(res.statusCode).toBe(200);
    expect(res.html).toContain('background: transparent !important');
  });

  it.each(['body', 'mouth-small', 'mouth-wide'])('serves packaged sample %s PNG with image/png content type', async (assetName) => {
    const res = await new Promise<{ statusCode?: number; contentType?: string }>((resolve, reject) => {
      http
        .get(`http://127.0.0.1:${port}/sample_avatar/assets/${assetName}.png`, (res) => {
          resolve({
            statusCode: res.statusCode,
            contentType: res.headers['content-type'],
          });
        })
        .on('error', reject);
    });

    expect(res.statusCode).toBe(200);
    expect(res.contentType).toBe('image/png');
  });

  it('handles WebSocket broadcast and snapshot dispatch between clients', async () => {
    const wsUrl = `ws://127.0.0.1:${port}/ws/integration-test`;

    // 1. Broadcaster connects
    const broadcaster = new WebSocket(wsUrl);
    await new Promise((resolve) => broadcaster.on('open', resolve));

    // Send frame
    const testFrame: LiveFrameMessage = {
      version: PROTOCOL_VERSION,
      type: 'parameters',
      projectId: 'integration-test',
      sequence: 100,
      timestamp: Date.now(),
      parameters: { voiceActivity: true, voiceLevel: 0.95, blink: true },
    };
    broadcaster.send(ProtocolSerializer.serialize(testFrame));

    // Allow server event loop to store snapshot
    await new Promise((r) => setTimeout(r, 50));

    // 2. New client connects (e.g. OBS Browser Source)
    const obsClient = new WebSocket(wsUrl);
    const received = await new Promise<LiveFrameMessage>((resolve) => {
      obsClient.on('message', (data) => {
        resolve(ProtocolSerializer.deserialize(data.toString()));
      });
    });

    // Verify OBS client immediately received snapshot on connect!
    expect(received.sequence).toBe(100);
    expect(received.parameters.voiceActivity).toBe(true);
    expect(received.parameters.blink).toBe(true);

    broadcaster.close();
    obsClient.close();
  });
});
