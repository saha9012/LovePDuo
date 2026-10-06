import { sendGameIfPeerLive } from './sendGameIfPeerLive';

type NoteMutation = {
  gameId: string;
  payload: Record<string, unknown>;
};

const MAX = 48;
let queue: NoteMutation[] = [];

/** Send note remove now if peer in room; else queue for flush on peer_joined. */
export function sendNoteMutationOrQueue(
  gameId: string,
  payload: Record<string, unknown>,
): 'sent' | 'queued' {
  if (sendGameIfPeerLive(gameId, payload)) return 'sent';
  queue.push({ gameId, payload });
  if (queue.length > MAX) queue = queue.slice(-MAX);
  return 'queued';
}

export function flushNoteMutationOutbox(): number {
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

export function clearNoteMutationOutbox() {
  queue = [];
}

export function pendingNoteMutationCount() {
  return queue.length;
}
