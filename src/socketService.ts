export type PulseEventType =
  | 'ledger:update'
  | 'topic:update'
  | 'topic:message'
  | 'presence:update';

export type SocketState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

type EventHandler = (data: unknown) => void;
type StateHandler = (state: SocketState) => void;

interface OutboundMessage {
  event: PulseEventType;
  payload: unknown;
}

export class PulseSocket {
  private url: string;
  private userId: string;
  private ws: WebSocket | null = null;
  private listeners: Map<PulseEventType, Set<EventHandler>> = new Map();
  private stateListeners: Set<StateHandler> = new Set();
  private outboundQueue: OutboundMessage[] = [];
  private state: SocketState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectDelay = 10000;
  private pingIntervalId: number | null = null;

  constructor(userId: string) {
    this.userId = userId;
    const envUrl = import.meta.env.VITE_PULSE_WS_URL;
    this.url = envUrl || 'ws://localhost:4000/pulse';
  }

  public connect(): void {
    if (this.state === 'connecting' || this.state === 'connected') return;
    this.updateState('connecting');

    const fullUrl = `${this.url}?userId=${encodeURIComponent(this.userId)}`;
    this.ws = new WebSocket(fullUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.updateState('connected');
      this.startHeartbeat();
      this.flushQueue();
    };

    this.ws.onmessage = (event) => {
      try {
        const { event: evt, payload } = JSON.parse(event.data);
        if (evt && this.listeners.has(evt)) {
          this.listeners.get(evt)?.forEach((handler) => handler(payload));
        }
      } catch (err) {
        console.error('[PulseSocket] Failed to parse frame:', err);
      }
    };

    this.ws.onclose = () => {
      this.cleanup();
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.warn('[PulseSocket] Connection error:', error);
      this.ws?.close();
    };
  }

  public emit(event: PulseEventType, payload: unknown): void {
    const msg: OutboundMessage = { event, payload };
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.outboundQueue.push(msg);
    }
  }

  public on(event: PulseEventType, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  public off(event: PulseEventType, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  public onStateChange(handler: StateHandler): () => void {
    this.stateListeners.add(handler);
    handler(this.state);
    return () => this.stateListeners.delete(handler);
  }

  private updateState(newState: SocketState): void {
    this.state = newState;
    this.stateListeners.forEach((fn) => fn(newState));
  }

  private flushQueue(): void {
    while (this.outboundQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      const msg = this.outboundQueue.shift();
      if (msg) this.ws.send(JSON.stringify(msg));
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingIntervalId = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'ping' }));
      }
    }, 15000);
  }

  private stopHeartbeat(): void {
    if (this.pingIntervalId !== null) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  private scheduleReconnect(): void {
    this.updateState('reconnecting');
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }

  private cleanup(): void {
    this.stopHeartbeat();
    this.ws = null;
  }
}

let socketInstance: PulseSocket | null = null;

export function getPulseSocket(userId: string): PulseSocket {
  if (!socketInstance) {
    socketInstance = new PulseSocket(userId);
  }
  return socketInstance;
}