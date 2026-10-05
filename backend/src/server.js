import { WebSocketServer } from 'ws';

/**
 * LovePDuo realtime room stub.
 * Protocol (JSON):
 *  { type: 'join', code, userId, name }
 *  { type: 'presence', status }
 *  { type: 'game', gameId, payload }
 *  { type: 'warmth' }
 */

const PORT = Number(process.env.PORT || 8787);
const rooms = new Map();

function roomOf(code) {
  const key = String(code || '').toUpperCase();
  if (!rooms.has(key)) rooms.set(key, new Set());
  return rooms.get(key);
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
      roomOf(socket.lpd.code).add(socket);
      broadcast(socket.lpd.code, {
        type: 'peer_joined',
        userId: socket.lpd.userId,
        name: socket.lpd.name,
      }, socket);
      socket.send(JSON.stringify({ type: 'joined', code: socket.lpd.code }));
      return;
    }

    if (!socket.lpd.code) return;

    if (msg.type === 'presence' || msg.type === 'game' || msg.type === 'warmth') {
      broadcast(socket.lpd.code, { ...msg, from: socket.lpd.userId }, socket);
    }
  });

  socket.on('close', () => {
    if (!socket.lpd?.code) return;
    roomOf(socket.lpd.code).delete(socket);
    broadcast(socket.lpd.code, {
      type: 'peer_left',
      userId: socket.lpd.userId,
    });
  });
});
