import { useEffect, useState } from 'react';

/**
 * Lobby countdown still running (or just armed) — block manual «Старт».
 * Window includes ~800ms after startAt so Start doesn't flash before auto-arm.
 * Rematch keeps old startAt in URL; once past the window, Start is available again.
 */
export function isWaitingSyncedStart(
  solo: string | undefined,
  startAt: string | undefined,
  forceSolo?: boolean,
) {
  if (solo === '1' || forceSolo) return false;
  const at = Number(startAt);
  return Number.isFinite(at) && at > Date.now() - 800;
}

export function syncedStartCountdownLabel(startAt: string | undefined, flash?: string | null) {
  if (flash) return flash;
  const at = Number(startAt);
  if (!Number.isFinite(at)) return 'Синхронный старт…';
  const remain = at - Date.now();
  if (remain <= 200) return 'Старт…';
  const sec = Math.max(1, Math.ceil(remain / 1000));
  return `Старт через ${sec}с`;
}

/** Re-render while lobby countdown is live so «Старт через Ns» ticks down. */
export function useSyncedStartWaiting(
  solo: string | undefined,
  startAt: string | undefined,
  forceSolo?: boolean,
) {
  const waiting = isWaitingSyncedStart(solo, startAt, forceSolo);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [waiting, solo, startAt, forceSolo]);
  return isWaitingSyncedStart(solo, startAt, forceSolo);
}
