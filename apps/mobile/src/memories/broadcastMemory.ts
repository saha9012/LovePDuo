import { pairRealtime } from '../realtime/PairRealtime';
import { getLastRoomSize } from '../realtime/pairPresence';
import { sendMemoryMutationOrQueue } from '../realtime/memoryMutationOutbox';
import { markMemorySyncedExternal, type MemoryItem } from '../store/MemoriesStore';

type FromUser = { displayName?: string | null; id?: string | null } | null | undefined;

function fromFields(from: FromUser) {
  return {
    from: from?.displayName ?? undefined,
    fromId: from?.id ?? undefined,
  };
}

/** Push a local memory to the partner over the existing game relay. */
export function broadcastMemory(memory: MemoryItem, from?: FromUser) {
  const { pendingSync: _p, ...payload } = memory;
  pairRealtime.sendGame('memory-add', {
    ...payload,
    ...fromFields(from),
  });
  // Peer already in room → delivered; else pendingSync stays for RealtimeConnector flush.
  if (pairRealtime.connected && getLastRoomSize() >= 2) {
    markMemorySyncedExternal(memory.id);
  }
}

export function broadcastMemoryRemove(id: string, from?: FromUser) {
  return sendMemoryMutationOrQueue('memory-remove', {
    id,
    ...fromFields(from),
  });
}

export function broadcastMemoryClear(from?: FromUser) {
  return sendMemoryMutationOrQueue('memory-clear', {
    ...fromFields(from),
  });
}
