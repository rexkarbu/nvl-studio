import { ProtocolSerializer } from '../protocol/serializer';
import { AvatarParameters } from '../parameters/types';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
export type FrameCallback = (parameters: AvatarParameters, sequence: number) => void;
export type StateCallback = (state: ConnectionState) => void;

export interface LiveReceiverOptions {
  url: string;
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  backoffMultiplier?: number;
  WebSocketClass?: typeof WebSocket; // Dependency-injectable for node/unit testing
}

/**
 * Robust WebSocket client for Live Output (OBS Browser Source).
 * Features:
 * - Immediate initial snapshot absorption.
 * - Stale / out-of-order sequence rejection (incoming sequence <= lastAppliedSequence).
 * - Automatic reconnection with exponential backoff on disconnect or OBS source reload.
 */
export class LiveReceiver {
  private url: string;
  private socket: WebSocket | null = null;
  private isDisposed: boolean = false;
  private state: ConnectionState = 'disconnected';
  private lastAppliedSequence: number = -1;

  private retryDelayMs: number;
  private readonly initialRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly backoffMultiplier: number;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private WebSocketImpl: typeof WebSocket;

  private onFrameCallbacks: Set<FrameCallback> = new Set();
  private onStateCallbacks: Set<StateCallback> = new Set();

  constructor(options: LiveReceiverOptions) {
    this.url = options.url;
    this.initialRetryDelayMs = options.initialRetryDelayMs ?? 500;
    this.maxRetryDelayMs = options.maxRetryDelayMs ?? 5000;
    this.backoffMultiplier = options.backoffMultiplier ?? 1.5;
    this.retryDelayMs = this.initialRetryDelayMs;
    this.WebSocketImpl =
      options.WebSocketClass ||
      (typeof WebSocket !== 'undefined' ? WebSocket : (null as unknown as typeof WebSocket));
  }

  public connect(): void {
    if (this.isDisposed) return;
    this.clearReconnectTimer();

    this.setState(this.state === 'disconnected' ? 'connecting' : 'reconnecting');

    try {
      this.socket = new this.WebSocketImpl(this.url);

      this.socket.onopen = () => {
        if (this.isDisposed) {
          this.socket?.close();
          return;
        }
        this.retryDelayMs = this.initialRetryDelayMs;
        this.setState('connected');
      };

      this.socket.onmessage = (event: MessageEvent) => {
        this.handleRawMessage(typeof event.data === 'string' ? event.data : event.data.toString());
      };

      this.socket.onclose = () => {
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
  }

  public disconnect(): void {
    this.isDisposed = true;
    this.clearReconnectTimer();

    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.close();
      this.socket = null;
    }

    this.setState('disconnected');
  }

  /**
   * Directly processes a raw message string.
   * Useful for unit testing and direct message injection.
   */
  public handleRawMessage(raw: string): boolean {
    try {
      const msg = ProtocolSerializer.deserialize(raw);

      // Stale or out-of-order sequence check
      if (msg.sequence <= this.lastAppliedSequence) {
        // Discard stale frame!
        return false;
      }

      this.lastAppliedSequence = msg.sequence;
      for (const cb of this.onFrameCallbacks) {
        cb(msg.parameters, msg.sequence);
      }
      return true;
    } catch (err) {
      console.warn('[LiveReceiver] Malformed frame ignored:', err);
      return false;
    }
  }

  public onFrame(cb: FrameCallback): () => void {
    this.onFrameCallbacks.add(cb);
    return () => this.onFrameCallbacks.delete(cb);
  }

  public onStateChange(cb: StateCallback): () => void {
    this.onStateCallbacks.add(cb);
    return () => this.onStateCallbacks.delete(cb);
  }

  public getState(): ConnectionState {
    return this.state;
  }

  public getLastAppliedSequence(): number {
    return this.lastAppliedSequence;
  }

  public resetSequence(): void {
    this.lastAppliedSequence = -1;
  }

  public getRetryDelayMs(): number {
    return this.retryDelayMs;
  }

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      for (const cb of this.onStateCallbacks) {
        cb(newState);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.isDisposed) return;
    this.setState('reconnecting');

    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.retryDelayMs = Math.min(
        this.maxRetryDelayMs,
        this.retryDelayMs * this.backoffMultiplier
      );
      this.connect();
    }, this.retryDelayMs);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
