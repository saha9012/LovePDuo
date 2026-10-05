import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { useApp, TrackItem } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { juice } from '../../src/audio/juice';
import { track as trackEvent } from '../../src/analytics/track';
import { spotifyConfigured, spotifyStatusLabel } from '../../src/music/spotifyConfig';

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
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    setMood,
  } = useApp();
  const [note, setNote] = useState('');
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

  const showNote = (text: string, ms = 1800) => {
    noteRef.current = text;
    setNote(text);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      noteRef.current = '';
      setNote('');
    }, ms);
  };

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
    if (!partnerNowPlaying) return;
    peerPulse.value = withSequence(
      withTiming(1.04, { duration: 160 }),
      withTiming(1, { duration: 280 }),
    );
    void juice.card();
  }, [partnerNowPlaying, peerPulse]);

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
          noteRef.current === 'Оба снова на Music';
        showNote(racing ? 'Оба снова на Music' : 'Партнёр снова на связи');
        void juice.sync();
        if (user?.id) {
          lastHelloAt.current = Date.now();
          pairRealtime.sendGame('music-hello', {
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
        const match = tracks.find(
          (t) =>
            t.title === payload.title &&
            (payload.artist ? t.artist === payload.artist : true),
        );
        if (match) {
          const pl = playlists.find((p) => p.id === payload.playlistId);
          const alreadyIn = Boolean(pl?.trackIds.includes(match.id));
          if (!alreadyIn) addTrackToPlaylist(payload.playlistId, match.id);
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
        } else {
          showNote(
            `${payload.from ?? 'Партнёр'} положил «${payload.title}» — добавь тот же трек`,
            2400,
          );
          void juice.miss();
        }
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
    });
    return () => {
      off();
    };
  }, [setPartnerNowPlaying, setActivePlaylist, setMood, reactTrackMeta, removeTrackMeta, removeTrackFromPlaylist, clearTracks, playlists, tracks, user?.id, addTrack, addTrackToPlaylist, activePlaylistId, nowPlayingId, partnerNowPlaying]);

  useEffect(() => {
    if (!pair || !user) return;
    lastHelloAt.current = Date.now();
    pairRealtime.sendGame('music-hello', {
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
        pairRealtime.sendGame('now-playing', {
          title: null,
          from: user?.displayName,
        });
        showNote('Трек доиграл.');
        void juice.miss();
      });
      await next.playAsync();
      setSound(next);
      setNowPlaying(track.id);
      pairRealtime.sendGame('now-playing', {
        title: track.title,
        from: user?.displayName,
      });
      showNote('Сейчас играет внутри LovePDuo. Партнёр видит Now Playing.');
      void juice.hit();
    } catch {
      showNote('Не удалось воспроизвести файл. Попробуйте другой формат (mp3/m4a).', 2800);
    }
  };
  playTrackRef.current = playTrack;

  const clearLibrary = () => {
    if (tracks.length === 0) return;
    Alert.alert(
      'Очистить библиотеку?',
      `Удалить все ${tracks.length} трек(ов) у тебя и у партнёра? Полки тоже опустеют.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await sound?.stopAsync();
                await sound?.unloadAsync();
              } catch {
                /* ignore */
              }
              setSound(null);
              setNowPlaying(null);
              setProgress(null);
              setPartnerNowPlaying(null);
              lastStopAt.current = Date.now();
              clearTracks();
              pairRealtime.sendGame('now-playing', {
                title: null,
                from: user?.displayName,
              });
              pairRealtime.sendGame('track-clear', {
                from: user?.displayName,
                fromId: user?.id,
              });
              showNote('Библиотека очищена.');
              void juice.miss();
              trackEvent('track_removed', { source: 'clear_all' });
            })();
          },
        },
      ],
    );
  };

  const deleteTrack = (track: TrackItem) => {
    Alert.alert(
      'Удалить трек?',
      `«${track.title}» — ${track.artist}\nУйдёт из комнаты и со всех полок.`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (nowPlayingId === track.id) {
                try {
                  await sound?.stopAsync();
                  await sound?.unloadAsync();
                } catch {
                  /* ignore */
                }
                setSound(null);
                setNowPlaying(null);
                setProgress(null);
                lastStopAt.current = Date.now();
                pairRealtime.sendGame('now-playing', {
                  title: null,
                  from: user?.displayName,
                });
              }
              removeTrack(track.id);
              pairRealtime.sendGame('track-remove', {
                title: track.title,
                artist: track.artist,
                from: user?.displayName,
                fromId: user?.id,
              });
              showNote(`Удалили «${track.title}»`);
              void juice.miss();
              trackEvent('track_removed', { source: track.sourceType });
            })();
          },
        },
      ],
    );
  };

  const shelfRemove = (track: TrackItem) => {
    if (!active || !active.trackIds.includes(track.id)) return;
    removeTrackFromPlaylist(active.id, track.id);
    pairRealtime.sendGame('playlist-remove', {
      playlistId: active.id,
      title: track.title,
      artist: track.artist,
      from: user?.displayName,
      fromId: user?.id,
    });
    showNote(`Убрали из «${active.name}»`);
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
    pairRealtime.sendGame('track-meta', {
      title,
      artist,
      sourceType: 'upload',
      from: user?.displayName,
      fromId: user?.id,
    });
    trackEvent('track_uploaded', { source: 'upload' });
    showNote('Трек сохранён. Партнёр видит карточку (файл — локально у тебя).');
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
    pairRealtime.sendGame('track-meta', {
      title,
      artist,
      sourceType: 'spotify',
      from: user?.displayName,
      fromId: user?.id,
    });
    showNote(
      spotifyConfigured()
        ? 'Spotify: метаданные сохранены и отправлены партнёру. Стрим — OAuth / App Remote.'
        : `${spotifyStatusLabel()} · stub ушёл партнёру.`,
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
    pairRealtime.sendGame('track-meta', {
      title,
      artist,
      sourceType: 'vk',
      from: user?.displayName,
      fromId: user?.id,
    });
    showNote('VK: metadata + fallback. Stub ушёл партнёру.');
    void juice.card();
  };

  const react = (id: string, reaction: NonNullable<TrackItem['reaction']>) => {
    reactTrack(id, reaction);
    const t = tracks.find((x) => x.id === id);
    if (t) {
      lastReactChoice.current = `${t.title}|${reaction}`;
      lastReactMatchAt.current = Date.now();
      pairRealtime.sendGame('track-react', {
        title: t.title,
        artist: t.artist,
        reaction,
        from: user?.displayName,
      });
    }
    void juice.card();
  };

  const selectPlaylist = (id: string, mood: 'night' | 'warm' | 'rain' | 'pulse') => {
    setActivePlaylist(id);
    if (mood !== 'pulse') setMood(mood);
    pairRealtime.sendGame('playlist', { playlistId: id, mood });
    void juice.card();
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
          Музыка остаётся в LovePDuo. Плейлисты-настроения — ваша полка, не список ссылок.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moods}>
          {playlists.map((pl) => (
            <Pressable
              key={pl.id}
              onPress={() => selectPlaylist(pl.id, pl.mood)}
              style={[styles.moodChip, activePlaylistId === pl.id && styles.moodActive]}
            >
              <Text style={[styles.moodLabel, activePlaylistId === pl.id && styles.moodLabelOn]}>
                {pl.name}
              </Text>
              <Text style={styles.moodCount}>{pl.trackIds.length}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {partnerNowPlaying ? (
          <Animated.Text style={[styles.nowPlaying, peerStyle]}>
            ♪ {partnerNowPlaying}
          </Animated.Text>
        ) : null}
        {active && active.trackIds.length === 0 && tracks.length > 0 ? (
          <Text style={styles.playlistHint}>
            «{active.name}» пуст — жми + у трека, чтобы положить на полку. Повторный тап по ✓ убирает с полки; × удаляет трек.
          </Text>
        ) : null}
        {nowPlayingId ? (
          <View style={styles.playbackRow}>
            {progress && progress.dur > 0 ? (
              <View style={styles.progressBlock}>
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
                <Text style={styles.progressTime}>
                  {formatMs(progress.pos)} / {formatMs(progress.dur)}
                </Text>
              </View>
            ) : null}
            <LpdButton
              label="Предыдущий"
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
            <LpdButton
              label="Стоп"
              variant="ghost"
              onPress={async () => {
                await sound?.stopAsync();
                await sound?.unloadAsync();
                setSound(null);
                setNowPlaying(null);
                setProgress(null);
                lastStopAt.current = Date.now();
                pairRealtime.sendGame('now-playing', { title: null, from: user?.displayName });
                showNote('Остановили — партнёр видит.');
                void juice.miss();
              }}
            />
            <LpdButton
              label="Следующий"
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
        ) : null}

        <View style={styles.actions}>
          <LpdButton label="Загрузить трек" onPress={() => void upload()} />
          <LpdButton label="Добавить из Spotify (мета)" variant="ghost" onPress={addSpotifyStub} />
          <LpdButton label="Импорт VK (fallback)" variant="ghost" onPress={addVkStub} />
          {tracks.length > 0 ? (
            <LpdButton label="Очистить библиотеку" variant="ghost" onPress={clearLibrary} />
          ) : null}
        </View>
        <Text style={styles.spotifyHint}>{spotifyStatusLabel()}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}

        <View style={styles.list}>
          {tracks.length === 0 ? (
            <EmptyState
              title="Пока тихо"
              body="Загрузите первый трек — он останется в комнате после перезахода. Удалить можно крестиком у карточки."
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
                      pairRealtime.sendGame('playlist-add', {
                        playlistId: active.id,
                        title: t.title,
                        artist: t.artist,
                        from: user?.displayName,
                      });
                      showNote(`В «${active.name}» — полка у обоих.`);
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
                  <Pressable
                    onPress={() => deleteTrack(t)}
                    style={styles.deleteBtn}
                    accessibilityLabel={`Удалить ${t.title}`}
                    hitSlop={8}
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
  playbackRow: {
    gap: spacing.sm,
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
    width: 28,
    height: 28,
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
