import { colors } from '../theme/tokens';

export const WS_URL = process.env.EXPO_PUBLIC_LPD_WS_URL ?? 'ws://127.0.0.1:8787';

type Handler = (msg: Record<string, unknown>) => void;
type StatusHandler = (connected: boolean) => void;

export class PairRealtime {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private statusHandlers = new Set<StatusHandler>();
  private queue: Record<string, unknown>[] = [];
  private joinPayload: { code: string; userId: string; name: string } | null = null;

  connect(code: string, userId: string, name: string) {
    if (
      this.joinPayload?.code === code &&
      this.joinPayload?.userId === userId &&
      this.ws?.readyState === WebSocket.OPEN
    ) {
      return;
    }
    this.disconnect(false);
    this.joinPayload = { code, userId, name };
    try {
      this.ws = new WebSocket(WS_URL);
    } catch {
      this.emitStatus(false);
      return;
    }
    this.ws.onopen = () => {
      this.emitStatus(true);
      if (this.joinPayload) {
        this.send({ type: 'join', ...this.joinPayload });
      }
      while (this.queue.length) {
        const msg = this.queue.shift();
        if (msg) this.send(msg);
      }
    };
    this.ws.onclose = () => {
      this.emitStatus(false);
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

  onStatus(handler: StatusHandler) {
    this.statusHandlers.add(handler);
    handler(this.ws?.readyState === WebSocket.OPEN);
    return () => this.statusHandlers.delete(handler);
  }

  private emitStatus(connected: boolean) {
    this.statusHandlers.forEach((h) => h(connected));
  }

  onMessage(handler: Handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
      return;
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
    this.ws?.close();
    this.ws = null;
    this.queue = [];
    if (clearJoin) this.joinPayload = null;
    this.emitStatus(false);
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const pairRealtime = new PairRealtime();

export const brandStroke = colors.stroke;
