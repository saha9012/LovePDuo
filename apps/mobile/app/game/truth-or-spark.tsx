import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { SparkFilter, sparksRu } from '../../src/content/sparks';
import { useApp } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { consumeMatchSession } from '../../src/realtime/matchSession';
import { juice } from '../../src/audio/juice';

const SKIP_LIMIT = 3;
const GAME_ID = 'truth-or-spark';

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleDeck(seed: number, filter: SparkFilter) {
  const base = sparksRu.filter((c) => c.filter === filter);
  const rand = mulberry32(seed + (filter === 'spicy' ? 99 : 7));
  const copy = [...base];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function TruthOrSparkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, pair } = useApp();
  const params = useLocalSearchParams<{ seed?: string; solo?: string }>();

  const seed = useMemo(() => {
    const fromParam = Number(params.seed);
    if (Number.isFinite(fromParam) && fromParam > 0) return fromParam;
    const session = consumeMatchSession(GAME_ID);
    if (session) return session.seed;
    return Date.now() % 100000;
  }, [params.seed]);

  const [filter, setFilter] = useState<SparkFilter>('soft');
  const [index, setIndex] = useState(0);
  const [skips, setSkips] = useState(SKIP_LIMIT);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  const deck = useMemo(() => shuffleDeck(seed, filter), [seed, filter]);
  const card = deck[index % deck.length];
  const isHost = Boolean(user?.id && pair?.hostUserId && pair.hostUserId === user.id);

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type !== 'game' || msg.gameId !== GAME_ID) return;
      const payload = msg.payload as {
        index?: number;
        filter?: SparkFilter;
        skips?: number;
        fromName?: string;
      } | undefined;
      if (!payload) return;
      setLive(true);
      if (typeof payload.index === 'number') setIndex(payload.index);
      if (payload.filter === 'soft' || payload.filter === 'spicy') setFilter(payload.filter);
      if (typeof payload.skips === 'number') setSkips(payload.skips);
      if (payload.fromName) setPeerName(payload.fromName);
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id]);

  const broadcast = (nextIndex: number, nextFilter: SparkFilter, nextSkips: number) => {
    pairRealtime.sendGame(GAME_ID, {
      index: nextIndex,
      filter: nextFilter,
      skips: nextSkips,
      fromName: user?.displayName,
      seed,
    });
  };

  const next = () => {
    const ni = index + 1;
    setIndex(ni);
    broadcast(ni, filter, skips);
    void juice.card();
  };

  const skip = () => {
    if (skips <= 0) return;
    const ns = skips - 1;
    const ni = index + 1;
    setSkips(ns);
    setIndex(ni);
    broadcast(ni, filter, ns);
    void juice.miss();
  };

  const changeFilter = (f: SparkFilter) => {
    setFilter(f);
    setIndex(0);
    setSkips(SKIP_LIMIT);
    broadcast(0, f, SKIP_LIMIT);
    void juice.card();
  };

  return (
    <LpdBackground mood={filter === 'spicy' ? 'warm' : 'night'}>
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.top}>
          <Text style={styles.title}>Truth Or Spark</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>Закрыть</Text>
          </Pressable>
        </View>

        <Text style={styles.syncMeta}>
          seed {seed} · {live ? `live с ${peerName ?? 'партнёром'}` : params.solo === '1' ? 'solo' : 'ожидаем партнёра'}
          {isHost ? ' · host' : ''}
        </Text>

        <View style={styles.filters}>
          {(['soft', 'spicy'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => changeFilter(f)}
              style={[styles.chip, filter === f && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, filter === f && styles.chipLabelActive]}>
                {f}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.kind}>{card.kind}</Text>
          <Text style={styles.text}>{card.text}</Text>
          <Text style={styles.meta}>
            Карточка {(index % deck.length) + 1}/{deck.length} · skip осталось {skips}
          </Text>
        </View>

        <View style={styles.actions}>
          <LpdButton label="Дальше (обоим)" onPress={next} />
          <LpdButton
            label="Skip"
            variant="ghost"
            disabled={skips <= 0}
            onPress={skip}
          />
        </View>
      </View>
    </LpdBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.uiSemi,
    color: colors.textPrimary,
    fontSize: 18,
  },
  back: {
    fontFamily: fonts.uiMedium,
    color: colors.accentAmber,
  },
  syncMeta: {
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.textMuted,
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
  chipActive: {
    borderColor: 'rgba(226,176,122,0.5)',
    backgroundColor: 'rgba(226,176,122,0.12)',
  },
  chipLabel: {
    fontFamily: fonts.uiMedium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  chipLabelActive: {
    color: colors.accentAmber,
  },
  card: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(227,154,160,0.25)',
    backgroundColor: 'rgba(36,28,49,0.72)',
    padding: spacing.xl,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  kind: {
    fontFamily: fonts.uiMedium,
    color: colors.accentRose,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontSize: 12,
  },
  text: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 36,
    color: colors.textPrimary,
  },
  meta: {
    fontFamily: fonts.ui,
    color: colors.textMuted,
    fontSize: 13,
  },
  actions: {
    gap: spacing.sm,
  },
});
