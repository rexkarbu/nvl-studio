import { ParameterStore } from '../parameters/ParameterStore';
import { AvatarParameters } from '../parameters/types';
import { LiveFrameMessage, PROTOCOL_VERSION } from '../protocol/types';
import { ProtocolSerializer } from '../protocol/serializer';

export interface LiveBroadcasterOptions {
  url: string;
  projectId: string;
  store: ParameterStore;
  WebSocketClass?: typeof WebSocket;
}

/**
 * Controller-side broadcaster.
 * Dispatches parameter changes from ParameterStore over the local WebSocket.
 */
export class LiveBroadcaster {
  private url: string;
  private projectId: string;
  private store: ParameterStore;
  private socket: WebSocket | null = null;
  private unsubscribeStore: (() => void) | null = null;
  private isDisposed: boolean = false;
  private isConnected: boolean = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private WebSocketImpl: typeof WebSocket;

  constructor(options: LiveBroadcasterOptions) {
    this.url = options.url;
    this.projectId = options.projectId;
    this.store = options.store;
    this.WebSocketImpl =
      options.WebSocketClass ||
      (typeof WebSocket !== 'undefined' ? WebSocket : (null as unknown as typeof WebSocket));
  }

  public connect(): void {
    if (this.isDisposed) return;

    try {
      this.socket = new this.WebSocketImpl(this.url);

      this.socket.onopen = () => {
        if (this.isDisposed) {
          this.socket?.close();
          return;
        }
        this.isConnected = true;
        // Immediately broadcast current parameter state on connect
        this.sendFrame(this.store.getSnapshot(), this.store.getSequence());
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        if (!this.isDisposed) {
          this.scheduleReconnect();
        }
      };

      this.socket.onerror = () => {
        // Handled via onclose
      };
    } catch {
      this.scheduleReconnect();
    }

    // Subscribe to store updates
    if (!this.unsubscribeStore) {
      this.unsubscribeStore = this.store.subscribe((params, seq) => {
        if (this.isConnected) {
          this.sendFrame(params, seq);
        }
      });
    }
  }

  public disconnect(): void {
    this.isDisposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }

  public setProjectId(newProjectId: string): void {
    this.projectId = newProjectId;
    if (this.isConnected) {
      this.sendFrame(this.store.getSnapshot(), this.store.getSequence());
    }
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  private sendFrame(parameters: AvatarParameters, sequence: number): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const message: LiveFrameMessage = {
      version: PROTOCOL_VERSION,
      type: 'parameters',
      projectId: this.projectId,
      sequence,
      timestamp: Date.now(),
      parameters,
    };

    try {
      this.socket.send(ProtocolSerializer.serialize(message));
    } catch (err) {
      console.warn('[LiveBroadcaster] Failed to send frame:', err);
    }
  }

  private scheduleReconnect(): void {
    if (this.isDisposed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 1000);
  }
}
