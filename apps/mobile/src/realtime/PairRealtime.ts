import { colors } from '../theme/tokens';

export const WS_URL = process.env.EXPO_PUBLIC_LPD_WS_URL ?? 'ws://127.0.0.1:8787';

type Handler = (msg: Record<string, unknown>) => void;

export class PairRealtime {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();

  connect(code: string, userId: string, name: string) {
    this.disconnect();
    try {
      this.ws = new WebSocket(WS_URL);
    } catch {
      return;
    }
    this.ws.onopen = () => {
      this.send({ type: 'join', code, userId, name });
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

  onMessage(handler: Handler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(payload: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  sendWarmth() {
    this.send({ type: 'warmth' });
  }

  sendGame(gameId: string, payload: Record<string, unknown>) {
    this.send({ type: 'game', gameId, payload });
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }
}

export const pairRealtime = new PairRealtime();

export const brandStroke = colors.stroke;
