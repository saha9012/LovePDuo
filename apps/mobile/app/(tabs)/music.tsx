import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { EmptyState } from '../../src/components/EmptyState';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp, TrackItem, Playlist } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { sendMusicOrQueue, pendingMusicCount } from '../../src/realtime/musicOutbox';
import { sendGameIfPeerLive } from '../../src/realtime/sendGameIfPeerLive';
import { juice } from '../../src/audio/juice';
import { track as trackEvent } from '../../src/analytics/track';
import { spotifyConfigured, spotifyStatusLabel } from '../../src/music/spotifyConfig';
import { confirmDestructive } from '../../src/utils/confirmDestructive';
import { usePremium } from '../../src/store/PremiumStore';

export default function MusicScreen() {
  const insets = useSafeAreaInsets();
  const {
    tracks,
    addTrack,
    removeTrack,
    removeTrackMeta,
    clearTracks,
    user,
    pair,
    reactTrack,
    reactTrackMeta,
    nowPlayingId,
    setNowPlaying,
    partnerNowPlaying,
    setPartnerNowPlaying,
    playlists,
    activePlaylistId,
    setActivePlaylist,
    renamePlaylist,
    createPlaylist,
    receivePlaylist,
    removePlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    setMood,
  } = useApp();
  const { maxShelves, isPlus } = usePremium();
  const [note, setNote] = useState('');
  const [outboxTick, setOutboxTick] = useState(0);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [progress, setProgress] = useState<{ pos: number; dur: number } | null>(null);
  const soundRef = React.useRef<Audio.Sound | null>(null);
  const nowPlayingRef = React.useRef<string | null>(null);
  const peerPulse = useSharedValue(1);
  const noteTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteRef = React.useRef('');
  const lastStopAt = React.useRef(0);
  const lastHelloAt = React.useRef(0);
  const lastReactMatchAt = React.useRef(0);
  const lastReactChoice = React.useRef<string | null>(null);
  const lastListenMatchAt = React.useRef(0);
  const lastListenTitle = React.useRef<string | null>(null);
  const playTrackRef = React.useRef<(track: TrackItem) => Promise<void>>(async () => undefined);
  const visibleTracksRef = React.useRef<TrackItem[]>([]);
  const progressWidthRef = React.useRef(1);

  const showNote = (text: string, ms = 1800) => {
    noteRef.current = text;
    setNote(text);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      noteRef.current = '';
      setNote('');
    }, ms);
  };

  /** Ephemeral — never queue stale now-playing into an empty room. */
  const sendNowPlaying = (title: string | null) =>
    sendGameIfPeerLive('now-playing', {
      title,
      from: user?.displayName,
    })
      ? ('sent' as const)
      : ('skipped' as const);

  const active = playlists.find((p) => p.id === activePlaylistId) ?? playlists[0];
  const visibleTracks = useMemo(() => {
    if (!active || active.trackIds.length === 0) return tracks;
    const set = new Set(active.trackIds);
    const ordered = active.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter(Boolean) as TrackItem[];
    const rest = tracks.filter((t) => !set.has(t.id));
    return [...ordered, ...rest];
  }, [tracks, active]);
  visibleTracksRef.current = visibleTracks;

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  useEffect(() => {
    nowPlayingRef.current = nowPlayingId;
  }, [nowPlayingId]);

  useEffect(() => {
    return () => {
      void sound?.unloadAsync();
    };
  }, [sound]);

  useEffect(() => {
    if (!pair) return;
    const id = setInterval(() => setOutboxTick((n) => n + 1), 2000);
    return () => clearInterval(id);
  }, [pair?.code]);

  useEffect(() => {
    if (!partnerNowPlaying) return;
    peerPulse.value = withSequence(
      withTiming(1.04, { duration: 160 }),
      withTiming(1, { duration: 280 }),
    );
    void juice.card();
  }, [partnerNowPlaying, peerPulse]);

  useEffect(() => {
    if (typeof pair?.roomSize === 'number' && pair.roomSize < 2 && partnerNowPlaying) {
      setPartnerNowPlaying(null);
    }
  }, [pair?.roomSize, partnerNowPlaying, setPartnerNowPlaying]);

  const peerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: peerPulse.value }],
    opacity: 0.85 + (peerPulse.value - 1) * 2,
  }));

  useEffect(() => {
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'peer_left') {
        setPartnerNowPlaying(null);
        showNote('Партнёр ушёл с Music');
        void juice.miss();
        return;
      }
      if (msg.type === 'peer_joined') {
        const racing =
          noteRef.current === 'Партнёр ушёл с Music' ||
          noteRef.current === 'Партнёр снова на связи' ||
          noteRef.current === 'Партнёр снова в комнате' ||
          noteRef.current === 'Оба снова на Music';
        showNote(racing ? 'Оба снова на Music' : 'Партнёр снова в комнате');
        void juice.sync();
        if (user?.id) {
          lastHelloAt.current = Date.now();
          sendGameIfPeerLive('music-hello', {
            from: user.displayName,
            fromId: user.id,
          });
        }
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'music-hello') {
        const payload = msg.payload as { from?: string; fromId?: string } | undefined;
        if (payload?.fromId && payload.fromId === user?.id) return;
        const both = Date.now() - lastHelloAt.current < 2500;
        showNote(
          both
            ? noteRef.current === 'Оба на Music' || noteRef.current === 'Оба слушают полку'
              ? 'Оба слушают полку'
              : 'Оба на Music'
            : `${payload?.from ?? 'Партнёр'} на Music`,
        );
        void (both ? juice.perfect() : juice.hit());
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'track-meta') {
        const payload = msg.payload as {
          title?: string;
          artist?: string;
          sourceType?: TrackItem['sourceType'];
          from?: string;
          fromId?: string;
        } | undefined;
        if (!payload?.title || payload.fromId === user?.id) return;
        const already = tracks.some(
          (t) =>
            t.title === payload.title &&
            (payload.artist ? t.artist === payload.artist : true),
        );
        if (!already) {
          addTrack({
            title: payload.title,
            artist: payload.artist ?? 'Партнёр',
            sourceType: payload.sourceType ?? 'link',
            playbackMode: payload.sourceType === 'spotify' ? 'spotify' : 'link',
            addedBy: payload.from ?? 'Партнёр',
          });
        }
        showNote(
          already
            ? noteRef.current.startsWith('Оба добавили') ||
              noteRef.current.startsWith('Оба в коллекции')
              ? `Оба в коллекции «${payload.title}»`
              : `Оба добавили «${payload.title}»`
            : `${payload.from ?? 'Партнёр'} добавил «${payload.title}»`,
        );
        void (already ? juice.perfect() : juice.sync());
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'now-playing') {
        const payload = msg.payload as { title?: string | null; from?: string } | undefined;
        if (payload?.title) {
          setPartnerNowPlaying(`${payload.from ?? 'Партнёр'}: ${payload.title}`);
          const mine = tracks.find((t) => t.id === nowPlayingId);
          const both = Boolean(mine && mine.title === payload.title);
          const again =
            both &&
            lastListenTitle.current === payload.title &&
            Date.now() - lastListenMatchAt.current < 3200;
          if (both) {
            lastListenTitle.current = payload.title;
            lastListenMatchAt.current = Date.now();
          }
          showNote(
            again
              ? `Оба в треке «${payload.title}»`
              : both
                ? `Оба слушают «${payload.title}»`
                : `${payload.from ?? 'Партнёр'}: ${payload.title}`,
          );
          void (again || both ? juice.perfect() : juice.hit());
        } else if (payload && payload.title === null) {
          setPartnerNowPlaying(null);
          const both = Date.now() - lastStopAt.current < 2200;
          const racing = both && Date.now() - lastStopAt.current < 900;
          showNote(
            racing
              ? 'Оба тишина'
              : both
                ? 'Оба остановили'
                : `${payload.from ?? 'Партнёр'} остановил трек`,
          );
          void (both ? juice.sync() : juice.miss());
        }
      }
      if (msg.type === 'game' && msg.gameId === 'playlist-add') {
        const payload = msg.payload as {
          playlistId?: string;
          title?: string;
          artist?: string;
          from?: string;
        } | undefined;
        if (!payload?.playlistId || !payload.title) return;
        // Shelf mutation applied in MusicRealtimeSync (auto-adds missing track).
        const match = tracks.find(
          (t) =>
            t.title === payload.title &&
            (payload.artist ? t.artist === payload.artist : true),
        );
        const pl = playlists.find((p) => p.id === payload.playlistId);
        const alreadyIn = Boolean(match && pl?.trackIds.includes(match.id));
        const plName = pl?.name;
        const racing =
          alreadyIn &&
          (noteRef.current.startsWith('Оба на полке') ||
            noteRef.current.startsWith('Оба в полке'));
        showNote(
          racing
            ? `Оба в полке «${payload.title}»`
            : alreadyIn
              ? `Оба на полке «${payload.title}»`
              : `${payload.from ?? 'Партнёр'} положил «${payload.title}»${plName ? ` в «${plName}»` : ''}`,
        );
        void (alreadyIn ? juice.perfect() : juice.hit());
      }
      if (msg.type === 'game' && msg.gameId === 'track-react') {
        const payload = msg.payload as {
          title?: string;
          artist?: string;
          reaction?: TrackItem['reaction'];
          from?: string;
        } | undefined;
        if (!payload?.title || !payload.reaction) return;
        const local = tracks.find(
          (t) =>
            t.title === payload.title &&
            (payload.artist ? t.artist === payload.artist : true),
        );
        const same = local?.reaction === payload.reaction;
        reactTrackMeta(payload.title, payload.artist ?? '', payload.reaction);
        const key = `${payload.title}|${payload.reaction}`;
        const again =
          same &&
          lastReactChoice.current === key &&
          Date.now() - lastReactMatchAt.current < 2800;
        if (same) {
          lastReactMatchAt.current = Date.now();
          lastReactChoice.current = key;
        }
        showNote(
          again
            ? noteRef.current.startsWith('Оба чувствуют') ||
              noteRef.current.startsWith('Оба в эмоции')
              ? `Оба в эмоции «${payload.title}»`
              : `Оба чувствуют «${payload.title}»`
            : same
              ? `Синхрон: «${payload.title}»`
              : `${payload.from ?? 'Партнёр'} отметил «${payload.title}»`,
        );
        void (again || same ? juice.perfect() : juice.card());
      }
      if (msg.type === 'game' && msg.gameId === 'track-remove') {
        const payload = msg.payload as {
          title?: string;
          artist?: string;
          from?: string;
          fromId?: string;
        } | undefined;
        if (!payload?.title || payload.fromId === user?.id) return;
        const playing = tracks.find((t) => t.id === nowPlayingRef.current);
        const hitPlaying =
          playing &&
          playing.title === payload.title &&
          (!payload.artist || playing.artist === payload.artist);
        const ok = removeTrackMeta(payload.title, payload.artist);
        if (ok) {
          if (hitPlaying) {
            void (async () => {
              try {
                await soundRef.current?.stopAsync();
                await soundRef.current?.unloadAsync();
              } catch {
                /* ignore */
              }
              setSound(null);
              setNowPlaying(null);
              setProgress(null);
            })();
          }
          if (
            partnerNowPlaying &&
            partnerNowPlaying.toLowerCase().includes(payload.title.toLowerCase())
          ) {
            setPartnerNowPlaying(null);
          }
          showNote(`${payload.from ?? 'Партнёр'} удалил «${payload.title}»`);
          void juice.miss();
        }
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'track-clear') {
        const payload = msg.payload as { from?: string; fromId?: string } | undefined;
        if (payload?.fromId === user?.id) return;
        void (async () => {
          try {
            await soundRef.current?.stopAsync();
            await soundRef.current?.unloadAsync();
          } catch {
            /* ignore */
          }
          setSound(null);
          setNowPlaying(null);
          setProgress(null);
          clearTracks();
          setPartnerNowPlaying(null);
          showNote(`${payload?.from ?? 'Партнёр'} очистил библиотеку`);
          void juice.miss();
        })();
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'playlist-remove') {
        const payload = msg.payload as {
          playlistId?: string;
          title?: string;
          artist?: string;
          from?: string;
          fromId?: string;
        } | undefined;
        if (!payload?.playlistId || !payload.title || payload.fromId === user?.id) return;
        const match = tracks.find(
          (t) =>
            t.title === payload.title &&
            (payload.artist ? t.artist === payload.artist : true),
        );
        if (!match) return;
        const pl = playlists.find((p) => p.id === payload.playlistId);
        if (!pl?.trackIds.includes(match.id)) return;
        removeTrackFromPlaylist(payload.playlistId, match.id);
        showNote(
          `${payload.from ?? 'Партнёр'} убрал «${payload.title}»${pl.name ? ` из «${pl.name}»` : ''}`,
        );
        void juice.hit();
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'playlist') {
        const payload = msg.payload as {
          playlistId?: string;
          mood?: 'night' | 'warm' | 'rain' | 'pulse';
        } | undefined;
        if (payload?.playlistId) {
          const both = activePlaylistId === payload.playlistId;
          setActivePlaylist(payload.playlistId);
          if (payload.mood && payload.mood !== 'pulse') setMood(payload.mood);
          const name = playlists.find((p) => p.id === payload.playlistId)?.name;
          showNote(
            both
              ? noteRef.current.startsWith('Оба на «') ||
                noteRef.current === 'Оба на одной полке' ||
                noteRef.current === 'Оба в полке'
                ? 'Оба в полке'
                : name
                  ? `Оба на «${name}»`
                  : 'Оба на одной полке'
              : name
                ? `Партнёр переключил «${name}»`
                : 'Партнёр сменил плейлист',
          );
          void (both ? juice.perfect() : juice.hit());
        }
      }
      if (msg.type === 'game' && msg.gameId === 'playlist-rename') {
        const payload = msg.payload as {
          playlistId?: string;
          name?: string;
          from?: string;
          fromId?: string;
        } | undefined;
        if (!payload?.playlistId || !payload.name || payload.fromId === user?.id) return;
        const ok = renamePlaylist(payload.playlistId, payload.name);
        if (!ok) return;
        showNote(
          `${payload.from ?? 'Партнёр'} назвал полку «${payload.name.trim().slice(0, 28)}»`,
        );
        void juice.card();
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'playlist-create') {
        const payload = msg.payload as
          | (Playlist & { from?: string; fromId?: string })
          | undefined;
        if (!payload?.id || !payload.name || payload.fromId === user?.id) return;
        receivePlaylist({
          id: payload.id,
          name: payload.name,
          mood: payload.mood ?? 'warm',
          trackIds: [],
        });
        showNote(
          `${payload.from ?? 'Партнёр'} создал «${payload.name.trim().slice(0, 28)}»`,
        );
        void juice.card();
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'playlist-delete') {
        const payload = msg.payload as {
          playlistId?: string;
          from?: string;
          fromId?: string;
        } | undefined;
        if (!payload?.playlistId || payload.fromId === user?.id) return;
        const name = playlists.find((p) => p.id === payload.playlistId)?.name;
        const ok = removePlaylist(payload.playlistId);
        if (!ok) return;
        showNote(
          `${payload.from ?? 'Партнёр'} убрал полку${name ? ` «${name}»` : ''}`,
        );
        void juice.miss();
      }
    });
    return () => {
      off();
    };
  }, [setPartnerNowPlaying, setActivePlaylist, setMood, reactTrackMeta, removeTrackMeta, removeTrackFromPlaylist, clearTracks, playlists, tracks, user?.id, addTrack, addTrackToPlaylist, activePlaylistId, nowPlayingId, partnerNowPlaying, renamePlaylist, receivePlaylist, removePlaylist]);

  useEffect(() => {
    if (!pair || !user) return;
    lastHelloAt.current = Date.now();
    sendGameIfPeerLive('music-hello', {
      from: user.displayName,
      fromId: user.id,
    });
  }, [pair?.code, user?.id, user?.displayName]);

  const formatMs = (ms: number) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const playTrack = async (track: TrackItem) => {
    if (!track.uri || track.playbackMode !== 'local') {
      showNote(
        track.playbackMode === 'spotify'
          ? 'Стрим через Spotify — нужен OAuth / App Remote.'
          : 'Для этого трека пока только карточка/ссылка. Загрузите файл в LPD.',
        2800,
      );
      return;
    }
    try {
      await sound?.unloadAsync();
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const next = new Audio.Sound();
      await next.loadAsync({ uri: track.uri });
      setProgress(null);
      next.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        if (typeof status.positionMillis === 'number') {
          setProgress({
            pos: status.positionMillis,
            dur: status.durationMillis ?? 0,
          });
        }
        if (!status.didJustFinish) return;
        void next.unloadAsync();
        setSound(null);
        setNowPlaying(null);
        setProgress(null);
        lastStopAt.current = Date.now();
        const list = visibleTracksRef.current;
        const idx = list.findIndex((t) => t.id === track.id);
        const following = idx >= 0 ? list.slice(idx + 1) : list;
        const nextLocal = following.find(
          (t) => Boolean(t.uri) && t.playbackMode === 'local',
        );
        if (nextLocal) {
          showNote(`Дальше: «${nextLocal.title}»`);
          void juice.sync();
          void playTrackRef.current(nextLocal);
          return;
        }
        sendNowPlaying(null);
        showNote('Трек доиграл.');
        void juice.miss();
      });
      await next.playAsync();
      setSound(next);
      setNowPlaying(track.id);
      const np = sendNowPlaying(track.title);
      showNote(
        np === 'sent'
          ? 'Сейчас играет внутри LovePDuo. Партнёр видит Now Playing.'
          : 'Сейчас играет внутри LovePDuo. Now Playing · ждёт WS 2/2.',
      );
      void juice.hit();
    } catch {
      showNote('Не удалось воспроизвести файл. Попробуйте другой формат (mp3/m4a).', 2800);
    }
  };
  playTrackRef.current = playTrack;

  /** Same rule as sendGameIfPeerLive — presence alone can lie when room is 1. */
  const peerInWsRoom =
    Boolean(pair) && typeof pair?.roomSize === 'number' && pair.roomSize >= 2;

  const clearLibrary = () => {
    if (tracks.length === 0) return;
    void confirmDestructive(
      'Очистить библиотеку?',
      peerInWsRoom
        ? `Удалить все ${tracks.length} трек(ов) у тебя и у партнёра? Полки тоже опустеют.`
        : `Удалить все ${tracks.length} трек(ов) локально? Sync удаления уйдёт, когда комната станет 2/2. Полки тоже опустеют.`,
    ).then((ok) => {
      if (!ok) return;
      void (async () => {
        try {
          await soundRef.current?.stopAsync();
          await soundRef.current?.unloadAsync();
        } catch {
          /* ignore */
        }
        setSound(null);
        setNowPlaying(null);
        setProgress(null);
        setPartnerNowPlaying(null);
        lastStopAt.current = Date.now();
        clearTracks();
        sendNowPlaying(null);
        const clearResult = sendMusicOrQueue('track-clear', {
          from: user?.displayName,
          fromId: user?.id,
        });
        showNote(
          clearResult === 'sent'
            ? 'Библиотека очищена.'
            : 'Библиотека очищена · sync ждёт WS 2/2',
        );
        void juice.miss();
        trackEvent('track_removed', { source: 'clear_all' });
      })();
    });
  };

  const performDeleteTrack = async (track: TrackItem) => {
    if (nowPlayingId === track.id || nowPlayingRef.current === track.id) {
      try {
        await soundRef.current?.stopAsync();
        await soundRef.current?.unloadAsync();
      } catch {
        /* ignore */
      }
      setSound(null);
      setNowPlaying(null);
      setProgress(null);
      lastStopAt.current = Date.now();
      sendNowPlaying(null);
    }
    removeTrack(track.id);
    const result = sendMusicOrQueue('track-remove', {
      title: track.title,
      artist: track.artist,
      from: user?.displayName,
      fromId: user?.id,
    });
    showNote(
      result === 'sent'
        ? `Удалили «${track.title}»`
        : `Удалили «${track.title}» · sync ждёт WS 2/2`,
    );
    void juice.miss();
    trackEvent('track_removed', { source: track.sourceType });
  };

  /** Tap → confirm (window.confirm on web). Long-press → delete now. */
  const deleteTrack = (track: TrackItem) => {
    void (async () => {
      const ok = await confirmDestructive(
        'Удалить трек?',
        `«${track.title}» — ${track.artist} исчезнет из библиотеки и полок.`,
      );
      if (!ok) return;
      await performDeleteTrack(track);
    })();
  };

  /** Local hide only — no track-remove WS (partner keeps their copy). */
  const reportTrack = (track: TrackItem) => {
    void (async () => {
      const ok = await confirmDestructive(
        'Пожаловаться на трек?',
        'Скроем его у вас. Облачной модерации пока нет — жалоба только локальный лог.',
        'Скрыть',
      );
      if (!ok) return;
      if (nowPlayingId === track.id || nowPlayingRef.current === track.id) {
        try {
          await soundRef.current?.stopAsync();
          await soundRef.current?.unloadAsync();
        } catch {
          /* ignore */
        }
        setSound(null);
        setNowPlaying(null);
        setProgress(null);
        lastStopAt.current = Date.now();
        sendNowPlaying(null);
      }
      removeTrack(track.id);
      trackEvent('ugc_report', {
        kind: 'track',
        trackId: track.id,
        title: track.title,
      });
      showNote('Скрыто локально · жалоба записана');
      void juice.miss();
    })();
  };

  const shelfRemove = (track: TrackItem) => {
    if (!active || !active.trackIds.includes(track.id)) return;
    removeTrackFromPlaylist(active.id, track.id);
    const result = sendMusicOrQueue('playlist-remove', {
      playlistId: active.id,
      title: track.title,
      artist: track.artist,
      from: user?.displayName,
      fromId: user?.id,
    });
    showNote(
      result === 'sent'
        ? `Убрали из «${active.name}»`
        : `Убрали из «${active.name}» · sync ждёт WS 2/2`,
    );
    void juice.hit();
  };

  const upload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/mpeg', 'audio/mp4', 'audio/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const title = asset.name.replace(/\.[^.]+$/, '');
    const artist = 'Загружено в LPD';
    if (tracks.some((t) => t.title === title && t.artist === artist && t.uri === asset.uri)) {
      showNote('Этот файл уже на полке.');
      void juice.miss();
      return;
    }
    addTrack({
      title,
      artist,
      sourceType: 'upload',
      playbackMode: 'local',
      addedBy: user?.displayName ?? 'Ты',
      uri: asset.uri,
    });
    const sync = sendMusicOrQueue('track-meta', {
      title,
      artist,
      sourceType: 'upload',
      from: user?.displayName,
      fromId: user?.id,
    });
    trackEvent('track_uploaded', { source: 'upload' });
    showNote(
      sync === 'sent'
        ? 'Трек сохранён. Партнёр видит карточку (файл — локально у тебя).'
        : 'Трек сохранён. Карточка · sync ждёт WS 2/2 (файл — локально).',
    );
    void juice.sync();
  };
  const addSpotifyStub = () => {
    const title = 'Midnight Orbit (demo)';
    const artist = 'Spotify metadata';
    if (tracks.some((t) => t.title === title && t.artist === artist)) {
      showNote('Spotify demo уже на полке — удали ×, если нужен заново.');
      void juice.miss();
      return;
    }
    addTrack({
      title,
      artist,
      sourceType: 'spotify',
      playbackMode: 'spotify',
      addedBy: user?.displayName ?? 'Ты',
    });
    const sync = sendMusicOrQueue('track-meta', {
      title,
      artist,
      sourceType: 'spotify',
      from: user?.displayName,
      fromId: user?.id,
    });
    showNote(
      spotifyConfigured()
        ? sync === 'sent'
          ? 'Spotify: метаданные у обоих. Стрим — OAuth / App Remote.'
          : 'Spotify: метаданные локально · sync ждёт WS 2/2. Стрим — OAuth.'
        : sync === 'sent'
          ? `${spotifyStatusLabel()} · stub ушёл партнёру.`
          : `${spotifyStatusLabel()} · stub · sync ждёт WS 2/2.`,
      2800,
    );
    void juice.card();
  };

  const addVkStub = () => {
    const title = 'Dusty Rose Night (demo)';
    const artist = 'VK link fallback';
    if (tracks.some((t) => t.title === title && t.artist === artist)) {
      showNote('VK demo уже на полке — удали ×, если нужен заново.');
      void juice.miss();
      return;
    }
    addTrack({
      title,
      artist,
      sourceType: 'vk',
      playbackMode: 'link',
      addedBy: user?.displayName ?? 'Ты',
    });
    const sync = sendMusicOrQueue('track-meta', {
      title,
      artist,
      sourceType: 'vk',
      from: user?.displayName,
      fromId: user?.id,
    });
    showNote(
      sync === 'sent'
        ? 'VK: metadata + fallback. Stub ушёл партнёру.'
        : 'VK: metadata локально · sync ждёт WS 2/2.',
    );
    void juice.card();
  };

  const react = (id: string, reaction: NonNullable<TrackItem['reaction']>) => {
    reactTrack(id, reaction);
    const t = tracks.find((x) => x.id === id);
    if (t) {
      lastReactChoice.current = `${t.title}|${reaction}`;
      lastReactMatchAt.current = Date.now();
      const sync = sendMusicOrQueue('track-react', {
        title: t.title,
        artist: t.artist,
        reaction,
        from: user?.displayName,
      });
      showNote(
        sync === 'sent'
          ? 'Реакция у обоих'
          : 'Реакция локально · sync ждёт WS 2/2',
      );
    }
    void juice.card();
  };

  const selectPlaylist = (id: string, mood: 'night' | 'warm' | 'rain' | 'pulse') => {
    if (renameId) {
      setRenameId(null);
      setRenameDraft('');
    }
    setActivePlaylist(id);
    if (mood !== 'pulse') setMood(mood);
    const sync = sendMusicOrQueue('playlist', { playlistId: id, mood, fromId: user?.id });
    if (sync === 'queued') {
      showNote('Полка локально · sync ждёт WS 2/2');
    }
    void juice.card();
  };

  const beginRename = (id: string, name: string) => {
    setRenameId(id);
    setRenameDraft(name);
    void juice.hit();
  };

  const commitRename = () => {
    if (!renameId) return;
    const id = renameId;
    const next = renameDraft.trim().slice(0, 28);
    setRenameId(null);
    setRenameDraft('');
    if (!next) return;
    const prev = playlists.find((p) => p.id === id)?.name;
    const ok = renamePlaylist(id, next);
    if (!ok || prev === next) return;
    const result = sendMusicOrQueue('playlist-rename', {
      playlistId: id,
      name: next,
      from: user?.displayName,
      fromId: user?.id,
    });
    showNote(
      result === 'sent' ? `Полка «${next}» — у обоих` : `Полка «${next}» · sync ждёт WS 2/2`,
    );
    void juice.card();
  };

  const addShelf = () => {
    if (playlists.length >= maxShelves) {
      showNote(
        isPlus
          ? `Максимум ${maxShelves} полок.`
          : `Free: ${maxShelves} полки. Duo Plus → 8. Profile → Plus.`,
      );
      return;
    }
    const pl = createPlaylist('Наша полка', active?.mood ?? 'warm');
    if (!pl) {
      showNote('Не вышло создать полку.');
      return;
    }
    setActivePlaylist(pl.id);
    const created = sendMusicOrQueue('playlist-create', {
      ...pl,
      from: user?.displayName,
      fromId: user?.id,
    });
    sendMusicOrQueue('playlist', { playlistId: pl.id, mood: pl.mood, fromId: user?.id });
    beginRename(pl.id, pl.name);
    showNote(
      created === 'sent'
        ? 'Новая полка у обоих — переименуй и пиши.'
        : 'Новая полка локально · sync ждёт WS 2/2 — переименуй.',
    );
    void juice.hit();
  };

  const deleteShelf = (id: string, name: string) => {
    void confirmDestructive(
      'Удалить полку?',
      peerInWsRoom
        ? `«${name}» исчезнет у обоих. Треки в библиотеке останутся.`
        : `«${name}» исчезнет локально; sync уйдёт, когда комната станет 2/2. Треки в библиотеке останутся.`,
    ).then(
      (ok) => {
        if (!ok) return;
        if (!removePlaylist(id)) {
          showNote('Базовые полки нельзя удалить.');
          return;
        }
        const result = sendMusicOrQueue('playlist-delete', {
          playlistId: id,
          from: user?.displayName,
          fromId: user?.id,
        });
        showNote(
          result === 'sent'
            ? `Полку «${name}» убрали`
            : `Полку «${name}» убрали · sync ждёт WS 2/2`,
        );
        void juice.miss();
      },
    );
  };

  return (
    <LpdBackground mood={active?.mood === 'pulse' ? 'warm' : active?.mood ?? 'warm'}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 },
        ]}
      >
        <Text style={styles.kicker}>Music</Text>
        <Text style={typography.headline}>Полка пары</Text>
        <Text style={typography.body}>
          {tracks.length} треков · {playlists.length} полок ·{' '}
          {playlists.reduce((n, p) => n + p.trackIds.length, 0)} на полках ·{' '}
          {tracks.filter((t) => t.reaction).length} реакций
          {nowPlayingId ? ' · играет' : ''}
          {pair
            ? peerInWsRoom
              ? ' · партнёр в комнате'
              : pair.partnerPresence === 'online'
                ? ' · presence ≠ room'
                : ' · партнёр offline'
            : ' · нет пары'}
          {isPlus ? ' · Plus' : ' · Free'}
          {(() => {
            void outboxTick;
            const pending = pendingMusicCount();
            return pending > 0 ? ` · sync ${pending}` : '';
          })()}
        </Text>
        {pair && !peerInWsRoom ? (
          <Text style={styles.offlineBanner}>
            В WS нет партнёра ({typeof pair.roomSize === 'number' ? `${pair.roomSize}/2` : '—'}) —
            карточки и Now Playing уйдут, когда комната станет 2/2. Файл трека всегда локально.
          </Text>
        ) : null}
        <View style={styles.statStrip}>
          {(
            [
              ['all', String(tracks.length), 'всего'],
              ['up', String(tracks.filter((t) => t.sourceType === 'upload').length), 'upload'],
              ['sp', String(tracks.filter((t) => t.sourceType === 'spotify').length), 'spotify'],
              ['vk', String(tracks.filter((t) => t.sourceType === 'vk').length), 'vk'],
              ['rx', String(tracks.filter((t) => t.reaction).length), '♥✦≈'],
              ['pl', String(active?.trackIds.length ?? 0), active?.name ?? 'полка'],
              [
                'ws',
                typeof pair?.roomSize === 'number' ? `${pair.roomSize}/2` : '—',
                'WS',
              ],
              [
                'pr',
                peerInWsRoom ? 'on' : pair?.partnerPresence === 'online' ? '≠' : 'off',
                'партнёр',
              ],
            ] as const
          ).map(([k, n, l]) => (
            <View key={k} style={styles.statPill}>
              <Text style={styles.statPillNum}>{n}</Text>
              <Text style={styles.statPillLabel} numberOfLines={1}>
                {l}
              </Text>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moods}>
          {playlists.map((pl) =>
            renameId === pl.id ? (
              <View key={pl.id} style={[styles.moodChip, styles.moodActive, styles.renameChip]}>
                <TextInput
                  value={renameDraft}
                  onChangeText={setRenameDraft}
                  onSubmitEditing={commitRename}
                  onBlur={commitRename}
                  autoFocus
                  maxLength={28}
                  placeholder="Имя полки"
                  placeholderTextColor={colors.textMuted}
                  style={styles.renameInput}
                  returnKeyType="done"
                />
              </View>
            ) : (
              <Pressable
                key={pl.id}
                onPress={() => selectPlaylist(pl.id, pl.mood)}
                onLongPress={() => beginRename(pl.id, pl.name)}
                delayLongPress={380}
                style={[styles.moodChip, activePlaylistId === pl.id && styles.moodActive]}
                accessibilityLabel={`${pl.name}, long-press чтобы переименовать`}
              >
                <Text style={[styles.moodLabel, activePlaylistId === pl.id && styles.moodLabelOn]}>
                  {pl.name}
                </Text>
                <Text style={styles.moodCount}>{pl.trackIds.length}</Text>
              </Pressable>
            ),
          )}
          {playlists.length < maxShelves ? (
            <Pressable
              onPress={addShelf}
              style={[styles.moodChip, styles.addShelfChip]}
              accessibilityLabel="Создать полку"
            >
              <Text style={styles.moodLabelOn}>+</Text>
            </Pressable>
          ) : null}
        </ScrollView>
        {active &&
        !['pl_night', 'pl_warm', 'pl_rain', 'pl_pulse'].includes(active.id) ? (
          <Pressable onPress={() => deleteShelf(active.id, active.name)} hitSlop={8}>
            <Text style={styles.deleteShelfHint}>Удалить полку «{active.name}»</Text>
          </Pressable>
        ) : null}

        {partnerNowPlaying && peerInWsRoom ? (
          <Animated.Text style={[styles.nowPlaying, peerStyle]}>
            ♪ партнёр · {partnerNowPlaying}
          </Animated.Text>
        ) : null}
        {active && active.trackIds.length === 0 && tracks.length > 0 ? (
          <Text style={styles.playlistHint}>
            «{active.name}» пуст — жми + у трека на полку
            {peerInWsRoom ? ' (полка у обоих)' : ' (полка локально · sync ждёт WS 2/2)'}. ×
            удаляет трек (long-press — сразу).
          </Text>
        ) : null}
        {nowPlayingId ? (
          <View style={styles.playbackCard}>
            {(() => {
              const list = visibleTracks;
              const idx = list.findIndex((t) => t.id === nowPlayingId);
              const cur = list[idx];
              const left =
                progress && progress.dur > 0
                  ? Math.max(0, progress.dur - progress.pos)
                  : null;
              return (
                <>
                  <Text style={styles.playbackTitle} numberOfLines={1}>
                    {cur ? `${cur.title} — ${cur.artist}` : 'Сейчас играет'}
                  </Text>
                  <Text style={styles.playbackMeta}>
                    {idx >= 0 ? `${idx + 1}/${list.length}` : `—/${list.length}`}
                    {progress && progress.dur > 0
                      ? ` · ${formatMs(progress.pos)} / ${formatMs(progress.dur)}`
                      : ''}
                    {left != null ? ` · −${formatMs(left)}` : ''}
                    {progress && progress.dur > 0
                      ? ` · ${Math.round((progress.pos / progress.dur) * 100)}%`
                      : ''}
                  </Text>
                </>
              );
            })()}
            {progress && progress.dur > 0 ? (
              <Pressable
                style={styles.progressBlock}
                onLayout={(e) => {
                  progressWidthRef.current = Math.max(1, e.nativeEvent.layout.width);
                }}
                onPress={(e) => {
                  const ratio = Math.max(
                    0,
                    Math.min(1, e.nativeEvent.locationX / progressWidthRef.current),
                  );
                  const target = Math.floor(ratio * progress.dur);
                  void sound?.setPositionAsync(target).then(() => {
                    setProgress({ pos: target, dur: progress.dur });
                  });
                  void juice.hit();
                }}
                accessibilityLabel="Перемотать трек"
              >
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(100, (progress.pos / progress.dur) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressTime}>тап по полосе = seek</Text>
              </Pressable>
            ) : null}
            <View style={styles.playbackRow}>
              <View style={styles.playbackBtn}>
                <LpdButton
                  label="‹"
                  variant="ghost"
                  onPress={() => {
                    const list = visibleTracksRef.current;
                    const idx = list.findIndex((t) => t.id === nowPlayingId);
                    const before = idx > 0 ? list.slice(0, idx).reverse() : [];
                    const prevLocal = before.find(
                      (t) => Boolean(t.uri) && t.playbackMode === 'local',
                    );
                    if (!prevLocal) {
                      showNote('Раньше локальных треков нет.');
                      void juice.miss();
                      return;
                    }
                    void playTrackRef.current(prevLocal);
                  }}
                />
              </View>
              <View style={styles.playbackBtn}>
                <LpdButton
                  label="■"
                  variant="ghost"
                  onPress={async () => {
                    await sound?.stopAsync();
                    await sound?.unloadAsync();
                    setSound(null);
                    setNowPlaying(null);
                    setProgress(null);
                    lastStopAt.current = Date.now();
                    const np = sendNowPlaying(null);
                    showNote(
                      np === 'sent'
                        ? 'Остановили — партнёр видит.'
                        : 'Остановили · Now Playing ждёт WS 2/2.',
                    );
                    void juice.miss();
                  }}
                />
              </View>
              <View style={styles.playbackBtn}>
                <LpdButton
                  label="›"
                  variant="ghost"
                  onPress={() => {
                    const list = visibleTracksRef.current;
                    const idx = list.findIndex((t) => t.id === nowPlayingId);
                    const following = idx >= 0 ? list.slice(idx + 1) : list;
                    const nextLocal = following.find(
                      (t) => Boolean(t.uri) && t.playbackMode === 'local',
                    );
                    if (!nextLocal) {
                      showNote('Дальше локальных треков нет.');
                      void juice.miss();
                      return;
                    }
                    void playTrackRef.current(nextLocal);
                  }}
                />
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          <LpdButton
            label={peerInWsRoom ? 'Загрузить трек' : 'Загрузить трек (meta ждёт WS 2/2)'}
            onPress={() => void upload()}
          />
          <LpdButton
            label={
              peerInWsRoom
                ? 'Добавить из Spotify (мета)'
                : 'Spotify мета (sync ждёт WS 2/2)'
            }
            variant="ghost"
            onPress={addSpotifyStub}
          />
          <LpdButton
            label={peerInWsRoom ? 'Импорт VK (fallback)' : 'VK мета (sync ждёт WS 2/2)'}
            variant="ghost"
            onPress={addVkStub}
          />
          {tracks.length > 0 ? (
            <LpdButton
              label={
                peerInWsRoom
                  ? 'Очистить библиотеку'
                  : 'Очистить библиотеку (sync ждёт WS 2/2)'
              }
              variant="ghost"
              onPress={clearLibrary}
            />
          ) : null}
        </View>
        <Text style={styles.spotifyHint}>{spotifyStatusLabel()}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}

        <View style={styles.list}>
          {tracks.length === 0 ? (
            <EmptyState
              title="Пока тихо"
              body={
                peerInWsRoom
                  ? 'Загрузите первый трек — файл локально у тебя, карточка уйдёт партнёру по WS. Удалить — × у карточки.'
                  : 'Загрузите первый трек — файл и карточка локально; мета уйдёт по WS, когда комната станет 2/2. Удалить — ×.'
              }
              meta={`0 треков · полок ${playlists.length}/${maxShelves}${
                isPlus ? ' · Plus' : ' · Free'
              } · ${
                peerInWsRoom
                  ? 'WS 2/2'
                  : pair?.partnerPresence === 'online'
                    ? 'presence ≠ room'
                    : pair
                      ? 'партнёр offline'
                      : 'нет пары'
              }`}
            />
          ) : (
            visibleTracks.map((t) => {
              const inActive = active?.trackIds.includes(t.id);
              return (
                <View
                  key={t.id}
                  style={[styles.row, nowPlayingId === t.id && styles.rowPlaying]}
                >
                  <Pressable style={{ flex: 1, gap: 4 }} onPress={() => void playTrack(t)}>
                    <Text style={styles.trackTitle}>
                      {nowPlayingId === t.id ? '▶ ' : ''}
                      {t.title}
                    </Text>
                    <Text style={styles.trackMeta}>
                      {t.artist} · {t.sourceType}
                      {inActive ? ` · ${active?.name}` : ''}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (!active) return;
                      if (inActive) {
                        shelfRemove(t);
                        return;
                      }
                      addTrackToPlaylist(active.id, t.id);
                      sendMusicOrQueue('track-meta', {
                        title: t.title,
                        artist: t.artist,
                        sourceType: t.sourceType,
                        from: user?.displayName,
                        fromId: user?.id,
                      });
                      const shelfResult = sendMusicOrQueue('playlist-add', {
                        playlistId: active.id,
                        title: t.title,
                        artist: t.artist,
                        sourceType: t.sourceType,
                        from: user?.displayName,
                        fromId: user?.id,
                      });
                      showNote(
                        shelfResult === 'sent'
                          ? `В «${active.name}» — полка у обоих.`
                          : `В «${active.name}» · sync ждёт WS 2/2`,
                      );
                      void juice.hit();
                    }}
                    onLongPress={() => {
                      if (inActive) shelfRemove(t);
                    }}
                    style={styles.addPl}
                    accessibilityLabel={
                      inActive ? `Убрать из ${active?.name}` : `Добавить в ${active?.name}`
                    }
                  >
                    <Text style={styles.addPlLabel}>{inActive ? '✓' : '+'}</Text>
                  </Pressable>
                  <View style={styles.reactRow}>
                    {(['heart', 'fire', 'rain'] as const).map((r) => (
                      <Pressable key={r} onPress={() => react(t.id, r)}>
                        <Text style={[styles.react, t.reaction === r && styles.reactOn]}>
                          {r === 'heart' ? '♥' : r === 'fire' ? '✦' : '≈'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {t.addedBy !== user?.displayName ? (
                    <Pressable
                      onPress={() => reportTrack(t)}
                      style={styles.deleteBtn}
                      accessibilityLabel={`Пожаловаться на ${t.title}`}
                      hitSlop={12}
                    >
                      <Text style={styles.deleteLabel}>!</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => deleteTrack(t)}
                    onLongPress={() => {
                      void performDeleteTrack(t);
                    }}
                    delayLongPress={380}
                    style={styles.deleteBtn}
                    accessibilityLabel={`Удалить ${t.title}`}
                    hitSlop={12}
                  >
                    <Text style={styles.deleteLabel}>×</Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </LpdBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  kicker: {
    fontFamily: fonts.uiMedium,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accentAmber,
    fontSize: 12,
  },
  offlineBanner: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 17,
    color: colors.accentRose,
  },
  statStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statPill: {
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,214,186,0.14)',
    backgroundColor: 'rgba(255,214,186,0.04)',
    alignItems: 'center',
  },
  statPillNum: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.accentAmber,
  },
  statPillLabel: {
    fontFamily: fonts.ui,
    fontSize: 9,
    color: colors.textMuted,
    maxWidth: 64,
  },
  moods: {
    gap: spacing.sm,
    paddingVertical: 4,
  },
  moodChip: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
    minWidth: 88,
  },
  moodActive: {
    borderColor: 'rgba(226,176,122,0.5)',
    backgroundColor: 'rgba(226,176,122,0.12)',
  },
  renameChip: {
    minWidth: 140,
    paddingVertical: 6,
  },
  renameInput: {
    fontFamily: fonts.uiSemi,
    color: colors.textPrimary,
    fontSize: 14,
    padding: 0,
    minWidth: 120,
  },
  addShelfChip: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
    borderStyle: 'dashed',
  },
  deleteShelfHint: {
    fontFamily: fonts.ui,
    color: colors.accentRose,
    fontSize: 12,
  },
  moodLabel: {
    fontFamily: fonts.uiSemi,
    color: colors.textMuted,
    fontSize: 13,
  },
  moodLabelOn: {
    color: colors.accentAmber,
  },
  moodCount: {
    fontFamily: fonts.ui,
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  nowPlaying: {
    fontFamily: fonts.uiMedium,
    color: colors.accentRose,
    fontSize: 14,
  },
  playlistHint: {
    fontFamily: fonts.ui,
    color: colors.accentMist,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    gap: spacing.sm,
  },
  playbackCard: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.28)',
    backgroundColor: 'rgba(36,28,49,0.55)',
  },
  playbackTitle: {
    fontFamily: fonts.uiSemi,
    fontSize: 15,
    color: colors.textPrimary,
  },
  playbackMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.accentAmber,
  },
  playbackRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  playbackBtn: {
    flex: 1,
  },
  progressBlock: {
    gap: 6,
    marginBottom: 4,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.accentAmber,
  },
  progressTime: {
    fontFamily: fonts.mono,
    color: colors.textMuted,
    fontSize: 12,
  },
  note: {
    fontFamily: fonts.ui,
    color: colors.accentRose,
    fontSize: 13,
    lineHeight: 18,
  },
  spotifyHint: {
    fontFamily: fonts.ui,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  list: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radii.md,
    padding: spacing.lg,
    backgroundColor: 'rgba(36,28,49,0.55)',
  },
  rowPlaying: {
    borderColor: 'rgba(226,176,122,0.55)',
    backgroundColor: 'rgba(196,92,110,0.16)',
  },
  trackTitle: {
    fontFamily: fonts.uiSemi,
    color: colors.textPrimary,
    fontSize: 16,
  },
  trackMeta: {
    fontFamily: fonts.ui,
    color: colors.textMuted,
    fontSize: 12,
  },
  addPl: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlLabel: {
    color: colors.accentAmber,
    fontFamily: fonts.uiSemi,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(196,92,110,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(196,92,110,0.12)',
  },
  deleteLabel: {
    color: colors.accentRose,
    fontFamily: fonts.uiSemi,
    fontSize: 18,
    lineHeight: 20,
    marginTop: -1,
  },
  reactRow: {
    flexDirection: 'row',
    gap: 8,
  },
  react: {
    fontSize: 14,
    color: colors.textMuted,
    opacity: 0.55,
  },
  reactOn: {
    color: colors.accentAmber,
    opacity: 1,
  },
});
