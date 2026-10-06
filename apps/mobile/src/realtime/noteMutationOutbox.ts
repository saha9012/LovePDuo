import { pairRealtime } from './PairRealtime';
import { getLastRoomSize } from './pairPresence';

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
  if (pairRealtime.connected && getLastRoomSize() >= 2) {
    pairRealtime.sendGame(gameId, payload);
    return 'sent';
  }
  queue.push({ gameId, payload });
  if (queue.length > MAX) queue = queue.slice(-MAX);
  return 'queued';
}

export function flushNoteMutationOutbox(): number {
  const items = queue;
  queue = [];
  for (const m of items) {
    pairRealtime.sendGame(m.gameId, m.payload);
  }
  return items.length;
}
