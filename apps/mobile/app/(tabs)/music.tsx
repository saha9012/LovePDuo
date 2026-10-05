import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { EmptyState } from '../../src/components/EmptyState';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp, TrackItem } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { juice } from '../../src/audio/juice';

export default function MusicScreen() {
  const insets = useSafeAreaInsets();
  const {
    tracks,
    addTrack,
    user,
    reactTrack,
    nowPlayingId,
    setNowPlaying,
    partnerNowPlaying,
    setPartnerNowPlaying,
  } = useApp();
  const [note, setNote] = useState('');
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      void sound?.unloadAsync();
    };
  }, [sound]);

  useEffect(() => {
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'game' && msg.gameId === 'now-playing') {
        const payload = msg.payload as { title?: string | null; from?: string } | undefined;
        if (payload?.title) {
          setPartnerNowPlaying(`${payload.from ?? 'Партнёр'}: ${payload.title}`);
        } else if (payload && payload.title === null) {
          setPartnerNowPlaying(null);
        }
      }
    });
    return () => {
      off();
    };
  }, [setPartnerNowPlaying]);

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
    setNote('Трек сохранён в библиотеке пары. Никуда не денется.');
  };

  const addSpotifyStub = () => {
    addTrack({
      title: 'Midnight Orbit (demo)',
      artist: 'Spotify metadata',
      sourceType: 'spotify',
      playbackMode: 'spotify',
      addedBy: user?.displayName ?? 'Ты',
    });
    setNote('Spotify: метаданные сохранены. Стрим — через Spotify (OAuth в Phase 3).');
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
    void juice.card();
  };

  return (
    <LpdBackground mood="warm">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 },
        ]}
      >
        <Text style={styles.kicker}>Music</Text>
        <Text style={typography.headline}>Полка пары</Text>
        <Text style={typography.body}>
          Музыка остаётся в LovePDuo. Upload — must. Spotify и VK — пробуем честно.
        </Text>

        {partnerNowPlaying ? (
          <Text style={styles.nowPlaying}>♪ {partnerNowPlaying}</Text>
        ) : null}

        <View style={styles.actions}>
          <LpdButton label="Загрузить трек" onPress={() => void upload()} />
          <LpdButton label="Добавить из Spotify (мета)" variant="ghost" onPress={addSpotifyStub} />
          <LpdButton label="Импорт VK (fallback)" variant="ghost" onPress={addVkStub} />
        </View>
        {note ? <Text style={styles.note}>{note}</Text> : null}

        <View style={styles.list}>
          {tracks.length === 0 ? (
            <EmptyState
              title="Пока тихо"
              body="Загрузите первый трек — он останется в комнате после перезахода. Это ваша полка, не список ссылок."
            />
          ) : (
            tracks.map((t) => (
              <View key={t.id} style={styles.row}>
                <Pressable
                  style={{ flex: 1, gap: 4 }}
                  onPress={() => void playTrack(t)}
                >
                  <Text style={styles.trackTitle}>
                    {nowPlayingId === t.id ? '▶ ' : ''}
                    {t.title}
                  </Text>
                  <Text style={styles.trackMeta}>
                    {t.artist} · {t.sourceType} · {t.playbackMode}
                  </Text>
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
                <Text style={styles.who}>{t.addedBy}</Text>
              </View>
            ))
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
  nowPlaying: {
    fontFamily: fonts.uiMedium,
    color: colors.accentRose,
    fontSize: 14,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  note: {
    fontFamily: fonts.ui,
    color: colors.accentRose,
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    marginTop: spacing.md,
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
  who: {
    fontFamily: fonts.uiMedium,
    color: colors.accentAmber,
    fontSize: 12,
  },
});
