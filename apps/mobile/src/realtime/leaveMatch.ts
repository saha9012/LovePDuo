import { sendGameIfPeerLive } from './sendGameIfPeerLive';

/** Tell a live peer you left the match UI — they should forceSolo, not wait forever. */
export function announceLeaveMatch(
  gameId: string,
  from?: { id?: string | null; displayName?: string | null } | null,
): boolean {
  return sendGameIfPeerLive(gameId, {
    leaveMatch: true,
    fromId: from?.id ?? undefined,
    fromName: from?.displayName ?? undefined,
  });
}
