import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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

  const [matchSeed, setMatchSeed] = useState(() => {
    const fromParam = Number(params.seed);
    if (Number.isFinite(fromParam) && fromParam > 0) return fromParam;
    const session = consumeMatchSession(GAME_ID);
    if (session) return session.seed;
    return Date.now() % 100000;
  });

  const [filter, setFilter] = useState<SparkFilter>('soft');
  const [index, setIndex] = useState(0);
  const [skips, setSkips] = useState(SKIP_LIMIT);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [turnMine, setTurnMine] = useState(true);

  const deck = useMemo(() => shuffleDeck(matchSeed, filter), [matchSeed, filter]);
  const card = deck[index % deck.length];
  const isHost = Boolean(user?.id && pair?.hostUserId && pair.hostUserId === user.id);
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const cardTilt = useSharedValue(0);

  const flipIn = () => {
    cardOpacity.value = 0.35;
    cardScale.value = 0.88;
    cardTilt.value = -4;
    cardOpacity.value = withTiming(1, { duration: 220 });
    cardScale.value = withSpring(1, { damping: 12, stiffness: 170 });
    cardTilt.value = withSequence(
      withTiming(3, { duration: 120 }),
      withSpring(0, { damping: 10 }),
    );
  };

  useEffect(() => {
    flipIn();
  }, [index, filter, matchSeed]);

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type !== 'game' || msg.gameId !== GAME_ID) return;
      const payload = msg.payload as {
        index?: number;
        filter?: SparkFilter;
        skips?: number;
        fromName?: string;
        fromId?: string;
        rematch?: boolean;
        seed?: number;
      } | undefined;
      if (!payload) return;
      setLive(true);
      if (payload.rematch && typeof payload.seed === 'number') {
        setMatchSeed(payload.seed);
        setIndex(0);
        setSkips(SKIP_LIMIT);
        setTurnMine(true);
        void juice.sync();
        return;
      }
      if (typeof payload.index === 'number') setIndex(payload.index);
      if (payload.filter === 'soft' || payload.filter === 'spicy') setFilter(payload.filter);
      if (typeof payload.skips === 'number') setSkips(payload.skips);
      if (payload.fromName) setPeerName(payload.fromName);
      if (payload.fromId && payload.fromId !== user.id) {
        setTurnMine(true);
      }
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
      fromId: user?.id,
      seed: matchSeed,
    });
  };

  const next = () => {
    const ni = index + 1;
    setIndex(ni);
    setTurnMine(false);
    broadcast(ni, filter, skips);
    void juice.card();
  };

  const skip = () => {
    if (skips <= 0) return;
    const ns = skips - 1;
    const ni = index + 1;
    setSkips(ns);
    setIndex(ni);
    setTurnMine(false);
    broadcast(ni, filter, ns);
    void juice.miss();
  };

  const changeFilter = (f: SparkFilter) => {
    setFilter(f);
    setIndex(0);
    setSkips(SKIP_LIMIT);
    setTurnMine(true);
    broadcast(0, f, SKIP_LIMIT);
    void juice.card();
  };

  const reshuffle = () => {
    const next = Math.floor(Math.random() * 100000);
    setMatchSeed(next);
    setIndex(0);
    setSkips(SKIP_LIMIT);
    setTurnMine(true);
    pairRealtime.sendGame(GAME_ID, {
      rematch: true,
      seed: next,
      index: 0,
      filter,
      skips: SKIP_LIMIT,
      fromName: user?.displayName,
      fromId: user?.id,
    });
    void juice.sync();
  };

  const progress = deck.length > 0 ? ((index % deck.length) + 1) / deck.length : 0;

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { scale: cardScale.value },
      { rotateZ: `${cardTilt.value}deg` },
    ],
  }));

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
          seed {matchSeed} · {live ? `live с ${peerName ?? 'партнёром'}` : params.solo === '1' ? 'solo' : 'ожидаем партнёра'}
          {isHost ? ' · host' : ''} · ход: {turnMine || params.solo === '1' ? 'твой' : 'партнёра'}
        </Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
        </View>

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

        <Animated.View style={[styles.card, cardStyle]}>
          <Text style={styles.kind}>{card.kind}</Text>
          <Text style={styles.text}>{card.text}</Text>
          <Text style={styles.meta}>
            Карточка {(index % deck.length) + 1}/{deck.length} · skip осталось {skips}
          </Text>
        </Animated.View>

        <View style={styles.actions}>
          <LpdButton
            label="Дальше (обоим)"
            onPress={next}
            disabled={!turnMine && params.solo !== '1' && live}
          />
          <LpdButton
            label="Skip"
            variant="ghost"
            disabled={skips <= 0 || (!turnMine && params.solo !== '1' && live)}
            onPress={skip}
          />
          {index > 0 && index % deck.length === 0 ? (
            <LpdButton label="Перетасовать колоду" variant="ghost" onPress={reshuffle} />
          ) : null}
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
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accentRose,
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
