import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pairRealtime } from '../realtime/PairRealtime';

export type Presence = 'online' | 'away' | 'offline';

export type UserProfile = {
  id: string;
  displayName: string;
  gender?: 'f' | 'm' | 'x';
};

export type PairState = {
  id: string;
  code: string;
  name: string;
  hostUserId: string;
  partnerName: string;
  partnerPresence: Presence;
  mood: 'night' | 'warm' | 'rain';
};

export type TrackItem = {
  id: string;
  title: string;
  artist: string;
  sourceType: 'upload' | 'spotify' | 'vk' | 'link';
  playbackMode: 'local' | 'spotify' | 'link';
  addedBy: string;
  uri?: string;
  reaction?: 'heart' | 'fire' | 'rain';
};

type AppState = {
  hydrated: boolean;
  user: UserProfile | null;
  pair: PairState | null;
  tracks: TrackItem[];
  signIn: (name: string) => Promise<UserProfile>;
  signOut: () => Promise<void>;
  createPair: (pairName?: string, hostUserId?: string) => Promise<PairState>;
  joinPair: (code: string) => Promise<PairState>;
  unlinkPair: () => Promise<void>;
  setMood: (mood: PairState['mood']) => void;
  sendWarmth: () => void;
  warmthPulse: number;
  addTrack: (track: Omit<TrackItem, 'id'>) => void;
};

const STORAGE_KEY = 'lovepduo.v1';

const AppContext = createContext<AppState | null>(null);

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function makePairCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [pair, setPair] = useState<PairState | null>(null);
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [warmthPulse, setWarmthPulse] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            user?: UserProfile | null;
            pair?: PairState | null;
            tracks?: TrackItem[];
          };
          setUser(parsed.user ?? null);
          if (parsed.pair) {
            const p = parsed.pair as PairState;
            if (!p.hostUserId && parsed.user?.id) {
              p.hostUserId = parsed.user.id;
            }
            setPair(p);
          } else {
            setPair(null);
          }
          setTracks(parsed.tracks ?? []);
        }
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ user, pair, tracks }),
    );
  }, [hydrated, user, pair, tracks]);

  const signIn = useCallback(async (name: string) => {
    const clean = name.trim() || 'Игрок';
    const profile: UserProfile = { id: makeId('usr'), displayName: clean };
    setUser(profile);
    return profile;
  }, []);

  const signOut = useCallback(async () => {
    pairRealtime.disconnect();
    setUser(null);
    setPair(null);
    setTracks([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  const createPair = useCallback(async (pairName?: string, hostUserId?: string) => {
    const next: PairState = {
      id: makeId('pair'),
      code: makePairCode(),
      name: pairName?.trim() || 'Наша комната',
      hostUserId: hostUserId ?? '',
      partnerName: 'Ожидание партнёра',
      partnerPresence: 'offline',
      mood: 'night',
    };
    setPair(next);
    return next;
  }, []);

  const joinPair = useCallback(async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) {
      throw new Error('Нужен код из 6 символов');
    }
    const next: PairState = {
      id: makeId('pair'),
      code: clean,
      name: 'Связанная пара',
      hostUserId: '',
      partnerName: 'Партнёр',
      partnerPresence: 'online',
      mood: 'warm',
    };
    setPair(next);
    return next;
  }, []);

  const unlinkPair = useCallback(async () => {
    setPair(null);
  }, []);

  const setMood = useCallback((mood: PairState['mood']) => {
    setPair((prev) => (prev ? { ...prev, mood } : prev));
  }, []);

  const sendWarmth = useCallback(() => {
    setWarmthPulse((n) => n + 1);
    setPair((prev) =>
      prev ? { ...prev, partnerPresence: 'online' } : prev,
    );
  }, []);

  const addTrack = useCallback((track: Omit<TrackItem, 'id'>) => {
    setTracks((prev) => [{ ...track, id: makeId('trk') }, ...prev]);
  }, []);

  const value = useMemo(
    () => ({
      hydrated,
      user,
      pair,
      tracks,
      signIn,
      signOut,
      createPair,
      joinPair,
      unlinkPair,
      setMood,
      sendWarmth,
      warmthPulse,
      addTrack,
    }),
    [
      hydrated,
      user,
      pair,
      tracks,
      signIn,
      signOut,
      createPair,
      joinPair,
      unlinkPair,
      setMood,
      sendWarmth,
      warmthPulse,
      addTrack,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
