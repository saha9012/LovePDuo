import { useEffect, useState } from 'react';

/** Duo match arrived with lobby startAt — block manual «Старт» (auto-arm handles it). */
export function isWaitingSyncedStart(solo: string | undefined, startAt: string | undefined) {
  if (solo === '1') return false;
  const at = Number(startAt);
  return Number.isFinite(at);
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
export function useSyncedStartWaiting(solo: string | undefined, startAt: string | undefined) {
  const waiting = isWaitingSyncedStart(solo, startAt);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [waiting, solo, startAt]);
  return isWaitingSyncedStart(solo, startAt);
}
