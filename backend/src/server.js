import { WebSocketServer } from 'ws';

/**
 * LovePDuo realtime room stub.
 * Protocol (JSON):
 *  { type: 'join', code, userId, name }
 *  { type: 'presence', status }
 *  { type: 'game', gameId, payload }
 *  { type: 'warmth' }
 *  server → { type: 'joined', code, peers, size }
 *  server → { type: 'peer_joined' | 'peer_left', userId, name?, size }
 */

const PORT = Number(process.env.PORT || 8787);
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

const wss = new WebSocketServer({ port: PORT });
console.log(`[LPD] realtime listening on :${PORT}`);
console.log('[LPD] Android LAN: set Profile WS URL to ws://YOUR_PC_IP:8787');

wss.on('connection', (socket) => {
  socket.lpd = { code: null, userId: null, name: null };

  socket.on('message', (buf) => {
    let msg;
    try {
      msg = JSON.parse(String(buf));
    } catch {
      return;
    }

    if (msg.type === 'join') {
      if (socket.lpd.code) roomOf(socket.lpd.code).delete(socket);
      socket.lpd = {
        code: String(msg.code || '').toUpperCase(),
        userId: msg.userId,
        name: msg.name,
      };
      const room = roomOf(socket.lpd.code);
      room.add(socket);
      const size = room.size;
      const peers = roomPeers(socket.lpd.code, socket);
      console.log(`[LPD] join ${socket.lpd.code} · ${socket.lpd.name} · size=${size}`);
      broadcast(
        socket.lpd.code,
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
          code: socket.lpd.code,
          peers,
          size,
        }),
      );
      return;
    }

    if (!socket.lpd.code) return;

    if (msg.type === 'presence' || msg.type === 'game' || msg.type === 'warmth') {
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
