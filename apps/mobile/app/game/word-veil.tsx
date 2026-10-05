import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LpdBackground } from '../../src/components/LpdBackground';
import { PostMatchCard } from '../../src/components/PostMatchCard';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { pickPostMatchLine } from '../../src/content/postMatch';
import { useApp } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { juice } from '../../src/audio/juice';
import { useMemories } from '../../src/store/MemoriesStore';

const SEEDS = [
  'ночь',
  'пульс',
  'стекло',
  'тепло',
  'тишина',
  'янтарь',
  'дождь',
  'взгляд',
];

type Phase = 'ready' | 'playing' | 'reveal' | 'finished';

export default function WordVeilScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, pair } = useApp();
  const { addMemory } = useMemories();
  const params = useLocalSearchParams<{ seed?: string; startAt?: string; solo?: string }>();
  const [matchSeed, setMatchSeed] = useState(Number(params.seed) || 7);
  const prompt = SEEDS[matchSeed % SEEDS.length];

  const [phase, setPhase] = useState<Phase>('ready');
  const [mine, setMine] = useState('');
  const [partnerWord, setPartnerWord] = useState('');
  const [locked, setLocked] = useState(false);
  const [waitingPeer, setWaitingPeer] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [theirScore, setTheirScore] = useState(0);
  const veil = useSharedValue(1);
  const revealY = useSharedValue(24);
  const revealOp = useSharedValue(0);
  const mineRef = useRef(mine);
  const lockedRef = useRef(false);
  const seedRef = useRef(matchSeed);
  const resetRef = useRef<() => void>(() => undefined);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPresence = useRef(pair?.partnerPresence);
  const [presenceHint, setPresenceHint] = useState<string | null>(null);

  useEffect(() => {
    mineRef.current = mine;
  }, [mine]);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    seedRef.current = matchSeed;
  }, [matchSeed]);

  useEffect(() => {
    if (phase !== 'playing' && phase !== 'reveal') {
      prevPresence.current = pair?.partnerPresence;
      return;
    }
    const cur = pair?.partnerPresence;
    const prev = prevPresence.current;
    if (prev === 'online' && (cur === 'away' || cur === 'offline')) {
      setPresenceHint('Партнёр offline');
      void juice.miss();
      const t = setTimeout(() => setPresenceHint(null), 1800);
      prevPresence.current = cur;
      return () => clearTimeout(t);
    }
    if ((prev === 'away' || prev === 'offline') && cur === 'online') {
      setPresenceHint('Партнёр снова online');
      void juice.hit();
      const t = setTimeout(() => setPresenceHint(null), 1800);
      prevPresence.current = cur;
      return () => clearTimeout(t);
    }
    prevPresence.current = cur;
  }, [pair?.partnerPresence, phase]);

  const scoreWords = (a: string, b: string) => {
    const x = a.trim().toLowerCase();
    const y = b.trim().toLowerCase();
    if (!x || !y) return 0;
    if (x === y) return 5;
    if (x.includes(y) || y.includes(x)) return 3;
    const setA = new Set(x);
    let overlap = 0;
    for (const ch of y) if (setA.has(ch)) overlap += 1;
    return Math.min(2, Math.floor(overlap / 3));
  };

  const doReveal = (peer: string) => {
    const pts = scoreWords(mineRef.current, peer);
    setMyScore(pts);
    setTheirScore(Math.max(0, pts - (peer === mineRef.current ? 0 : 1)));
    setWaitingPeer(false);
    setPeerTyping(false);
    setPhase('reveal');
    revealY.value = 28;
    revealOp.value = 0;
    revealY.value = withSpring(0, { damping: 14, stiffness: 160 });
    revealOp.value = withTiming(1, { duration: 280 });
    veil.value = withDelay(80, withTiming(1, { duration: 320 }));
    void juice.sync();
  };

  const resetRound = () => {
    setMine('');
    setPartnerWord('');
    setLocked(false);
    setWaitingPeer(false);
    setPeerTyping(false);
    setMyScore(0);
    setTheirScore(0);
    veil.value = 1;
    setPhase('playing');
  };
  resetRef.current = resetRound;

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type !== 'game' || msg.gameId !== 'word-veil') return;
      const payload = msg.payload as {
        word?: string;
        score?: number;
        rematch?: boolean;
        seed?: number;
        typing?: boolean;
        hello?: boolean;
      } | undefined;
      if (payload?.hello) {
        setPresenceHint('Партнёр в игре');
        void juice.sync();
        setTimeout(() => setPresenceHint(null), 1600);
        return;
      }
      if (payload?.rematch && typeof payload.seed === 'number') {
        setMatchSeed(payload.seed);
        seedRef.current = payload.seed;
        resetRef.current();
        void juice.sync();
        return;
      }
      if (payload?.typing) {
        setPeerTyping((was) => {
          if (!was) void juice.hit();
          return true;
        });
        return;
      }
      if (payload?.word) {
        setPartnerWord(payload.word);
        setPeerTyping(false);
        if (!lockedRef.current) {
          void juice.hit();
        }
      }
      if (typeof payload?.score === 'number') setTheirScore(payload.score);
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id]);

  useEffect(() => {
    if (!pair || !user || params.solo === '1') return;
    pairRealtime.sendGame('word-veil', { hello: true, fromId: user.id });
  }, [pair?.code, user?.id, params.solo]);

  useEffect(() => {
    if (params.solo === '1') return;
    const at = Number(params.startAt);
    if (!Number.isFinite(at)) return;
    const id = setTimeout(() => setPhase('playing'), Math.max(0, at - Date.now()));
    return () => clearTimeout(id);
  }, [params.startAt, params.solo]);

  useEffect(() => {
    if (!locked || phase !== 'playing' || !partnerWord) return;
    doReveal(partnerWord);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, partnerWord, phase]);

  const lock = () => {
    if (!mine.trim() || locked) return;
    setLocked(true);
    veil.value = withTiming(0.35, { duration: 400 });
    pairRealtime.sendGame('word-veil', { word: mine.trim() });
    void juice.card();

    const useDemo = params.solo === '1' || !pair;
    if (partnerWord) {
      doReveal(partnerWord);
      return;
    }
    if (useDemo) {
      const demo = SEEDS[(seedRef.current + 3) % SEEDS.length];
      setTimeout(() => {
        setPartnerWord(demo);
        doReveal(demo);
      }, 700);
      return;
    }
    setWaitingPeer(true);
  };

  const finish = () => {
    setPhase('finished');
    void juice.postMatch();
    addMemory({
      kind: 'veil',
      title: 'Word Veil',
      detail: `${prompt}: «${mine}» / «${partnerWord || '…'}»`,
    });
  };

  const rematch = () => {
    const next = Math.floor(Math.random() * 100000);
    setMatchSeed(next);
    seedRef.current = next;
    pairRealtime.sendGame('word-veil', { rematch: true, seed: next });
    resetRound();
  };

  const line = pickPostMatchLine(myScore, theirScore, matchSeed);
  const matchLabel = useMemo(() => {
    if (myScore >= 5) return 'Одинаковый пульс слов';
    if (myScore >= 3) return 'Почти одно слово';
    return 'Разные грани одной ночи';
  }, [myScore]);

  const veilStyle = useAnimatedStyle(() => ({
    opacity: veil.value,
  }));
  const revealStyle = useAnimatedStyle(() => ({
    opacity: revealOp.value,
    transform: [{ translateY: revealY.value }],
  }));

  if (phase === 'finished') {
    return (
      <LpdBackground mood="warm">
        <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
          <PostMatchCard
            title={matchLabel}
            line={line.text}
            gameId="word-veil"
            winnerLabel="Word Veil"
            onRematch={rematch}
            onHome={() => router.replace({ pathname: '/game/lobby', params: { game: 'word-veil' } })}
          />
        </View>
      </LpdBackground>
    );
  }

  return (
    <LpdBackground mood="rain">
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.title}>Word Veil</Text>
        {phase === 'ready' ? (
          <View style={styles.ready}>
            <Text style={styles.hero}>Ассоциация вдвоём</Text>
            <Text style={styles.body}>
              Одно слово-якорь. Пишете каждый своё. Сравниваем — и жжём совпадение.
            </Text>
            <LpdButton label="Старт" onPress={() => setPhase('playing')} />
          </View>
        ) : (
          <>
            <Animated.Text style={[styles.prompt, veilStyle]}>Слово: {prompt}</Animated.Text>
            <TextInput
              value={mine}
              onChangeText={(t) => {
                setMine(t);
                if (locked || phase !== 'playing') return;
                if (typingTimer.current) clearTimeout(typingTimer.current);
                typingTimer.current = setTimeout(() => {
                  pairRealtime.sendGame('word-veil', { typing: true });
                }, 280);
              }}
              editable={!locked}
              placeholder="Твоя ассоциация"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, locked && styles.inputLocked]}
              autoCapitalize="none"
            />
            {presenceHint ? (
              <Text style={styles.waitHint}>{presenceHint}</Text>
            ) : partnerWord && !locked && phase === 'playing' ? (
              <Text style={styles.waitHint}>Партнёр закрыл слово — закрой своё</Text>
            ) : peerTyping && !locked && phase === 'playing' ? (
              <Text style={styles.waitHint}>Партнёр пишет…</Text>
            ) : null}
            {phase === 'reveal' ? (
              <Animated.View style={[styles.reveal, revealStyle]}>
                <Text style={styles.revealLine}>Ты: {mine}</Text>
                <Text style={styles.revealLine}>Партнёр: {partnerWord || '…'}</Text>
                <Text style={styles.score}>Связь {myScore}/5</Text>
                <LpdButton label="Закрыть раунд" onPress={finish} />
              </Animated.View>
            ) : (
              <>
                <Pressable
                  onPress={lock}
                  style={[styles.lockBtn, (!mine.trim() || locked) && styles.lockDisabled]}
                >
                  <Text style={styles.lockLabel}>
                    {waitingPeer ? 'Ждём слово партнёра…' : locked ? 'Ждём…' : 'Закрыть слово'}
                  </Text>
                </Pressable>
                {waitingPeer ? (
                  <Text style={styles.waitHint}>Твоё слово закрыто. Партнёр ещё пишет.</Text>
                ) : null}
              </>
            )}
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
  prompt: {
    marginTop: spacing.xl,
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.accentAmber,
  },
  input: {
    minHeight: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontFamily: fonts.ui,
    fontSize: 18,
    backgroundColor: 'rgba(36,28,49,0.65)',
  },
  inputLocked: {
    borderColor: 'rgba(226,176,122,0.35)',
    opacity: 0.85,
  },
  lockBtn: {
    marginTop: spacing.md,
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.accentWine,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.35)',
  },
  lockDisabled: { opacity: 0.45 },
  lockLabel: { fontFamily: fonts.uiSemi, color: colors.textPrimary },
  waitHint: {
    fontFamily: fonts.ui,
    color: colors.accentMist,
    fontSize: 13,
    marginTop: spacing.sm,
  },
  reveal: { gap: spacing.sm, marginTop: spacing.md },
  revealLine: { fontFamily: fonts.uiMedium, color: colors.textPrimary, fontSize: 18 },
  score: { fontFamily: fonts.mono, color: colors.accentRose, fontSize: 20, marginVertical: spacing.sm },
});
