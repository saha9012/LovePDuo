import { WebSocketServer } from 'ws';

/**
 * LovePDuo realtime room stub.
 * Protocol (JSON):
 *  { type: 'join', code, userId, name }
 *  { type: 'presence', status }
 *  { type: 'game', gameId, payload }
 *  { type: 'warmth' }
 *  { type: 'ping', token?, t? } → { type: 'pong', token, t, serverAt }
 *  server → { type: 'joined', code, peers, size }
 *  server → { type: 'peer_joined' | 'peer_left', userId, name?, size }
 */

const PORT = Number(process.env.PORT || 8787);
const MAX_MSG_BYTES = Number(process.env.LPD_MAX_MSG_BYTES || 48_000);
const RATE_WINDOW_MS = 1000;
const RATE_MAX = Number(process.env.LPD_RATE_MAX || 48);
const rooms = new Map();

function roomOf(code) {
  const key = String(code || '').toUpperCase();
  if (!rooms.has(key)) rooms.set(key, new Set());
  return rooms.get(key);
}

function roomPeers(code, except) {
  const peers = [];
  for (const client of roomOf(code)) {
    if (client === except) continue;
    if (client.readyState !== 1) continue;
    peers.push({
      userId: client.lpd?.userId ?? null,
      name: client.lpd?.name ?? null,
    });
  }
  return peers;
}

function broadcast(code, data, except) {
  const room = roomOf(code);
  const raw = JSON.stringify(data);
  for (const client of room) {
    if (client !== except && client.readyState === 1) client.send(raw);
  }
}

function allowMessage(socket) {
  const now = Date.now();
  if (!socket.lpdRate || now - socket.lpdRate.windowStart >= RATE_WINDOW_MS) {
    socket.lpdRate = { windowStart: now, count: 0 };
  }
  socket.lpdRate.count += 1;
  return socket.lpdRate.count <= RATE_MAX;
}

const wss = new WebSocketServer({ port: PORT, maxPayload: MAX_MSG_BYTES });
console.log(`[LPD] realtime listening on :${PORT}`);
console.log('[LPD] Android LAN: set Profile WS URL to ws://YOUR_PC_IP:8787');
console.log(`[LPD] limits: msg≤${MAX_MSG_BYTES}B · rate≤${RATE_MAX}/s`);

wss.on('connection', (socket) => {
  socket.lpd = { code: null, userId: null, name: null };
  socket.lpdRate = { windowStart: Date.now(), count: 0 };

  socket.on('message', (buf) => {
    if (buf.byteLength > MAX_MSG_BYTES) {
      console.warn('[LPD] drop oversized message');
      return;
    }
    if (!allowMessage(socket)) {
      console.warn(`[LPD] rate-limit ${socket.lpd?.code ?? '?'} · ${socket.lpd?.name ?? '?'}`);
      return;
    }

    let msg;
    try {
      msg = JSON.parse(String(buf));
    } catch {
      return;
    }

    if (msg.type === 'join') {
      if (socket.lpd.code) roomOf(socket.lpd.code).delete(socket);
      const code = String(msg.code || '').toUpperCase();
      const userId = msg.userId ?? null;
      const room = roomOf(code);

      // Same user reconnecting: replace stale socket so room size stays 1–2.
      if (userId != null) {
        for (const client of [...room]) {
          if (client !== socket && client.lpd?.userId === userId) {
            room.delete(client);
            try {
              client.close(4000, 'replaced');
            } catch {
              /* ignore */
            }
          }
        }
      }

      socket.lpd = {
        code,
        userId,
        name: msg.name,
      };
      room.add(socket);
      const size = room.size;
      const peers = roomPeers(code, socket);
      console.log(`[LPD] join ${code} · ${socket.lpd.name} · size=${size}`);
      broadcast(
        code,
        {
          type: 'peer_joined',
          userId: socket.lpd.userId,
          name: socket.lpd.name,
          size,
        },
        socket,
      );
      socket.send(
        JSON.stringify({
          type: 'joined',
          code,
          peers,
          size,
        }),
      );
      return;
    }

    if (msg.type === 'ping') {
      socket.send(
        JSON.stringify({
          type: 'pong',
          token: typeof msg.token === 'string' ? msg.token : null,
          t: typeof msg.t === 'number' ? msg.t : null,
          serverAt: Date.now(),
        }),
      );
      return;
    }

    if (!socket.lpd.code) return;

    if (msg.type === 'presence') {
      if (typeof msg.name === 'string' && msg.name.trim()) {
        socket.lpd.name = msg.name.trim();
      }
      if (typeof msg.status === 'string') {
        socket.lpd.status = msg.status;
      }
      broadcast(
        socket.lpd.code,
        {
          type: 'presence',
          from: socket.lpd.userId,
          name: socket.lpd.name,
          status: msg.status || 'online',
          size: roomOf(socket.lpd.code).size,
        },
        socket,
      );
      return;
    }

    if (msg.type === 'game' || msg.type === 'warmth') {
      if (msg.type === 'game') {
        if (msg.payload?.rematch) {
          console.log(`[LPD] rematch ${socket.lpd.code} · ${msg.gameId ?? '?'}`);
        } else if (msg.payload?.hello || msg.gameId === 'play-peek') {
          console.log(
            `[LPD] ${msg.payload?.hello ? 'hello' : 'peek'} ${socket.lpd.code} · ${msg.gameId ?? '?'} · ${socket.lpd.name}`,
          );
        }
      }
      broadcast(socket.lpd.code, { ...msg, from: socket.lpd.userId }, socket);
    }
  });

  socket.on('close', () => {
    if (!socket.lpd?.code) return;
    const code = socket.lpd.code;
    roomOf(code).delete(socket);
    const size = roomOf(code).size;
    console.log(`[LPD] leave ${code} · ${socket.lpd.name} · size=${size}`);
    broadcast(code, {
      type: 'peer_left',
      userId: socket.lpd.userId,
      size,
    });
    if (size === 0) rooms.delete(code);
  });
});
