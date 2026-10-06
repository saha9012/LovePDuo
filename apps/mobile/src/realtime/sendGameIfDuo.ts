import { sendGameIfPeerLive } from './sendGameIfPeerLive';

/** Live peer + still in a duo match (not forceSolo / abandoned round). */
export function sendGameIfDuo(
  forceSolo: boolean,
  gameId: string,
  payload: Record<string, unknown>,
): boolean {
  if (forceSolo) return false;
  return sendGameIfPeerLive(gameId, payload);
}
