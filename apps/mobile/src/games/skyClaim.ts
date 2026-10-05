export type SkyObjectType = 'orb' | 'amber' | 'decoy';

export type SkyObject = {
  id: string;
  type: SkyObjectType;
  x: number; // 0..1
  y: number; // 0..1 falling
  speed: number;
  radius: number;
  points: number;
};

export type SkyClaimConfig = {
  durationSec: number;
  spawnEveryMs: number;
};

export const skyClaimConfig: SkyClaimConfig = {
  durationSec: 50,
  spawnEveryMs: 700,
};

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSkySpawner(seed: number) {
  const rand = mulberry32(seed);
  let seq = 0;

  return function spawn(): SkyObject {
    seq += 1;
    const roll = rand();
    const type: SkyObjectType = roll > 0.86 ? 'decoy' : roll > 0.62 ? 'amber' : 'orb';
    const points = type === 'amber' ? 3 : type === 'orb' ? 1 : -2;
    return {
      id: `obj_${seq}`,
      type,
      x: 0.08 + rand() * 0.84,
      y: -0.08,
      speed: 0.18 + rand() * 0.22 + (type === 'amber' ? 0.05 : 0),
      radius: type === 'amber' ? 0.045 : 0.038,
      points,
    };
  };
}

export function scoreCatch(combo: number, points: number) {
  if (points < 0) return { scoreDelta: points, combo: 0 };
  const mult = 1 + Math.min(combo, 8) * 0.15;
  return { scoreDelta: Math.round(points * mult), combo: combo + 1 };
}
