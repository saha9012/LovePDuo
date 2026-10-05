export type MatchSession = {
  gameId: string;
  seed: number;
  startAtMs: number;
};

let pending: MatchSession | null = null;

export function setMatchSession(session: MatchSession) {
  pending = session;
}

export function peekMatchSession(gameId: string) {
  if (pending?.gameId === gameId) return pending;
  return null;
}

export function consumeMatchSession(gameId: string) {
  if (pending?.gameId !== gameId) return null;
  const s = pending;
  pending = null;
  return s;
}
