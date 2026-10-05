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
import { useApp } from '../../src/store/AppStore';

export default function MusicScreen() {
  const insets = useSafeAreaInsets();
  const { tracks, addTrack, user } = useApp();
  const [note, setNote] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      void sound?.unloadAsync();
    };
  }, [sound]);

  const playTrack = async (id: string, uri?: string, mode?: string) => {
    if (!uri || mode !== 'local') {
      setNote(
        mode === 'spotify'
          ? 'Стрим через Spotify — нужен OAuth / App Remote.'
          : 'Для этого трека пока только карточка/ссылка. Загрузите файл в LPD.',
      );
      return;
    }
    try {
      await sound?.unloadAsync();
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const next = new Audio.Sound();
      await next.loadAsync({ uri });
      await next.playAsync();
      setSound(next);
      setPlayingId(id);
      setNote('Сейчас играет внутри LovePDuo.');
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
              <Pressable
                key={t.id}
                style={styles.row}
                onPress={() => void playTrack(t.id, t.uri, t.playbackMode)}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.trackTitle}>
                    {playingId === t.id ? '▶ ' : ''}
                    {t.title}
                  </Text>
                  <Text style={styles.trackMeta}>
                    {t.artist} · {t.sourceType} · {t.playbackMode}
                  </Text>
                </View>
                <Text style={styles.who}>{t.addedBy}</Text>
              </Pressable>
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
  empty: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.sm,
    backgroundColor: 'rgba(36,28,49,0.45)',
  },
  emptyTitle: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  who: {
    fontFamily: fonts.uiMedium,
    color: colors.accentAmber,
    fontSize: 12,
  },
});
