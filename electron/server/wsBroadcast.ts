import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { ProtocolSerializer } from '../../src/core/protocol/serializer';
import { LiveFrameMessage } from '../../src/core/protocol/types';

interface ClientEntry {
  ws: WebSocket;
  isAlive: boolean;
}

interface Room {
  projectId: string;
  clients: Set<ClientEntry>;
  latestSnapshot: LiveFrameMessage | null;
}

export class WebSocketBroadcastManager {
  private wss: WebSocketServer | null = null;
  private rooms: Map<string, Room> = new Map();
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  public attach(wss: WebSocketServer): void {
    this.wss = wss;

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const url = req.url || '';
      // Expected URL pattern: /ws/:projectId
      const match = url.match(/^\/ws\/([a-zA-Z0-9_-]+)/);
      const projectId = match ? match[1] : 'default';

      const clientEntry: ClientEntry = { ws, isAlive: true };
      this.joinRoom(projectId, clientEntry);

      ws.on('pong', () => {
        clientEntry.isAlive = true;
      });

      ws.on('message', (data: Buffer | string) => {
        const raw = typeof data === 'string' ? data : data.toString('utf-8');
        this.handleMessage(projectId, clientEntry, raw);
      });

      ws.on('close', () => {
        this.leaveRoom(projectId, clientEntry);
      });

      ws.on('error', (err) => {
        console.warn(`[wsBroadcast] Client error in room ${projectId}:`, err.message);
        this.leaveRoom(projectId, clientEntry);
      });
    });

    // Heartbeat check every 30 seconds
    this.pingInterval = setInterval(() => {
      for (const room of this.rooms.values()) {
        for (const client of room.clients) {
          if (!client.isAlive) {
            client.ws.terminate();
            room.clients.delete(client);
            continue;
          }
          client.isAlive = false;
          client.ws.ping();
        }
      }
    }, 30000);
  }

  public getOrCreateRoom(projectId: string): Room {
    let room = this.rooms.get(projectId);
    if (!room) {
      room = {
        projectId,
        clients: new Set(),
        latestSnapshot: null,
      };
      this.rooms.set(projectId, room);
    }
    return room;
  }

  public getLatestSnapshot(projectId: string): LiveFrameMessage | null {
    return this.rooms.get(projectId)?.latestSnapshot ?? null;
  }

  public getClientCount(projectId: string): number {
    return this.rooms.get(projectId)?.clients.size ?? 0;
  }

  public closeAll(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    for (const room of this.rooms.values()) {
      for (const client of room.clients) {
        try {
          client.ws.close(1000, 'Server shutting down');
        } catch {
          // ignore
        }
      }
      room.clients.clear();
    }
    this.rooms.clear();

    if (this.wss) {
      if (typeof this.wss.close === 'function') {
        this.wss.close();
      }
      this.wss = null;
    }
  }

  private joinRoom(projectId: string, client: ClientEntry): void {
    const room = this.getOrCreateRoom(projectId);
    room.clients.add(client);

    // Initial snapshot dispatch: if latest snapshot exists, immediately send to new client!
    if (room.latestSnapshot && client.ws.readyState === WebSocket.OPEN) {
      try {
        const payload = ProtocolSerializer.serialize(room.latestSnapshot);
        client.ws.send(payload);
      } catch (err) {
        console.warn(`[wsBroadcast] Failed to send initial snapshot to new client:`, err);
      }
    }
  }

  private leaveRoom(projectId: string, client: ClientEntry): void {
    const room = this.rooms.get(projectId);
    if (room) {
      room.clients.delete(client);
    }
  }

  private handleMessage(projectId: string, sender: ClientEntry, raw: string): void {
    try {
      const message = ProtocolSerializer.deserialize(raw);
      const room = this.getOrCreateRoom(projectId);

      // Save latest valid snapshot
      room.latestSnapshot = message;

      // Broadcast to other clients in this project room
      const payload = ProtocolSerializer.serialize(message);
      for (const client of room.clients) {
        if (client !== sender && client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(payload);
          } catch {
            // failed client will be pruned on error/close
          }
        }
      }
    } catch (err) {
      console.warn(`[wsBroadcast] Dropping invalid message in room ${projectId}:`, (err as Error).message);
    }
  }
}
