import AsyncStorage from '@react-native-async-storage/async-storage';

/** Match handoff is bound to a pair code — not an ephemeral UI “room”. */
export type MatchSession = {
  gameId: string;
  seed: number;
  startAtMs: number;
  pairCode: string;
  pairId?: string;
};

const KEY = 'lovepduo.match_session.v1';
/** Drop stale lobbies after this (countdown + generous enter window). */
const TTL_MS = 12 * 60_000;

let pending: MatchSession | null = null;
let hydratePromise: Promise<void> | null = null;

function alive(s: MatchSession | null): s is MatchSession {
  if (!s?.gameId || !s.pairCode) return false;
  if (!Number.isFinite(s.startAtMs) || !Number.isFinite(s.seed)) return false;
  return Date.now() - s.startAtMs < TTL_MS;
}

async function writeDisk(session: MatchSession | null) {
  try {
    if (!session) {
      await AsyncStorage.removeItem(KEY);
      return;
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

export function hydrateMatchSession(): Promise<void> {
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as MatchSession;
      if (alive(parsed)) pending = parsed;
      else await AsyncStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  })();
  return hydratePromise;
}

export function setMatchSession(session: MatchSession) {
  pending = session;
  void writeDisk(session);
}

export function peekMatchSession(gameId: string, pairCode?: string) {
  if (!alive(pending) || pending.gameId !== gameId) return null;
  if (pairCode && pending.pairCode !== pairCode.toUpperCase()) return null;
  return pending;
}

export function consumeMatchSession(gameId: string, pairCode?: string) {
  const hit = peekMatchSession(gameId, pairCode);
  if (!hit) return null;
  pending = null;
  void writeDisk(null);
  return hit;
}

export function clearMatchSession(pairCode?: string) {
  if (pairCode && pending && pending.pairCode !== pairCode.toUpperCase()) return;
  pending = null;
  void writeDisk(null);
}
