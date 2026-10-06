import { sendGameIfPeerLive } from './sendGameIfPeerLive';

/** Tell a live peer you left the match UI — they should forceSolo, not wait forever.
 *  Pass `seed` so a rematch can ignore a late leaveMatch from the previous round. */
export function announceLeaveMatch(
  gameId: string,
  from?: { id?: string | null; displayName?: string | null } | null,
  seed?: number,
): boolean {
  return sendGameIfPeerLive(gameId, {
    leaveMatch: true,
    fromId: from?.id ?? undefined,
    fromName: from?.displayName ?? undefined,
    ...(typeof seed === 'number' ? { seed } : {}),
  });
}
