import { pairRealtime } from './PairRealtime';
import { getLastRoomSize } from './pairPresence';

/** Ephemeral game signals — only when a peer is actually in the WS room. */
export function sendGameIfPeerLive(gameId: string, payload: Record<string, unknown>): boolean {
  if (pairRealtime.connected && getLastRoomSize() >= 2) {
    pairRealtime.sendGame(gameId, payload);
    return true;
  }
  return false;
}
