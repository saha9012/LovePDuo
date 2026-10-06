import { setLastRoomSize } from './pairPresence';
import { pairRealtime } from './PairRealtime';
import { clearMusicOutbox } from './musicOutbox';
import { clearWarmthOutbox } from './warmthOutbox';
import { clearMemoryMutationOutbox } from './memoryMutationOutbox';
import { clearNoteMutationOutbox } from './noteMutationOutbox';
import { clearPairMetaOutbox } from './pairMetaOutbox';

/** Drop queued pair mutations so they never leak into the next invite code. */
export function clearAllSyncOutboxes() {
  clearMusicOutbox();
  clearWarmthOutbox();
  clearMemoryMutationOutbox();
  clearNoteMutationOutbox();
  clearPairMetaOutbox();
  setLastRoomSize(0);
  pairRealtime.disconnect();
}
