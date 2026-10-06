import { sendGameIfPeerLive } from './sendGameIfPeerLive';

type MemoryMutation = {
  gameId: string;
  payload: Record<string, unknown>;
};

const MAX = 48;
let queue: MemoryMutation[] = [];

/** Send memory remove/clear now if peer in room; else queue for flush on peer_joined. */
export function sendMemoryMutationOrQueue(
  gameId: string,
  payload: Record<string, unknown>,
): 'sent' | 'queued' {
  if (sendGameIfPeerLive(gameId, payload)) return 'sent';
  queue.push({ gameId, payload });
  if (queue.length > MAX) queue = queue.slice(-MAX);
  return 'queued';
}

export function flushMemoryMutationOutbox(): number {
  const items = queue;
  queue = [];
  let sent = 0;
  for (const m of items) {
    if (sendGameIfPeerLive(m.gameId, m.payload)) {
      sent += 1;
    } else {
      queue.push(m);
    }
  }
  if (queue.length > MAX) queue = queue.slice(-MAX);
  return sent;
}

export function clearMemoryMutationOutbox() {
  queue = [];
}

export function pendingMemoryMutationCount() {
  return queue.length;
}
