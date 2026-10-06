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
import { sendGameIfPeerLive } from '../../src/realtime/sendGameIfPeerLive';
import { sendGameIfDuo } from '../../src/realtime/sendGameIfDuo';
import { getLastRoomSize } from '../../src/realtime/pairPresence';
import { announceLeaveMatch } from '../../src/realtime/leaveMatch';
import { consumeMatchSession } from '../../src/realtime/matchSession';
import { juice } from '../../src/audio/juice';
import { confirmLeaveMatch } from '../../src/utils/confirmLeaveMatch';
import { useMemories } from '../../src/store/MemoriesStore';
import { broadcastMemory } from '../../src/memories/broadcastMemory';
import { useSyncedStartWaiting, syncedStartCountdownLabel } from '../../src/game/syncedStart';

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
  const syncedStartGate = useSyncedStartWaiting(params.solo, params.startAt);
  const [matchSeed, setMatchSeed] = useState(() => {
    const session = consumeMatchSession('word-veil');
    const fromParam = Number(params.seed);
    if (Number.isFinite(fromParam) && fromParam > 0) return fromParam;
    if (session) return session.seed;
    return 7;
  });
  const prompt = SEEDS[matchSeed % SEEDS.length];

  const [phase, setPhase] = useState<Phase>('ready');
  const [mine, setMine] = useState('');
  const [partnerWord, setPartnerWord] = useState('');
  const [locked, setLocked] = useState(false);
  const [waitingPeer, setWaitingPeer] = useState(false);
  const [forceSolo, setForceSolo] = useState(params.solo === '1');
  const forceSoloRef = useRef(params.solo === '1');
  const waitingSyncedStart = syncedStartGate && !forceSolo;
  const [peerTyping, setPeerTyping] = useState(false);
  const [myScore, setMyScore] = useState(0);
  const [theirScore, setTheirScore] = useState(0);
  const veil = useSharedValue(1);
  const revealY = useSharedValue(24);
  const revealOp = useSharedValue(0);
  const mineRef = useRef(mine);
  const lockedRef = useRef(false);
  const waitingPeerRef = useRef(false);
  const partnerWordRef = useRef('');
  const phaseRef = useRef<Phase>('ready');
  const seedRef = useRef(matchSeed);
  const resetRef = useRef<() => void>(() => undefined);
  const doRevealRef = useRef<(peer: string) => void>(() => undefined);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRematchAt = useRef(0);
  const lastHelloAt = useRef(0);
  const lateStartAt = useRef(0);
  const peerLeftMatchRef = useRef(false);
  const prevPresence = useRef(pair?.partnerPresence);
  const [presenceHint, setPresenceHint] = useState<string | null>(null);
  const hintRef = useRef<string | null>(null);

  useEffect(() => {
    forceSoloRef.current = forceSolo;
  }, [forceSolo]);

  useEffect(() => {
    mineRef.current = mine;
  }, [mine]);

  useEffect(() => {
    hintRef.current = presenceHint;
  }, [presenceHint]);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    waitingPeerRef.current = waitingPeer;
  }, [waitingPeer]);

  useEffect(() => {
    partnerWordRef.current = partnerWord;
  }, [partnerWord]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

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
      setPresenceHint(
        hintRef.current === 'Партнёр offline' ||
          hintRef.current === 'Партнёр снова online' ||
          hintRef.current === 'Оба на связи'
          ? 'Оба на связи'
          : 'Партнёр снова online',
      );
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
    // Same association score for both — no artificial −1 on partner
    setMyScore(pts);
    setTheirScore(pts);
    setPartnerWord(peer);
    setWaitingPeer(false);
    setPeerTyping(false);
    setPhase('reveal');
    revealY.value = 28;
    revealOp.value = 0;
    revealY.value = withSpring(0, { damping: 14, stiffness: 160 });
    revealOp.value = withTiming(1, { duration: 280 });
    veil.value = withDelay(80, withTiming(1, { duration: 320 }));
    if (pts >= 5) {
      setPresenceHint(
        hintRef.current === 'Оба: одно слово' || hintRef.current === 'Оба совпали'
          ? 'Оба совпали'
          : 'Оба: одно слово',
      );
      void juice.perfect();
      setTimeout(() => setPresenceHint(null), 1800);
    } else if (
      mineRef.current.trim().length > 0 &&
      mineRef.current.trim().length === peer.trim().length
    ) {
      setPresenceHint(
        hintRef.current === 'Оба на буквах' || hintRef.current === 'Оба в длине'
          ? 'Оба в длине'
          : 'Оба на буквах',
      );
      void juice.sync();
      setTimeout(() => setPresenceHint(null), 1600);
    } else if (pts >= 3) {
      setPresenceHint(
        hintRef.current === 'Оба почти' || hintRef.current === 'Оба на грани'
          ? 'Оба на грани'
          : hintRef.current === 'Почти наравне…'
            ? 'Оба почти'
            : 'Почти наравне…',
      );
      void juice.sync();
      setTimeout(() => setPresenceHint(null), 1600);
    } else {
      void juice.sync();
    }
  };
  doRevealRef.current = doReveal;

  const continueSolo = () => {
    if (!lockedRef.current || partnerWordRef.current) return;
    setForceSolo(true);
    forceSoloRef.current = true;
    setWaitingPeer(false);
    const demo = SEEDS[(seedRef.current + 3) % SEEDS.length];
    setPartnerWord(demo);
    doRevealRef.current(demo);
    setPresenceHint('Продолжаем соло');
    void juice.hit();
    setTimeout(() => setPresenceHint(null), 1600);
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
      if (msg.type === 'peer_left') {
        void juice.miss();
        setForceSolo(true);
        forceSoloRef.current = true;
        const stuckWaiting =
          waitingPeerRef.current ||
          (lockedRef.current &&
            !partnerWordRef.current &&
            phaseRef.current === 'playing');
        if (stuckWaiting) {
          setWaitingPeer(false);
          const demo = SEEDS[(seedRef.current + 3) % SEEDS.length];
          setPartnerWord(demo);
          doRevealRef.current(demo);
          setPresenceHint('Партнёр вышел · соло');
        } else {
          setPresenceHint('Партнёр вышел · соло');
          if (phaseRef.current === 'ready') {
            setPhase('playing');
          }
        }
        setTimeout(() => setPresenceHint(null), 1600);
        return;
      }
      if (msg.type === 'peer_joined') {
        if (peerLeftMatchRef.current) {
          setPresenceHint('Партнёр в комнате · соло до rematch');
          void juice.hit();
        } else {
          setForceSolo(false);
          forceSoloRef.current = false;
          setPresenceHint(
            hintRef.current === 'Партнёр вышел' ||
              hintRef.current === 'Партнёр вышел · соло' ||
              hintRef.current === 'Партнёр вышел из матча · соло' ||
              hintRef.current === 'Партнёр вернулся' ||
              hintRef.current === 'Оба снова здесь'
              ? 'Оба снова здесь'
              : 'Партнёр вернулся',
          );
          void juice.sync();
        }
        lastHelloAt.current = Date.now();
        if (!peerLeftMatchRef.current) {
          sendGameIfPeerLive('word-veil', { hello: true, fromId: user.id });
        }
        setTimeout(() => setPresenceHint(null), 1600);
        return;
      }
      if (msg.type !== 'game' || msg.gameId !== 'word-veil') return;
      const payload = msg.payload as {
        word?: string;
        score?: number;
        rematch?: boolean;
        seed?: number;
        typing?: boolean;
        hello?: boolean;
        phase?: string;
        leaveMatch?: boolean;
        fromId?: string;
      } | undefined;
      if (payload?.leaveMatch && payload.fromId !== user.id) {
        if (typeof payload.seed === 'number' && payload.seed !== seedRef.current) {
          return;
        }
        peerLeftMatchRef.current = true;
        setForceSolo(true);
        forceSoloRef.current = true;
        setPresenceHint('Партнёр вышел из матча · соло');
        setTimeout(() => setPresenceHint(null), 1600);
        void juice.miss();
        if (phaseRef.current === 'ready') {
          setPhase('playing');
        }
        return;
      }
      if (payload?.hello) {
        if (peerLeftMatchRef.current) {
          setPresenceHint('Партнёр в комнате · соло до rematch');
          void juice.hit();
          setTimeout(() => setPresenceHint(null), 1600);
          return;
        }
        const both = Date.now() - lastHelloAt.current < 2500;
        const late = Date.now() - lateStartAt.current < 2500;
        setPresenceHint(
          late
            ? hintRef.current === 'Оба догоняют' || hintRef.current === 'Оба в старте'
              ? 'Оба в старте'
              : 'Оба догоняют'
            : both
              ? hintRef.current === 'Оба в игре' || hintRef.current === 'Оба здесь'
                ? 'Оба здесь'
                : 'Оба в игре'
              : 'Партнёр в игре',
        );
        void (late || both ? juice.perfect() : juice.sync());
        setTimeout(() => setPresenceHint(null), 1600);
        return;
      }
      if (payload?.phase === 'finished') {
        if (peerLeftMatchRef.current) return;
        const peerPts = typeof payload.score === 'number' ? payload.score : 0;
        setTheirScore(peerPts);
        setPresenceHint('Партнёр закрыл раунд');
        setTimeout(() => setPresenceHint(null), 1600);
        // Never fall back to mineRef — that faked a perfect self-match.
        const peerWord = partnerWordRef.current.trim();
        if (phaseRef.current === 'playing' && peerWord) {
          doRevealRef.current(peerWord);
        } else if (phaseRef.current === 'playing' || phaseRef.current === 'reveal') {
          setWaitingPeer(false);
          setForceSolo(true);
          forceSoloRef.current = true;
          if (!peerWord) {
            setPartnerWord('');
            setPhase('finished');
            void juice.postMatch();
          }
        } else if (phaseRef.current !== 'finished') {
          setPhase('finished');
          void juice.postMatch();
        }
        return;
      }
      if (payload?.rematch && typeof payload.seed === 'number') {
        peerLeftMatchRef.current = false;
        setMatchSeed(payload.seed);
        seedRef.current = payload.seed;
        setForceSolo(false);
        forceSoloRef.current = false;
        const both = Date.now() - lastRematchAt.current < 2500;
        const racing =
          both &&
          (hintRef.current === 'Оба: ещё раунд' || hintRef.current === 'Оба снова');
        setPresenceHint(racing ? 'Оба снова' : both ? 'Оба: ещё раунд' : 'Партнёр: ещё раунд');
        setTimeout(() => setPresenceHint(null), 1600);
        resetRef.current();
        void (both ? juice.perfect() : juice.sync());
        return;
      }
      if (peerLeftMatchRef.current) return;
      if (typeof payload?.typing === 'boolean') {
        if (payload.typing) {
          setPeerTyping((was) => {
            if (!was) {
              if (mineRef.current.trim()) {
                const again =
                  hintRef.current === 'Пишем вместе' ||
                  hintRef.current === 'Оба на буквах';
                setPresenceHint(again ? 'Оба на буквах' : 'Пишем вместе');
                setTimeout(() => setPresenceHint(null), 1200);
                void juice.perfect();
              } else {
                void juice.hit();
              }
            } else if (mineRef.current.trim().length > 0) {
              setPresenceHint('Оба на буквах');
              setTimeout(() => setPresenceHint(null), 1200);
              void juice.sync();
            }
            return true;
          });
        } else {
          setPeerTyping(false);
        }
        return;
      }
      if (payload?.word) {
        setPartnerWord(payload.word);
        setPeerTyping(false);
        if (lockedRef.current) {
          const racing =
            hintRef.current === 'Оба закрыли' ||
            hintRef.current === 'Оба завесили';
          setPresenceHint(racing ? 'Оба завесили' : 'Оба закрыли');
          setTimeout(() => setPresenceHint(null), 1400);
          void juice.perfect();
        } else {
          setPresenceHint('Партнёр закрыл слово');
          setTimeout(() => setPresenceHint(null), 1400);
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
    if (!pair || !user || params.solo === '1' || forceSolo) return;
    lastHelloAt.current = Date.now();
    sendGameIfPeerLive('word-veil', { hello: true, fromId: user.id });
  }, [pair?.code, user?.id, params.solo, forceSolo]);

  useEffect(() => {
    if (params.solo === '1' || forceSolo) return;
    const at = Number(params.startAt);
    if (!Number.isFinite(at)) return;
    const delay = Math.max(0, at - Date.now());
    if (delay < 400) {
      lateStartAt.current = Date.now();
      setPresenceHint('Догоняем старт');
      void juice.hit();
      setTimeout(() => setPresenceHint(null), 1400);
      const id = setTimeout(() => {
        if (forceSoloRef.current) return;
        if (phaseRef.current !== 'ready') return;
        setPhase('playing');
      }, delay);
      return () => clearTimeout(id);
    }
    const ticks: ReturnType<typeof setTimeout>[] = [];
    for (const sec of [3, 2, 1]) {
      const when = delay - sec * 1000;
      if (when > 80) {
        ticks.push(
          setTimeout(() => {
            if (forceSoloRef.current) return;
            setPresenceHint(`Старт ${sec}`);
            void juice.hit();
            setTimeout(() => setPresenceHint(null), 900);
          }, when),
        );
      }
    }
    const id = setTimeout(() => {
      if (forceSoloRef.current) return;
      if (phaseRef.current !== 'ready') return;
      setPhase('playing');
    }, delay);
    return () => {
      clearTimeout(id);
      ticks.forEach(clearTimeout);
    };
  }, [params.startAt, params.solo, forceSolo]);

  useEffect(() => {
    if (!locked || phase !== 'playing' || !partnerWord) return;
    doReveal(partnerWord);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, partnerWord, phase]);

  const lock = () => {
    if (!mine.trim() || locked) return;
    setLocked(true);
    veil.value = withTiming(0.35, { duration: 400 });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    sendGameIfDuo(forceSoloRef.current, 'word-veil', {
      word: mine.trim(),
      typing: false,
    });
    void juice.card();

    const useDemo = params.solo === '1' || forceSolo || !pair;
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
    sendGameIfDuo(forceSoloRef.current, 'word-veil', {
      phase: 'finished',
      score: myScore,
    });
    const mem = addMemory({
      kind: 'veil',
      title: 'Word Veil',
      detail: `${prompt}: «${mine}» / «${partnerWord || '…'}»`,
    });
    broadcastMemory(mem, user);
  };

  const rematch = () => {
    const next = Math.floor(Math.random() * 100000);
    setMatchSeed(next);
    seedRef.current = next;
    const peerLive =
      pairRealtime.connected &&
      getLastRoomSize() >= 2 &&
      !peerLeftMatchRef.current;
    const soloAgain = params.solo === '1' || !peerLive;
    peerLeftMatchRef.current = false;
    setForceSolo(soloAgain);
    forceSoloRef.current = soloAgain;
    lastRematchAt.current = Date.now();
    sendGameIfDuo(forceSoloRef.current, 'word-veil', { rematch: true, seed: next, hello: true });
    setPresenceHint(soloAgain ? 'Ещё раунд · соло' : 'Ещё раунд');
    setTimeout(() => setPresenceHint(null), 1600);
    resetRound();
  };

  const line = pickPostMatchLine(myScore, theirScore, matchSeed, params.solo === '1' || forceSolo);
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
    const pct =
      myScore >= 5 ? '100%' : myScore >= 3 ? '60%' : myScore >= 1 ? '30%' : '0%';
    const demo = params.solo === '1' || forceSolo;
    return (
      <LpdBackground mood="warm">
        <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.title}>Word Veil</Text>
          <Text style={styles.revealLine}>
            Ты: «{mine.trim() || '—'}» · {mine.trim().length} букв
          </Text>
          <Text style={styles.revealLine}>
            Партнёр: «{(partnerWord || '').trim() || '—'}» · {(partnerWord || '').trim().length}{' '}
            букв{demo ? ' · demo' : ''}
          </Text>
          <Text style={styles.revealMeta}>
            prompt «{prompt}» · связь {myScore}/5{demo ? ' · solo demo' : ''} · {pct} · seed{' '}
            {matchSeed}
          </Text>
          <PostMatchCard
            title={matchLabel}
            line={line.text}
            gameId="word-veil"
            winnerLabel="Word Veil"
            onRematch={rematch}
            onHome={() => {
              announceLeaveMatch('word-veil', user, seedRef.current);
              router.replace({ pathname: '/game/lobby', params: { game: 'word-veil' } });
            }}
          />
        </View>
      </LpdBackground>
    );
  }

  return (
    <LpdBackground mood="rain">
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Word Veil</Text>
          <Pressable
            onPress={() => {
              void confirmLeaveMatch(
                phase === 'playing' || phase === 'reveal',
              ).then((ok) => {
                if (!ok) return;
                announceLeaveMatch('word-veil', user, seedRef.current);
                router.back();
              });
            }}
          >
            <Text style={styles.leave}>Выйти</Text>
          </Pressable>
        </View>
        {phase === 'ready' ? (
          <View style={styles.ready}>
            <Text style={styles.hero}>Ассоциация вдвоём</Text>
            <Text style={styles.body}>
              Одно слово-якорь. Пишете каждый своё. Сравниваем — и жжём совпадение.
              {waitingSyncedStart
                ? ' Синхронный старт с лобби — не жми раньше партнёра.'
                : params.solo !== '1' &&
                    !forceSolo &&
                    !presenceHint &&
                    (pair?.roomSize ?? 0) < 2
                  ? ' Ждём партнёра за вуалью…'
                  : ''}
            </Text>
            {waitingSyncedStart ? (
              <Text style={styles.meta}>
                {syncedStartCountdownLabel(params.startAt, presenceHint)}
              </Text>
            ) : (
              <LpdButton
                label="Старт"
                onPress={() => {
                  setPhase('playing');
                  if (pair && user && params.solo !== '1') {
                    sendGameIfPeerLive('word-veil', { hello: true, fromId: user.id });
                  }
                  void juice.beat();
                }}
              />
            )}
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
                  sendGameIfDuo(forceSoloRef.current, 'word-veil', { typing: true });
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
                <Text style={styles.revealMeta}>
                  {mine.trim().length} букв · prompt «{prompt}»
                </Text>
                <Text style={styles.revealLine}>
                  Партнёр: {partnerWord || '…'}
                  {params.solo === '1' || forceSolo ? ' · demo' : ''}
                </Text>
                <Text style={styles.revealMeta}>
                  {(partnerWord || '').trim().length} букв
                  {params.solo === '1' || forceSolo
                    ? ' · solo demo'
                    : ` · оба ${myScore}/5`}
                </Text>
                <View style={styles.scoreRow}>
                  <Text style={styles.score}>Связь {myScore}/5</Text>
                  <Text style={styles.scorePct}>
                    {myScore >= 5 ? '100%' : myScore >= 3 ? '60%' : myScore >= 1 ? '30%' : '0%'}
                  </Text>
                </View>
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
                  <>
                    <Text style={styles.waitHint}>Твоё слово закрыто. Партнёр ещё пишет.</Text>
                    <LpdButton
                      label="Продолжить соло"
                      variant="ghost"
                      onPress={continueSolo}
                    />
                  </>
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leave: {
    fontFamily: fonts.uiMedium,
    color: colors.accentAmber,
  },
  ready: { flex: 1, justifyContent: 'center', gap: spacing.md },
  hero: { fontFamily: fonts.display, fontSize: 34, color: colors.textPrimary },
  body: { fontFamily: fonts.ui, color: colors.textSecondary, lineHeight: 22 },
  meta: { fontFamily: fonts.ui, color: colors.textSecondary },
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
  revealMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: -4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginVertical: spacing.sm,
  },
  score: { fontFamily: fonts.mono, color: colors.accentRose, fontSize: 20 },
  scorePct: { fontFamily: fonts.mono, color: colors.accentAmber, fontSize: 16 },
});
