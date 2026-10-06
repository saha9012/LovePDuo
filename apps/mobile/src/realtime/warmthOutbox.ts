import { pairRealtime } from './PairRealtime';
import { getLastRoomSize } from './pairPresence';

/** Pending warmth pulses to replay when partner rejoins. */
let pending = 0;

export function pendingWarmthCount() {
  return pending;
}

/** Send now if peer in room; otherwise queue for flush on peer_joined. */
export function sendWarmthOrQueue(): 'sent' | 'queued' {
  if (pairRealtime.connected && getLastRoomSize() >= 2) {
    pairRealtime.sendWarmth();
    return 'sent';
  }
  pending += 1;
  return 'queued';
}

export function flushWarmthOutbox(): number {
  const n = pending;
  pending = 0;
  for (let i = 0; i < n; i += 1) {
    pairRealtime.sendWarmth();
  }
  return n;
}

export function clearWarmthOutbox() {
  pending = 0;
}
