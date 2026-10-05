import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { GameTile } from '../../src/components/GameTile';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { juice } from '../../src/audio/juice';

type GameTag = 'mvp' | 'new';
type Filter = 'all' | GameTag;
type Cover = 'sky' | 'heartbeat' | 'spark' | 'draw' | 'orbit' | 'duel' | 'veil';

const FILTER_KEY = 'lovepduo.play_filter';

type CatalogItem = {
  id: string;
  title: string;
  subtitle: string;
  accent: 'rose' | 'amber' | 'mist';
  cover: Cover;
  badge: string;
  tag: GameTag;
  game: string;
};

const CATALOG: CatalogItem[] = [
  {
    id: 'sky',
    title: 'Sky Claim',
    subtitle: 'Лови огни с неба на своём поле. Комбо, обманки, реванш.',
    accent: 'amber',
    cover: 'sky',
    badge: 'MVP',
    tag: 'mvp',
    game: 'sky-claim',
  },
  {
    id: 'hb',
    title: 'Heartbeat Tap',
    subtitle: 'Общий бит. Личная точность + sync bonus.',
    accent: 'rose',
    cover: 'heartbeat',
    badge: 'MVP',
    tag: 'mvp',
    game: 'heartbeat',
  },
  {
    id: 'tos',
    title: 'Truth Or Spark',
    subtitle: 'Вопросы, задания и искры. Soft / spicy, без ваты.',
    accent: 'mist',
    cover: 'spark',
    badge: 'MVP',
    tag: 'mvp',
    game: 'truth-or-spark',
  },
  {
    id: 'draw',
    title: 'Signal Draw',
    subtitle: 'Общий холст. Янтарь и роза рисуют сигнал вместе.',
    accent: 'amber',
    cover: 'draw',
    badge: 'NEW',
    tag: 'new',
    game: 'signal-draw',
  },
  {
    id: 'orbit',
    title: 'Orbit Catch',
    subtitle: 'Co-op орбита. Ловите совпадение маркера и орба.',
    accent: 'mist',
    cover: 'orbit',
    badge: 'NEW',
    tag: 'new',
    game: 'orbit-catch',
  },
  {
    id: 'duel',
    title: 'Soft Duel',
    subtitle: 'Реакция на вспышку слова. Perfect / рано / реванш.',
    accent: 'rose',
    cover: 'duel',
    badge: 'NEW',
    tag: 'new',
    game: 'soft-duel',
  },
  {
    id: 'veil',
    title: 'Word Veil',
    subtitle: 'Ассоциации на одно слово. Сравниваем совпадение.',
    accent: 'mist',
    cover: 'veil',
    badge: 'NEW',
    tag: 'new',
    game: 'word-veil',
  },
];

export default function PlayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    void AsyncStorage.getItem(FILTER_KEY).then((raw) => {
      if (raw === 'all' || raw === 'mvp' || raw === 'new') setFilter(raw);
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(FILTER_KEY, filter);
  }, [filter]);

  const games = useMemo(() => {
    const query = q.trim().toLowerCase();
    return CATALOG.filter((g) => {
      if (filter !== 'all' && g.tag !== filter) return false;
      if (!query) return true;
      return (
        g.title.toLowerCase().includes(query) ||
        g.subtitle.toLowerCase().includes(query)
      );
    });
  }, [filter, q]);

  return (
    <LpdBackground mood="night">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.kicker}>Play</Text>
        <Text style={typography.headline}>Миниигры для двоих</Text>
        <Text style={[typography.body, styles.sub]}>
          MVP + расширения. Два телефона. Живой post-match.
        </Text>

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Найти игру…"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
        />

        <View style={styles.filters}>
          {([
            ['all', 'Все'],
            ['mvp', 'MVP'],
            ['new', 'New'],
          ] as const).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => {
                setFilter(id);
                void juice.hit();
              }}
              style={[styles.chip, filter === id && styles.chipOn]}
            >
              <Text style={[styles.chipLabel, filter === id && styles.chipLabelOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.list}>
          {games.length === 0 ? (
            <Text style={styles.empty}>Ничего не нашлось. Сбрось фильтр.</Text>
          ) : (
            games.map((g) => (
              <GameTile
                key={g.id}
                title={g.title}
                subtitle={g.subtitle}
                accent={g.accent}
                cover={g.cover}
                badge={g.badge}
                onPress={() =>
                  router.push({ pathname: '/game/lobby', params: { game: g.game } })
                }
              />
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
    color: colors.accentRose,
    fontSize: 12,
  },
  sub: {
    marginBottom: spacing.sm,
  },
  search: {
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontFamily: fonts.ui,
    fontSize: 15,
    backgroundColor: 'rgba(36,28,49,0.55)',
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: {
    borderColor: 'rgba(226,176,122,0.5)',
    backgroundColor: 'rgba(226,176,122,0.12)',
  },
  chipLabel: {
    fontFamily: fonts.uiMedium,
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  chipLabelOn: {
    color: colors.accentAmber,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  empty: {
    fontFamily: fonts.ui,
    color: colors.textMuted,
    fontSize: 14,
  },
});
