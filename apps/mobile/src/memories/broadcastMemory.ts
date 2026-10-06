import { sendGameIfPeerLive } from '../realtime/sendGameIfPeerLive';
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
  // Only when peer is live — otherwise leave pendingSync for RealtimeConnector flush.
  if (
    !sendGameIfPeerLive('memory-add', {
      ...payload,
      ...fromFields(from),
    })
  ) {
    return;
  }
  markMemorySyncedExternal(memory.id);
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
