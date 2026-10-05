import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { PostMatchCard } from '../../src/components/PostMatchCard';
import { colors, fonts, spacing } from '../../src/theme/tokens';
import {
  buildHeartbeatChart,
  heartbeatConfig,
  judgeTap,
  judgementScore,
  BeatJudgement,
} from '../../src/games/heartbeat';
import { pickPostMatchLine } from '../../src/content/postMatch';
import { useApp } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { consumeMatchSession } from '../../src/realtime/matchSession';
import { juice } from '../../src/audio/juice';
import { useMemories } from '../../src/store/MemoriesStore';

type Phase = 'ready' | 'playing' | 'finished';

export default function HeartbeatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, pair } = useApp();
  const { addMemory } = useMemories();
  const params = useLocalSearchParams<{ seed?: string; startAt?: string; solo?: string }>();

  const initialSeed = useMemo(() => {
    const fromParam = Number(params.seed);
    if (Number.isFinite(fromParam) && fromParam > 0) return fromParam;
    const session = consumeMatchSession('heartbeat');
    if (session) return session.seed;
    return 3;
  }, [params.seed]);

  const [matchSeed, setMatchSeed] = useState(initialSeed);
  const chart = useMemo(() => buildHeartbeatChart(matchSeed), [matchSeed]);
  const [phase, setPhase] = useState<Phase>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState(0);
  const [syncBonus, setSyncBonus] = useState(0);
  const [last, setLast] = useState<BeatJudgement | null>(null);
  const [partnerScore, setPartnerScore] = useState(0);
  const [partnerLive, setPartnerLive] = useState(false);
  const startAt = useRef(0);
  const cursor = useRef(0);
  const scoreRef = useRef(0);
  const syncRef = useRef(0);
  const partnerLiveRef = useRef(false);
  const lastPartnerTapMs = useRef<number | null>(null);
  const seedRef = useRef(initialSeed);
  const startRef = useRef<() => void>(() => undefined);
  const padScale = useSharedValue(1);
  const syncGlow = useSharedValue(0);
  const partnerScale = useSharedValue(1);
  const [partnerFlash, setPartnerFlash] = useState(false);

  useEffect(() => {
    seedRef.current = matchSeed;
  }, [matchSeed]);

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type !== 'game' || msg.gameId !== 'heartbeat') return;
      const payload = msg.payload as {
        total?: number;
        tapAt?: number;
        phase?: string;
        rematch?: boolean;
        seed?: number;
        miss?: boolean;
        judgement?: BeatJudgement;
      } | undefined;
      if (payload?.rematch && typeof payload.seed === 'number') {
        setMatchSeed(payload.seed);
        seedRef.current = payload.seed;
        // delay start until chart memo updates
        setTimeout(() => startRef.current(), 0);
        return;
      }
      if (payload?.miss) {
        setLast('miss');
        setPartnerFlash(true);
        partnerScale.value = withSequence(
          withSpring(0.94, { damping: 10 }),
          withTiming(1, { duration: 200 }),
        );
        setTimeout(() => setPartnerFlash(false), 400);
        void juice.miss();
        return;
      }
      if (typeof payload?.total === 'number') {
        setPartnerScore(payload.total);
        setPartnerLive(true);
        partnerLiveRef.current = true;
        setPartnerFlash(true);
        if (payload.judgement === 'perfect' || payload.judgement === 'great') {
          setLast(payload.judgement);
        }
        partnerScale.value = withSequence(
          withSpring(1.12, { damping: 10 }),
          withTiming(1, { duration: 200 }),
        );
        setTimeout(() => setPartnerFlash(false), 400);
      }
      if (typeof payload?.tapAt === 'number') {
        lastPartnerTapMs.current = payload.tapAt;
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id, partnerScale]);

  const start = () => {
    setPhase('playing');
    setElapsed(0);
    setScore(0);
    setSyncBonus(0);
    setLast(null);
    cursor.current = 0;
    scoreRef.current = 0;
    syncRef.current = 0;
    partnerLiveRef.current = false;
    setPartnerLive(false);
    lastPartnerTapMs.current = null;
    startAt.current = Date.now();
    pairRealtime.sendGame('heartbeat', { phase: 'start', total: 0, seed: seedRef.current });
    void juice.beat();
  };

  startRef.current = start;

  const rematch = () => {
    const next = Math.floor(Math.random() * 100000);
    setMatchSeed(next);
    seedRef.current = next;
    pairRealtime.sendGame('heartbeat', { rematch: true, seed: next });
    setTimeout(() => startRef.current(), 0);
  };

  useEffect(() => {
    if (params.solo === '1') return;
    const at = Number(params.startAt);
    if (!Number.isFinite(at)) return;
    const delay = Math.max(0, at - Date.now());
    const id = setTimeout(() => startRef.current(), delay);
    return () => clearTimeout(id);
  }, [params.startAt, params.solo]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => {
      const t = Date.now() - startAt.current;
      setElapsed(t);
      while (
        cursor.current < chart.length &&
        chart[cursor.current].atMs < t - heartbeatConfig.windowGreatMs
      ) {
        cursor.current += 1;
        setLast('miss');
      }
      if (t >= heartbeatConfig.durationMs) {
        clearInterval(id);
        const total = scoreRef.current + syncRef.current;
        pairRealtime.sendGame('heartbeat', { phase: 'finished', total });
        if (!partnerLiveRef.current) {
          const partner = Math.max(
            0,
            Math.round(total * (0.8 + Math.random() * 0.35)),
          );
          setPartnerScore(partner);
        }
        setPhase('finished');
        void juice.postMatch();
        addMemory({
          kind: 'heartbeat',
          title: 'Heartbeat Tap',
          detail: `Итог ${total} · sync +${syncRef.current}`,
        });
      } else if (Math.floor(t / 1000) % 4 === 0) {
        pairRealtime.sendGame('heartbeat', {
          phase: 'playing',
          total: scoreRef.current + syncRef.current,
        });
      }
    }, 32);
    return () => clearInterval(id);
  }, [phase, chart]);

  const onTap = () => {
    if (phase !== 'playing') return;
    padScale.value = withSequence(
      withTiming(0.92, { duration: 50 }),
      withSpring(1, { damping: 12, stiffness: 240 }),
    );
    const t = Date.now() - startAt.current;
    const note = chart[cursor.current];
    if (!note) return;
    const delta = t - note.atMs;
    if (Math.abs(delta) > heartbeatConfig.windowGreatMs + 40) {
      setLast('miss');
      void juice.miss();
      pairRealtime.sendGame('heartbeat', { miss: true, judgement: 'miss' });
      return;
    }
    const j = judgeTap(delta);
    const pts = judgementScore(j);
    scoreRef.current += pts;
    setScore(scoreRef.current);
    setLast(j);
    cursor.current += 1;
    pairRealtime.sendGame('heartbeat', {
      tapAt: t,
      total: scoreRef.current + syncRef.current,
      judgement: j,
    });

    const partnerTap = lastPartnerTapMs.current;
    const realSync =
      partnerTap != null && Math.abs(partnerTap - t) <= 120 && j !== 'miss';
    const demoSync =
      !partnerLiveRef.current &&
      j !== 'miss' &&
      Math.abs(delta) < 90 &&
      Math.random() > 0.35;

    if (realSync || demoSync) {
      syncRef.current += 40;
      setSyncBonus(syncRef.current);
      syncGlow.value = withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(0, { duration: 420 }),
      );
      void juice.sync();
    } else if (j === 'perfect') {
      void juice.perfect();
    } else {
      void juice.hit();
    }
  };

  const total = score + syncBonus;
  const line = pickPostMatchLine(total, partnerScore, matchSeed + (elapsed || 1));
  const beatPulse = Math.sin((elapsed / (60000 / heartbeatConfig.bpm)) * Math.PI * 2);
  const padStyle = useAnimatedStyle(() => ({
    transform: [{ scale: padScale.value }],
  }));
  const syncStyle = useAnimatedStyle(() => ({
    opacity: syncGlow.value * 0.45,
  }));
  const partnerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: partnerScale.value }],
  }));

  if (phase === 'finished') {
    return (
      <LpdBackground mood="warm">
        <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.title}>Heartbeat Tap</Text>
          <Text style={styles.meta}>
            Ты {total} · Партнёр {partnerScore} · sync +{syncBonus}
            {partnerLive ? ' · live' : ' · demo'}
          </Text>
          <PostMatchCard
            title={total >= partnerScore ? 'Ритм твой' : 'Партнёр чувствует лучше'}
            gameId="heartbeat"
            line={line.text}
            onRematch={rematch}
            onHome={() => router.replace({ pathname: '/game/lobby', params: { game: 'heartbeat' } })}
          />
        </View>
      </LpdBackground>
    );
  }

  return (
    <LpdBackground mood="rain">
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.title}>Heartbeat Tap · seed {matchSeed}</Text>
        {phase === 'ready' ? (
          <View style={styles.ready}>
            <Text style={styles.readyTitle}>Чувствуй бит вдвоём</Text>
            <Text style={styles.body}>
              Тапай в ритм. Perfect / Great / Miss. Sync bonus, если почти одновременно с партнёром.
            </Text>
            <Pressable onPress={start} style={styles.btn}>
              <Text style={styles.btnLabel}>Старт</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.hud}>
              <Text style={styles.stat}>Очки {score}</Text>
              <Text style={styles.stat}>Sync +{syncBonus}</Text>
              <Animated.Text
                style={[styles.stat, partnerFlash && styles.partnerHot, partnerStyle]}
              >
                партнёр {partnerScore}
                {partnerLive ? ' ·live' : ''}
              </Animated.Text>
              <Text style={styles.stat}>
                {Math.max(0, Math.ceil((heartbeatConfig.durationMs - elapsed) / 1000))}s
              </Text>
            </View>
            <View style={styles.stage}>
              <Animated.View style={[styles.syncFlash, syncStyle]} />
              <View
                style={[
                  styles.ring,
                  {
                    transform: [{ scale: 1 + beatPulse * 0.08 }],
                    borderColor:
                      last === 'perfect'
                        ? colors.success
                        : last === 'great'
                          ? colors.accentAmber
                          : last === 'miss'
                            ? colors.danger
                            : colors.accentRose,
                  },
                ]}
              />
              <Text style={styles.judgement}>{last?.toUpperCase() ?? 'TAP'}</Text>
            </View>
            <Animated.View style={padStyle}>
              <Pressable onPress={onTap} style={styles.pad}>
                <Text style={styles.padLabel}>TAP</Text>
              </Pressable>
            </Animated.View>
          </>
        )}
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
  title: {
    fontFamily: fonts.uiSemi,
    color: colors.textPrimary,
    fontSize: 18,
  },
  ready: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  readyTitle: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fonts.ui,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  btn: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: colors.accentWine,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.35)',
  },
  btnLabel: {
    fontFamily: fonts.uiSemi,
    color: colors.textPrimary,
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    fontFamily: fonts.uiMedium,
    color: colors.textSecondary,
  },
  partnerHot: {
    color: colors.accentRose,
    fontFamily: fonts.uiSemi,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncFlash: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.accentMist,
  },
  ring: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
  },
  judgement: {
    position: 'absolute',
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.textPrimary,
  },
  pad: {
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: 'rgba(227,154,160,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(227,154,160,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  padLabel: {
    fontFamily: fonts.uiSemi,
    letterSpacing: 3,
    color: colors.accentRose,
    fontSize: 18,
  },
  meta: {
    fontFamily: fonts.ui,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
});
