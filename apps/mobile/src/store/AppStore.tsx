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
import { hydrateWsUrl } from '../realtime/wsConfig';
import { track } from '../analytics/track';

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
  roomSize?: number;
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

export type TinyNote = {
  id: string;
  text: string;
  from: string;
  at: number;
};

export type PlaylistMood = 'night' | 'warm' | 'rain' | 'pulse';

export type Playlist = {
  id: string;
  name: string;
  mood: PlaylistMood;
  trackIds: string[];
};

type AppState = {
  hydrated: boolean;
  user: UserProfile | null;
  pair: PairState | null;
  tracks: TrackItem[];
  notes: TinyNote[];
  playlists: Playlist[];
  activePlaylistId: string | null;
  signIn: (name: string) => Promise<UserProfile>;
  updateDisplayName: (name: string) => Promise<UserProfile>;
  signOut: () => Promise<void>;
  createPair: (pairName?: string, hostUserId?: string) => Promise<PairState>;
  joinPair: (code: string) => Promise<PairState>;
  unlinkPair: () => Promise<void>;
  setMood: (mood: PairState['mood']) => void;
  setPairName: (name: string) => void;
  setRoomSize: (size: number) => void;
  setPartnerInfo: (name: string, presence?: Presence) => void;
  sendWarmth: () => void;
  warmthPulse: number;
  addTrack: (track: Omit<TrackItem, 'id'>) => void;
  removeTrack: (id: string) => void;
  removeTrackMeta: (title: string, artist?: string) => boolean;
  clearTracks: () => void;
  reactTrack: (id: string, reaction: TrackItem['reaction']) => void;
  reactTrackMeta: (
    title: string,
    artist: string,
    reaction: NonNullable<TrackItem['reaction']>,
  ) => void;
  nowPlayingId: string | null;
  setNowPlaying: (id: string | null) => void;
  partnerNowPlaying: string | null;
  setPartnerNowPlaying: (title: string | null) => void;
  addNote: (text: string) => TinyNote | null;
  removeNote: (id: string) => void;
  receiveNote: (note: TinyNote) => void;
  setActivePlaylist: (id: string | null) => void;
  renamePlaylist: (id: string, name: string) => boolean;
  createPlaylist: (name: string, mood?: PlaylistMood) => Playlist | null;
  receivePlaylist: (playlist: Playlist) => void;
  removePlaylist: (id: string) => boolean;
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
};

const STORAGE_KEY = 'lovepduo.v1';

const AppContext = createContext<AppState | null>(null);

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultPlaylists(): Playlist[] {
  return [
    { id: 'pl_night', name: 'Ночь', mood: 'night', trackIds: [] },
    { id: 'pl_warm', name: 'Тёплый свет', mood: 'warm', trackIds: [] },
    { id: 'pl_rain', name: 'Дождь', mood: 'rain', trackIds: [] },
    { id: 'pl_pulse', name: 'Пульс', mood: 'pulse', trackIds: [] },
  ];
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
  const [notes, setNotes] = useState<TinyNote[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>(defaultPlaylists);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>('pl_night');
  const [warmthPulse, setWarmthPulse] = useState(0);
  const [nowPlayingId, setNowPlayingId] = useState<string | null>(null);
  const [partnerNowPlaying, setPartnerNowPlaying] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await hydrateWsUrl();
        track('session_start');
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            user?: UserProfile | null;
            pair?: PairState | null;
            tracks?: TrackItem[];
            notes?: TinyNote[];
            playlists?: Playlist[];
            activePlaylistId?: string | null;
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
          setNotes(parsed.notes ?? []);
          setPlaylists(
            parsed.playlists?.length ? parsed.playlists : defaultPlaylists(),
          );
          setActivePlaylistId(parsed.activePlaylistId ?? 'pl_night');
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
      JSON.stringify({ user, pair, tracks, notes, playlists, activePlaylistId }),
    );
  }, [hydrated, user, pair, tracks, notes, playlists, activePlaylistId]);

  const signIn = useCallback(async (name: string) => {
    const clean = name.trim() || 'Игрок';
    let next: UserProfile = { id: makeId('usr'), displayName: clean };
    setUser((prev) => {
      next = prev ? { ...prev, displayName: clean } : next;
      return next;
    });
    return next;
  }, []);

  const updateDisplayName = useCallback(async (name: string) => {
    return signIn(name);
  }, [signIn]);

  const signOut = useCallback(async () => {
    pairRealtime.disconnect();
    setUser(null);
    setPair(null);
    setTracks([]);
    setNotes([]);
    setPlaylists(defaultPlaylists());
    setActivePlaylistId('pl_night');
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

  const setPairName = useCallback((name: string) => {
    const clean = name.trim() || 'Наша комната';
    setPair((prev) => (prev ? { ...prev, name: clean } : prev));
  }, []);

  const setRoomSize = useCallback((size: number) => {
    setPair((prev) => (prev ? { ...prev, roomSize: size } : prev));
  }, []);

  const setPartnerInfo = useCallback((name: string, presence: Presence = 'online') => {
    setPair((prev) =>
      prev
        ? {
            ...prev,
            partnerName: name || prev.partnerName,
            partnerPresence: presence,
          }
        : prev,
    );
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

  const removeTrack = useCallback((id: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== id));
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.trackIds.includes(id)
          ? { ...pl, trackIds: pl.trackIds.filter((tid) => tid !== id) }
          : pl,
      ),
    );
    setNowPlayingId((cur) => (cur === id ? null : cur));
  }, []);

  const removeTrackMeta = useCallback((title: string, artist?: string) => {
    const tNorm = title.trim().toLowerCase();
    const aNorm = (artist ?? '').trim().toLowerCase();
    let hitId: string | null = null;
    setTracks((prev) => {
      const hit = prev.find(
        (t) =>
          t.title.toLowerCase() === tNorm &&
          (!aNorm || t.artist.toLowerCase() === aNorm),
      );
      if (!hit) return prev;
      hitId = hit.id;
      return prev.filter((t) => t.id !== hit.id);
    });
    if (!hitId) return false;
    const id = hitId;
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.trackIds.includes(id)
          ? { ...pl, trackIds: pl.trackIds.filter((tid) => tid !== id) }
          : pl,
      ),
    );
    setNowPlayingId((cur) => (cur === id ? null : cur));
    return true;
  }, []);

  const clearTracks = useCallback(() => {
    setTracks([]);
    setPlaylists((prev) => prev.map((pl) => ({ ...pl, trackIds: [] })));
    setNowPlayingId(null);
  }, []);

  const reactTrack = useCallback((id: string, reaction: TrackItem['reaction']) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, reaction } : t)),
    );
  }, []);

  const reactTrackMeta = useCallback(
    (title: string, artist: string, reaction: NonNullable<TrackItem['reaction']>) => {
      const tNorm = title.trim().toLowerCase();
      const aNorm = artist.trim().toLowerCase();
      setTracks((prev) =>
        prev.map((t) =>
          t.title.toLowerCase() === tNorm && (!aNorm || t.artist.toLowerCase() === aNorm)
            ? { ...t, reaction }
            : t,
        ),
      );
    },
    [],
  );

  const setNowPlaying = useCallback((id: string | null) => {
    setNowPlayingId(id);
  }, []);

  const addNote = useCallback(
    (text: string): TinyNote | null => {
      const clean = text.trim();
      if (!clean) return null;
      const note: TinyNote = {
        id: makeId('note'),
        text: clean.slice(0, 180),
        from: user?.displayName ?? 'Ты',
        at: Date.now(),
      };
      setNotes((prev) => [note, ...prev].slice(0, 50));
      return note;
    },
    [user?.displayName],
  );

  const removeNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const receiveNote = useCallback((note: TinyNote) => {
    setNotes((prev) => {
      if (prev.some((n) => n.id === note.id)) return prev;
      return [note, ...prev].slice(0, 50);
    });
  }, []);

  const setActivePlaylist = useCallback((id: string | null) => {
    setActivePlaylistId(id);
  }, []);

  const renamePlaylist = useCallback((id: string, name: string) => {
    const next = name.trim().slice(0, 28);
    if (!next) return false;
    let hit = false;
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== id) return pl;
        hit = true;
        return pl.name === next ? pl : { ...pl, name: next };
      }),
    );
    return hit;
  }, []);

  const createPlaylist = useCallback((name: string, mood: PlaylistMood = 'warm') => {
    const next = name.trim().slice(0, 28) || 'Наша полка';
    const created: Playlist = {
      id: makeId('pl'),
      name: next,
      mood,
      trackIds: [],
    };
    let accepted = false;
    setPlaylists((prev) => {
      if (prev.length >= 8) return prev;
      accepted = true;
      return [...prev, created];
    });
    return accepted ? created : null;
  }, []);

  const receivePlaylist = useCallback((playlist: Playlist) => {
    if (!playlist?.id || !playlist.name) return;
    setPlaylists((prev) => {
      if (prev.some((p) => p.id === playlist.id)) {
        return prev.map((p) =>
          p.id === playlist.id
            ? { ...p, name: playlist.name, mood: playlist.mood ?? p.mood }
            : p,
        );
      }
      if (prev.length >= 8) return prev;
      return [
        ...prev,
        {
          id: playlist.id,
          name: playlist.name.trim().slice(0, 28),
          mood: playlist.mood ?? 'warm',
          trackIds: Array.isArray(playlist.trackIds) ? playlist.trackIds : [],
        },
      ];
    });
  }, []);

  const removePlaylist = useCallback((id: string) => {
    const locked = new Set(['pl_night', 'pl_warm', 'pl_rain', 'pl_pulse']);
    if (locked.has(id)) return false;
    let hit = false;
    setPlaylists((prev) => {
      if (!prev.some((p) => p.id === id)) return prev;
      hit = true;
      return prev.filter((p) => p.id !== id);
    });
    setActivePlaylistId((cur) => (cur === id ? 'pl_night' : cur));
    return hit;
  }, []);

  const addTrackToPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId && !pl.trackIds.includes(trackId)
          ? { ...pl, trackIds: [trackId, ...pl.trackIds] }
          : pl,
      ),
    );
  }, []);

  const removeTrackFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId && pl.trackIds.includes(trackId)
          ? { ...pl, trackIds: pl.trackIds.filter((id) => id !== trackId) }
          : pl,
      ),
    );
  }, []);

  const value = useMemo(
    () => ({
      hydrated,
      user,
      pair,
      tracks,
      notes,
      playlists,
      activePlaylistId,
      signIn,
      updateDisplayName,
      signOut,
      createPair,
      joinPair,
      unlinkPair,
      setMood,
      setPairName,
      setRoomSize,
      setPartnerInfo,
      sendWarmth,
      warmthPulse,
      addTrack,
      removeTrack,
      removeTrackMeta,
      clearTracks,
      reactTrack,
      reactTrackMeta,
      nowPlayingId,
      setNowPlaying,
      partnerNowPlaying,
      setPartnerNowPlaying,
      addNote,
      removeNote,
      receiveNote,
      setActivePlaylist,
      renamePlaylist,
      createPlaylist,
      receivePlaylist,
      removePlaylist,
      addTrackToPlaylist,
      removeTrackFromPlaylist,
    }),
    [
      hydrated,
      user,
      pair,
      tracks,
      notes,
      playlists,
      activePlaylistId,
      signIn,
      updateDisplayName,
      signOut,
      createPair,
      joinPair,
      unlinkPair,
      setMood,
      setPairName,
      setRoomSize,
      setPartnerInfo,
      sendWarmth,
      warmthPulse,
      addTrack,
      removeTrack,
      removeTrackMeta,
      clearTracks,
      reactTrack,
      reactTrackMeta,
      nowPlayingId,
      setNowPlaying,
      partnerNowPlaying,
      addNote,
      removeNote,
      receiveNote,
      setActivePlaylist,
      renamePlaylist,
      createPlaylist,
      receivePlaylist,
      removePlaylist,
      addTrackToPlaylist,
      removeTrackFromPlaylist,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
