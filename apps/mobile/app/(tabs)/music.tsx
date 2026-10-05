import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
    setMood,
  } = useApp();
  const [note, setNote] = useState('');
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const peerPulse = useSharedValue(1);

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
      if (msg.type === 'game' && msg.gameId === 'music-hello') {
        const payload = msg.payload as { from?: string; fromId?: string } | undefined;
        if (payload?.fromId && payload.fromId === user?.id) return;
        setNote(`${payload?.from ?? 'Партнёр'} на Music`);
        void juice.hit();
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'now-playing') {
        const payload = msg.payload as { title?: string | null; from?: string } | undefined;
        if (payload?.title) {
          setPartnerNowPlaying(`${payload.from ?? 'Партнёр'}: ${payload.title}`);
          void juice.hit();
        } else if (payload && payload.title === null) {
          setPartnerNowPlaying(null);
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
        reactTrackMeta(payload.title, payload.artist ?? '', payload.reaction);
        setNote(`${payload.from ?? 'Партнёр'} отметил «${payload.title}»`);
        void juice.card();
      }
      if (msg.type === 'game' && msg.gameId === 'playlist') {
        const payload = msg.payload as {
          playlistId?: string;
          mood?: 'night' | 'warm' | 'rain' | 'pulse';
        } | undefined;
        if (payload?.playlistId) {
          setActivePlaylist(payload.playlistId);
          if (payload.mood && payload.mood !== 'pulse') setMood(payload.mood);
          const name = playlists.find((p) => p.id === payload.playlistId)?.name;
          setNote(name ? `Партнёр переключил «${name}»` : 'Партнёр сменил плейлист');
          void juice.hit();
        }
      }
    });
    return () => {
      off();
    };
  }, [setPartnerNowPlaying, setActivePlaylist, setMood, reactTrackMeta, playlists, user?.id]);

  useEffect(() => {
    if (!pair || !user) return;
    pairRealtime.sendGame('music-hello', {
      from: user.displayName,
      fromId: user.id,
    });
  }, [pair?.code, user?.id, user?.displayName]);

  const playTrack = async (track: TrackItem) => {
    if (!track.uri || track.playbackMode !== 'local') {
      setNote(
        track.playbackMode === 'spotify'
          ? 'Стрим через Spotify — нужен OAuth / App Remote.'
          : 'Для этого трека пока только карточка/ссылка. Загрузите файл в LPD.',
      );
      return;
    }
    try {
      await sound?.unloadAsync();
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const next = new Audio.Sound();
      await next.loadAsync({ uri: track.uri });
      await next.playAsync();
      setSound(next);
      setNowPlaying(track.id);
      pairRealtime.sendGame('now-playing', {
        title: track.title,
        from: user?.displayName,
      });
      setNote('Сейчас играет внутри LovePDuo. Партнёр видит Now Playing.');
      void juice.hit();
    } catch {
      setNote('Не удалось воспроизвести файл. Попробуйте другой формат (mp3/m4a).');
    }
  };

  const upload = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/mpeg', 'audio/mp4', 'audio/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    addTrack({
      title: asset.name.replace(/\.[^.]+$/, ''),
      artist: 'Загружено в LPD',
      sourceType: 'upload',
      playbackMode: 'local',
      addedBy: user?.displayName ?? 'Ты',
      uri: asset.uri,
    });
    trackEvent('track_uploaded', { source: 'upload' });
    setNote('Трек сохранён в библиотеке пары. Никуда не денется.');
    void juice.sync();
  };
  const addSpotifyStub = () => {
    addTrack({
      title: 'Midnight Orbit (demo)',
      artist: 'Spotify metadata',
      sourceType: 'spotify',
      playbackMode: 'spotify',
      addedBy: user?.displayName ?? 'Ты',
    });
    setNote(
      spotifyConfigured()
        ? 'Spotify: метаданные сохранены. Keys есть — стрим через App Remote / OAuth следующий шаг.'
        : spotifyStatusLabel(),
    );
  };

  const addVkStub = () => {
    addTrack({
      title: 'Dusty Rose Night (demo)',
      artist: 'VK link fallback',
      sourceType: 'vk',
      playbackMode: 'link',
      addedBy: user?.displayName ?? 'Ты',
    });
    setNote('VK: официальный audio pull ограничен — сохранены metadata + fallback upload.');
  };

  const react = (id: string, reaction: NonNullable<TrackItem['reaction']>) => {
    reactTrack(id, reaction);
    const t = tracks.find((x) => x.id === id);
    if (t) {
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
            «{active.name}» пуст — жми + у трека, чтобы положить на полку настроения.
          </Text>
        ) : null}
        {nowPlayingId ? (
          <LpdButton
            label="Стоп"
            variant="ghost"
            onPress={async () => {
              await sound?.stopAsync();
              await sound?.unloadAsync();
              setSound(null);
              setNowPlaying(null);
              pairRealtime.sendGame('now-playing', { title: null, from: user?.displayName });
            }}
          />
        ) : null}

        <View style={styles.actions}>
          <LpdButton label="Загрузить трек" onPress={() => void upload()} />
          <LpdButton label="Добавить из Spotify (мета)" variant="ghost" onPress={addSpotifyStub} />
          <LpdButton label="Импорт VK (fallback)" variant="ghost" onPress={addVkStub} />
        </View>
        <Text style={styles.spotifyHint}>{spotifyStatusLabel()}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}

        <View style={styles.list}>
          {tracks.length === 0 ? (
            <EmptyState
              title="Пока тихо"
              body="Загрузите первый трек — он останется в комнате после перезахода."
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
                      if (active) {
                        addTrackToPlaylist(active.id, t.id);
                        setNote(`В «${active.name}».`);
                        void juice.hit();
                      }
                    }}
                    style={styles.addPl}
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
