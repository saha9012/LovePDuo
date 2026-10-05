import React, { useEffect, useRef, useState } from 'react';
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
import { pickPostMatchLine } from '../../src/content/postMatch';
import { useApp } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { juice } from '../../src/audio/juice';
import { useMemories } from '../../src/store/MemoriesStore';

const ROUNDS = 8;
const PROMPTS = ['Жар', 'Тише', 'Ближе', 'Смелей', 'Стоп', 'Ещё', 'Сейчас', 'Вдвоём'];

type Phase = 'ready' | 'playing' | 'finished';

export default function SoftDuelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, pair } = useApp();
  const { addMemory } = useMemories();
  const params = useLocalSearchParams<{ seed?: string; startAt?: string; solo?: string }>();
  const seed = Number(params.seed) || Date.now() % 100000;

  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(0);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [myScore, setMyScore] = useState(0);
  const [partnerScore, setPartnerScore] = useState(0);
  const [partnerLive, setPartnerLive] = useState(false);
  const [flash, setFlash] = useState('');
  const [armed, setArmed] = useState(false);
  const myScoreRef = useRef(0);
  const partnerLiveRef = useRef(false);
  const roundRef = useRef(0);
  const startRef = useRef<() => void>(() => undefined);
  const armAt = useRef(0);
  const padScale = useSharedValue(1);
  const flashScale = useSharedValue(1);

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type !== 'game' || msg.gameId !== 'soft-duel') return;
      const payload = msg.payload as { score?: number; tap?: number } | undefined;
      if (typeof payload?.score === 'number') {
        setPartnerScore(payload.score);
        setPartnerLive(true);
        partnerLiveRef.current = true;
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id]);

  const nextRound = (r: number) => {
    if (r >= ROUNDS) {
      setPhase('finished');
      void juice.postMatch();
      addMemory({
        kind: 'spark',
        title: 'Soft Duel',
        detail: `Ты ${myScoreRef.current} · Партнёр ${partnerLiveRef.current ? 'live' : 'demo'}`,
      });
      if (!partnerLiveRef.current) {
        setPartnerScore(Math.round(myScoreRef.current * (0.75 + Math.random() * 0.4)));
      }
      return;
    }
    roundRef.current = r;
    setRound(r);
    setPrompt(PROMPTS[(seed + r) % PROMPTS.length]);
    setArmed(false);
    const wait = 600 + ((seed + r * 97) % 900);
    armAt.current = Date.now() + wait;
    setFlash('Жди…');
    flashScale.value = withTiming(0.92, { duration: 120 });
    setTimeout(() => {
      setFlash('ЖМИ');
      setArmed(true);
      flashScale.value = withSpring(1.12, { damping: 8, stiffness: 200 });
      void juice.beat();
    }, wait);
  };

  const start = () => {
    myScoreRef.current = 0;
    setMyScore(0);
    setPartnerScore(0);
    partnerLiveRef.current = false;
    setPartnerLive(false);
    setPhase('playing');
    pairRealtime.sendGame('soft-duel', { phase: 'start', seed });
    nextRound(0);
  };
  startRef.current = start;

  useEffect(() => {
    if (params.solo === '1') return;
    const at = Number(params.startAt);
    if (!Number.isFinite(at)) return;
    const id = setTimeout(() => startRef.current(), Math.max(0, at - Date.now()));
    return () => clearTimeout(id);
  }, [params.startAt, params.solo]);

  const onTap = () => {
    if (phase !== 'playing') return;
    const now = Date.now();
    padScale.value = withSequence(
      withTiming(0.94, { duration: 60 }),
      withSpring(1, { damping: 12, stiffness: 220 }),
    );
    if (now < armAt.current) {
      setFlash('Рано');
      setArmed(false);
      void juice.miss();
      myScoreRef.current = Math.max(0, myScoreRef.current - 1);
      setMyScore(myScoreRef.current);
      return;
    }
    const delta = now - armAt.current;
    const pts = delta < 180 ? 3 : delta < 420 ? 2 : 1;
    myScoreRef.current += pts;
    setMyScore(myScoreRef.current);
    setFlash(pts === 3 ? 'PERFECT' : pts === 2 ? 'GOOD' : 'OK');
    setArmed(false);
    flashScale.value = withSpring(1.2, { damping: 10 });
    void (pts === 3 ? juice.perfect() : juice.hit());
    pairRealtime.sendGame('soft-duel', { score: myScoreRef.current, tap: delta });
    setTimeout(() => nextRound(roundRef.current + 1), 420);
  };

  const line = pickPostMatchLine(myScore, partnerScore, seed);
  const padStyle = useAnimatedStyle(() => ({
    transform: [{ scale: padScale.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flashScale.value }],
  }));

  if (phase === 'finished') {
    return (
      <LpdBackground mood="warm">
        <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.title}>Soft Duel</Text>
          <Text style={styles.meta}>
            Ты {myScore} · Партнёр {partnerScore}
            {partnerLive ? ' · live' : ' · demo'}
          </Text>
          <PostMatchCard
            title={myScore >= partnerScore ? 'Реакция твоя' : 'Партнёр быстрее'}
            gameId="soft-duel"
            line={line.text}
            onRematch={start}
            onHome={() => router.replace('/(tabs)/play')}
          />
        </View>
      </LpdBackground>
    );
  }

  return (
    <LpdBackground mood="night">
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.title}>Soft Duel</Text>
        {phase === 'ready' ? (
          <View style={styles.ready}>
            <Text style={styles.hero}>Реакция на двоих</Text>
            <Text style={styles.body}>
              Слово вспыхивает — жми. Рано = штраф. Perfect / Good / Ok. {ROUNDS} раундов.
            </Text>
            <Pressable onPress={start} style={styles.btn}>
              <Text style={styles.btnLabel}>Старт</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.meta}>
              Раунд {round + 1}/{ROUNDS} · ты {myScore}
              {partnerLive ? ` · партнёр ${partnerScore}` : ''}
            </Text>
            <Animated.View style={[styles.padWrap, padStyle]}>
              <Pressable
                style={[styles.pad, armed && styles.padArmed]}
                onPress={onTap}
              >
                <Text style={styles.prompt}>{prompt}</Text>
                <Animated.Text style={[styles.flash, flashStyle]}>{flash}</Animated.Text>
              </Pressable>
            </Animated.View>
          </>
        )}
      </View>
    </LpdBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.xl, gap: spacing.md },
  title: { fontFamily: fonts.uiSemi, color: colors.textPrimary, fontSize: 18 },
  ready: { flex: 1, justifyContent: 'center', gap: spacing.md },
  hero: { fontFamily: fonts.display, fontSize: 34, color: colors.textPrimary },
  body: { fontFamily: fonts.ui, color: colors.textSecondary, lineHeight: 22 },
  btn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentWine,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.35)',
  },
  btnLabel: { fontFamily: fonts.uiSemi, color: colors.textPrimary },
  meta: { fontFamily: fonts.ui, color: colors.textSecondary },
  padWrap: { flex: 1 },
  pad: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(36,28,49,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  padArmed: {
    borderColor: 'rgba(226,176,122,0.65)',
    backgroundColor: 'rgba(196,92,110,0.22)',
  },
  prompt: {
    fontFamily: fonts.display,
    fontSize: 48,
    color: colors.accentAmber,
  },
  flash: {
    fontFamily: fonts.uiSemi,
    letterSpacing: 2,
    color: colors.accentRose,
    fontSize: 16,
  },
});
