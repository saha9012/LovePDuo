import { AppState, type AppStateStatus } from 'react-native';
import { getWsUrl, onWsUrlChange } from './wsConfig';

type Handler = (msg: Record<string, unknown>) => void;
type StatusHandler = (connected: boolean) => void;

const MAX_BACKOFF_MS = 15000;
const BASE_BACKOFF_MS = 700;

export class PairRealtime {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private statusHandlers = new Set<StatusHandler>();
  private queue: Record<string, unknown>[] = [];
  private joinPayload: { code: string; userId: string; name: string } | null = null;
  private unsubUrl: (() => void) | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private intentionalClose = false;
  private appStateSub: { remove: () => void } | null = null;

  constructor() {
    this.unsubUrl = onWsUrlChange(() => {
      if (this.joinPayload) {
        const { code, userId, name } = this.joinPayload;
        this.disconnect(false);
        this.connect(code, userId, name);
      }
    });
    this.appStateSub = AppState.addEventListener('change', this.onAppState);
  }

  private onAppState = (state: AppStateStatus) => {
    if (!this.joinPayload) return;
    if (state === 'active') {
      this.send({ type: 'presence', status: 'online', name: this.joinPayload.name });
      if (!this.connected) {
        const { code, userId, name } = this.joinPayload;
        this.connect(code, userId, name);
      }
    } else if (state === 'background' || state === 'inactive') {
      this.send({ type: 'presence', status: 'away', name: this.joinPayload.name });
    }
  };

  connect(code: string, userId: string, name: string) {
    if (
      this.joinPayload?.code === code &&
      this.joinPayload?.userId === userId &&
      this.ws?.readyState === WebSocket.OPEN
    ) {
      if (this.joinPayload.name !== name) {
        this.joinPayload = { code, userId, name };
        this.send({ type: 'presence', status: 'online', name });
      }
      return;
    }
    this.clearReconnect();
    this.intentionalClose = false;
    this.teardownSocket();
    this.joinPayload = { code, userId, name };
    this.openSocket();
  }

  private openSocket() {
    if (!this.joinPayload) return;
    const url = getWsUrl();
    try {
      this.ws = new WebSocket(url);
    } catch {
      this.emitStatus(false);
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => {
      this.attempts = 0;
      this.emitStatus(true);
      if (this.joinPayload) {
        this.send({ type: 'join', ...this.joinPayload });
        this.send({
          type: 'presence',
          status: 'online',
          name: this.joinPayload.name,
        });
      }
      while (this.queue.length) {
        const msg = this.queue.shift();
        if (msg) this.send(msg);
      }
    };
    this.ws.onclose = () => {
      this.emitStatus(false);
      if (!this.intentionalClose && this.joinPayload) {
        this.scheduleReconnect();
      }
    };
    this.ws.onerror = () => {
      this.emitStatus(false);
    };
    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
        this.handlers.forEach((h) => h(msg));
      } catch {
        // ignore
      }
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || !this.joinPayload || this.intentionalClose) return;
    const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(1.7, this.attempts));
    this.attempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.joinPayload || this.intentionalClose) return;
      this.teardownSocket();
      this.openSocket();
    }, delay);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private teardownSocket() {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }
    this.ws = null;
  }

  onStatus(handler: StatusHandler) {
    this.statusHandlers.add(handler);
    handler(this.ws?.readyState === WebSocket.OPEN);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  private emitStatus(connected: boolean) {
    this.statusHandlers.forEach((h) => h(connected));
  }

  onMessage(handler: Handler) {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  send(payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return;
    }
    if (this.queue.length >= 40) {
      this.queue.shift();
    }
    this.queue.push(payload);
  }

  sendWarmth() {
    this.send({ type: 'warmth' });
  }

  sendGame(gameId: string, payload: Record<string, unknown>) {
    this.send({ type: 'game', gameId, payload });
  }

  disconnect(clearJoin = true) {
    this.intentionalClose = true;
    this.clearReconnect();
    this.teardownSocket();
    this.queue = [];
    if (clearJoin) this.joinPayload = null;
    this.emitStatus(false);
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get url() {
    return getWsUrl();
  }
}

export const pairRealtime = new PairRealtime();
