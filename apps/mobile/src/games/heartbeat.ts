export type BeatJudgement = 'perfect' | 'great' | 'miss';

export type BeatNote = {
  id: string;
  atMs: number;
};

export const heartbeatConfig = {
  durationMs: 36000,
  bpm: 104,
  windowPerfectMs: 70,
  windowGreatMs: 140,
};

export function buildHeartbeatChart(seed = 1): BeatNote[] {
  const interval = 60000 / heartbeatConfig.bpm;
  const notes: BeatNote[] = [];
  let t = 1200;
  let i = 0;
  while (t < heartbeatConfig.durationMs - 800) {
    // occasional sync double beat
    notes.push({ id: `n_${i}`, atMs: Math.round(t) });
    i += 1;
    if ((i + seed) % 7 === 0) {
      notes.push({ id: `n_${i}`, atMs: Math.round(t + interval * 0.5) });
      i += 1;
    }
    t += interval;
  }
  return notes;
}

export function judgeTap(deltaMs: number): BeatJudgement {
  const abs = Math.abs(deltaMs);
  if (abs <= heartbeatConfig.windowPerfectMs) return 'perfect';
  if (abs <= heartbeatConfig.windowGreatMs) return 'great';
  return 'miss';
}

export function judgementScore(j: BeatJudgement) {
  if (j === 'perfect') return 100;
  if (j === 'great') return 60;
  return 0;
}
