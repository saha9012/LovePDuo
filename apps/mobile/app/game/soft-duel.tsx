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
  const [partnerFlash, setPartnerFlash] = useState(false);
  const [partnerRound, setPartnerRound] = useState(0);
  const [matchSeed, setMatchSeed] = useState(seed);
  const myScoreRef = useRef(0);
  const partnerLiveRef = useRef(false);
  const partnerFinishedRef = useRef(false);
  const roundRef = useRef(0);
  const phaseRef = useRef<Phase>('ready');
  const seedRef = useRef(seed);
  const startRef = useRef<() => void>(() => undefined);
  const armAt = useRef(0);
  const prevPresence = useRef(pair?.partnerPresence);
  const padScale = useSharedValue(1);
  const flashScale = useSharedValue(1);
  const partnerScale = useSharedValue(1);

  useEffect(() => {
    seedRef.current = matchSeed;
  }, [matchSeed]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (phase !== 'playing') {
      prevPresence.current = pair?.partnerPresence;
      return;
    }
    const cur = pair?.partnerPresence;
    const prev = prevPresence.current;
    if (prev === 'online' && (cur === 'away' || cur === 'offline')) {
      setFlash('Партнёр offline');
      void juice.miss();
    } else if ((prev === 'away' || prev === 'offline') && cur === 'online') {
      setFlash('Партнёр online');
      void juice.hit();
    }
    prevPresence.current = cur;
  }, [pair?.partnerPresence, phase]);

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'peer_left') {
        setPartnerLive(false);
        partnerLiveRef.current = false;
        setFlash('Партнёр вышел');
        void juice.miss();
        return;
      }
      if (msg.type !== 'game' || msg.gameId !== 'soft-duel') return;
      const payload = msg.payload as {
        score?: number;
        tap?: number;
        rematch?: boolean;
        seed?: number;
        early?: boolean;
        round?: number;
        phase?: string;
        hello?: boolean;
        arm?: boolean;
      } | undefined;
      if (payload?.hello) {
        setPartnerLive(true);
        partnerLiveRef.current = true;
        setFlash('Партнёр в игре');
        void juice.sync();
        return;
      }
      if (payload?.arm) {
        setPartnerFlash(true);
        setFlash((cur) => (cur === 'ЖМИ' || cur === 'Жди…' ? cur : 'Партнёр ЖМИ'));
        partnerScale.value = withSequence(
          withSpring(1.1, { damping: 10 }),
          withTiming(1, { duration: 200 }),
        );
        setTimeout(() => setPartnerFlash(false), 420);
        void juice.beat();
        return;
      }
      if (payload?.phase === 'start') {
        setPartnerLive(true);
        partnerLiveRef.current = true;
      }
      if (payload?.rematch && typeof payload.seed === 'number') {
        setPartnerLive(true);
        partnerLiveRef.current = true;
        partnerFinishedRef.current = false;
        setMatchSeed(payload.seed);
        seedRef.current = payload.seed;
        setPartnerRound(0);
        setFlash('Партнёр: ещё раунд');
        void juice.sync();
        startRef.current();
        return;
      }
      if (payload?.early) {
        setFlash('Партнёр рано');
        setPartnerFlash(true);
        partnerScale.value = withSequence(
          withSpring(1.08, { damping: 10 }),
          withTiming(1, { duration: 200 }),
        );
        setTimeout(() => setPartnerFlash(false), 420);
        void juice.miss();
        return;
      }
      if (typeof payload?.score === 'number') {
        setPartnerScore(payload.score);
        setPartnerLive(true);
        partnerLiveRef.current = true;
        const ahead =
          typeof payload.round === 'number' &&
          payload.round > roundRef.current &&
          phaseRef.current === 'playing';
        if (typeof payload.round === 'number') setPartnerRound(payload.round);
        setPartnerFlash(true);
        partnerScale.value = withSequence(
          withSpring(1.12, { damping: 10 }),
          withTiming(1, { duration: 220 }),
        );
        setTimeout(() => setPartnerFlash(false), 450);
        if (payload.phase === 'finished' && phaseRef.current === 'playing') {
          partnerFinishedRef.current = true;
          setFlash('Партнёр финиш');
          void juice.sync();
        } else if (payload.phase === 'finished' && phaseRef.current === 'finished') {
          partnerFinishedRef.current = true;
          void juice.sync();
        } else if (typeof payload.tap === 'number') {
          const label =
            payload.tap < 180 ? 'Партнёр PERFECT' : payload.tap < 420 ? 'Партнёр GOOD' : 'Партнёр OK';
          setFlash(label);
          flashScale.value = withSpring(1.16, { damping: 10 });
          void (payload.tap < 180 ? juice.perfect() : juice.hit());
        } else if (ahead) {
          setFlash('Партнёр впереди');
          flashScale.value = withSpring(1.14, { damping: 10 });
          void juice.hit();
        }
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id, partnerScale]);

  useEffect(() => {
    if (!pair || !user || params.solo === '1') return;
    pairRealtime.sendGame('soft-duel', { hello: true, fromId: user.id });
  }, [pair?.code, user?.id, params.solo]);

  const nextRound = (r: number) => {
      if (r >= ROUNDS) {
      setPhase('finished');
      void juice.postMatch();
      pairRealtime.sendGame('soft-duel', {
        phase: 'finished',
        score: myScoreRef.current,
        round: ROUNDS,
      });
      addMemory({
        kind: 'duel',
        title: 'Soft Duel',
        detail: partnerFinishedRef.current
          ? `Синхрон финиш · ты ${myScoreRef.current}`
          : `Ты ${myScoreRef.current} · Партнёр ${partnerLiveRef.current ? 'live' : 'demo'}`,
      });
      if (partnerFinishedRef.current) {
        setFlash('Синхрон финиш');
      }
      if (!partnerLiveRef.current) {
        setPartnerScore(Math.round(myScoreRef.current * (0.75 + Math.random() * 0.4)));
      }
      return;
    }
    roundRef.current = r;
    setRound(r);
    setPrompt(PROMPTS[(seedRef.current + r) % PROMPTS.length]);
    setArmed(false);
    const wait = 600 + ((seedRef.current + r * 97) % 900);
    armAt.current = Date.now() + wait;
    setFlash('Жди…');
    flashScale.value = withTiming(0.92, { duration: 120 });
    setTimeout(() => {
      setFlash('ЖМИ');
      setArmed(true);
      flashScale.value = withSpring(1.12, { damping: 8, stiffness: 200 });
      void juice.beat();
      pairRealtime.sendGame('soft-duel', { arm: true, round: roundRef.current });
    }, wait);
  };

  const start = () => {
    myScoreRef.current = 0;
    partnerFinishedRef.current = false;
    setMyScore(0);
    setPartnerScore(0);
    setPartnerRound(0);
    setPhase('playing');
    pairRealtime.sendGame('soft-duel', {
      phase: 'start',
      seed: seedRef.current,
      hello: true,
      fromId: user?.id,
    });
    nextRound(0);
  };
  startRef.current = start;

  const rematch = () => {
    const next = Math.floor(Math.random() * 100000);
    setMatchSeed(next);
    seedRef.current = next;
    setFlash('Новый раунд');
    void juice.sync();
    pairRealtime.sendGame('soft-duel', { rematch: true, seed: next, hello: true });
    start();
  };

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
      pairRealtime.sendGame('soft-duel', {
        early: true,
        score: myScoreRef.current,
        round: roundRef.current,
      });
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
    pairRealtime.sendGame('soft-duel', {
      score: myScoreRef.current,
      tap: delta,
      round: roundRef.current,
    });
    setTimeout(() => nextRound(roundRef.current + 1), 420);
  };

  const line = pickPostMatchLine(myScore, partnerScore, matchSeed);
  const padStyle = useAnimatedStyle(() => ({
    transform: [{ scale: padScale.value }],
  }));
  const flashStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flashScale.value }],
  }));
  const partnerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: partnerScale.value }],
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
            onRematch={rematch}
            onHome={() => router.replace({ pathname: '/game/lobby', params: { game: 'soft-duel' } })}
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
              {params.solo !== '1' && !partnerLive
                ? ' Ждём, пока партнёр зайдёт в Soft Duel…'
                : ''}
            </Text>
            <Pressable onPress={start} style={styles.btn}>
              <Text style={styles.btnLabel}>Старт</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.hudRow}>
              <Text style={styles.meta}>
                Раунд {round + 1}/{ROUNDS} · ты {myScore}
              </Text>
              {partnerLive ? (
                <Animated.Text
                  style={[styles.partnerHud, partnerFlash && styles.partnerHudHot, partnerStyle]}
                >
                  партнёр {partnerScore} · r{Math.min(ROUNDS, partnerRound + 1)} · live
                </Animated.Text>
              ) : (
                <Text style={styles.meta}>
                  {params.solo === '1' ? 'партнёр demo' : 'ожидаем партнёра…'}
                </Text>
              )}
            </View>
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
  hudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  meta: { fontFamily: fonts.ui, color: colors.textSecondary },
  partnerHud: {
    fontFamily: fonts.uiMedium,
    color: colors.textSecondary,
    fontSize: 13,
  },
  partnerHudHot: {
    color: colors.accentRose,
    fontFamily: fonts.uiSemi,
  },
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
