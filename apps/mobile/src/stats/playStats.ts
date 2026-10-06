import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'lovepduo.play_stats.v1';

export type PlayStats = {
  byGame: Record<string, number>;
  streakDays: number;
  lastPlayDay: string | null;
  totalStarts: number;
};

const empty = (): PlayStats => ({
  byGame: {},
  streakDays: 0,
  lastPlayDay: null,
  totalStarts: 0,
});

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

export async function loadPlayStats(): Promise<PlayStats> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return empty();
    const p = JSON.parse(raw) as PlayStats;
    return {
      byGame: p.byGame ?? {},
      streakDays: typeof p.streakDays === 'number' ? p.streakDays : 0,
      lastPlayDay: typeof p.lastPlayDay === 'string' ? p.lastPlayDay : null,
      totalStarts: typeof p.totalStarts === 'number' ? p.totalStarts : 0,
    };
  } catch {
    return empty();
  }
}

export async function recordGameStart(gameId: string): Promise<PlayStats> {
  const cur = await loadPlayStats();
  const today = dayKey();
  let streak = cur.streakDays;
  if (cur.lastPlayDay === today) {
    // same day — keep streak
  } else if (cur.lastPlayDay === yesterdayKey()) {
    streak = Math.max(1, streak) + 1;
  } else {
    streak = 1;
  }
  const next: PlayStats = {
    byGame: {
      ...cur.byGame,
      [gameId]: (cur.byGame[gameId] ?? 0) + 1,
    },
    streakDays: Math.max(1, streak),
    lastPlayDay: today,
    totalStarts: cur.totalStarts + 1,
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
