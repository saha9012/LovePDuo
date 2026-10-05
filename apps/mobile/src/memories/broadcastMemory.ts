import { pairRealtime } from '../realtime/PairRealtime';
import type { MemoryItem } from '../store/MemoriesStore';

type FromUser = { displayName?: string | null; id?: string | null } | null | undefined;

function fromFields(from: FromUser) {
  return {
    from: from?.displayName ?? undefined,
    fromId: from?.id ?? undefined,
  };
}

/** Push a local memory to the partner over the existing game relay. */
export function broadcastMemory(memory: MemoryItem, from?: FromUser) {
  pairRealtime.sendGame('memory-add', {
    ...memory,
    ...fromFields(from),
  });
}

export function broadcastMemoryRemove(id: string, from?: FromUser) {
  pairRealtime.sendGame('memory-remove', {
    id,
    ...fromFields(from),
  });
}

export function broadcastMemoryClear(from?: FromUser) {
  pairRealtime.sendGame('memory-clear', {
    ...fromFields(from),
  });
}
