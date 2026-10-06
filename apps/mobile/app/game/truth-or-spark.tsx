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
import { LpdButton } from '../../src/components/LpdButton';
import { PostMatchCard } from '../../src/components/PostMatchCard';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { SparkFilter, sparksRu } from '../../src/content/sparks';
import { pickPostMatchLine } from '../../src/content/postMatch';
import { useApp } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { consumeMatchSession } from '../../src/realtime/matchSession';
import { juice } from '../../src/audio/juice';
import { confirmLeaveMatch } from '../../src/utils/confirmLeaveMatch';
import { usePremium } from '../../src/store/PremiumStore';
import { useMemories } from '../../src/store/MemoriesStore';
import { broadcastMemory } from '../../src/memories/broadcastMemory';

const SKIP_LIMIT = 3;
const EVENING_CARDS = 8;
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
  const { spicyUnlocked, isPlus } = usePremium();
  const { addMemory } = useMemories();
  const params = useLocalSearchParams<{ seed?: string; solo?: string; startAt?: string }>();

  const [matchSeed, setMatchSeed] = useState(() => {
    const fromParam = Number(params.seed);
    if (Number.isFinite(fromParam) && fromParam > 0) return fromParam;
    const session = consumeMatchSession(GAME_ID);
    if (session) return session.seed;
    return Date.now() % 100000;
  });

  const [sessionStarted, setSessionStarted] = useState(() => {
    if (params.solo === '1') return true;
    const at = Number(params.startAt);
    if (!Number.isFinite(at)) return true;
    return at - Date.now() < 400;
  });

  const [filter, setFilter] = useState<SparkFilter>('soft');
  const [index, setIndex] = useState(0);
  const [skips, setSkips] = useState(SKIP_LIMIT);
  const [peerName, setPeerName] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [turnMine, setTurnMine] = useState(true);
  const [forceSolo, setForceSolo] = useState(params.solo === '1');
  const [peerIdleSec, setPeerIdleSec] = useState(0);
  const [turnToast, setTurnToast] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [syncFinish, setSyncFinish] = useState(false);
  const [cardsDone, setCardsDone] = useState(0);
  const [skipsUsed, setSkipsUsed] = useState(0);
  const turnToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const turnToastRef = useRef<string | null>(null);
  const turnWaitSince = useRef<number | null>(null);
  const idleForced = useRef(false);
  const finishLogged = useRef(false);
  const lastSkipAt = useRef(0);
  const lastFilterAt = useRef(0);
  const lastFilterChoice = useRef<SparkFilter>('soft');
  const lastRematchAt = useRef(0);
  const lastHelloAt = useRef(0);
  const lastDeckWrapAt = useRef(0);
  const lastNextAt = useRef(0);
  const prevPresence = useRef(pair?.partnerPresence);

  const deck = useMemo(() => shuffleDeck(matchSeed, filter), [matchSeed, filter]);
  const card = deck[index % deck.length];
  const isHost = Boolean(user?.id && pair?.hostUserId && pair.hostUserId === user.id);
  const cardScale = useSharedValue(1);
  const cardOpacity = useSharedValue(1);
  const cardTilt = useSharedValue(0);

  const showTurnToast = (text: string) => {
    turnToastRef.current = text;
    setTurnToast(text);
    if (turnToastTimer.current) clearTimeout(turnToastTimer.current);
    turnToastTimer.current = setTimeout(() => {
      turnToastRef.current = null;
      setTurnToast(null);
    }, 1600);
  };

  useEffect(() => {
    const cur = pair?.partnerPresence;
    const prev = prevPresence.current;
    if (prev === 'online' && (cur === 'away' || cur === 'offline')) {
      showTurnToast('Партнёр offline');
      void juice.miss();
    } else if ((prev === 'away' || prev === 'offline') && cur === 'online') {
      showTurnToast(
        turnToastRef.current === 'Партнёр offline' ||
          turnToastRef.current === 'Партнёр снова online' ||
          turnToastRef.current === 'Оба на связи'
          ? 'Оба на связи'
          : 'Партнёр снова online',
      );
      void juice.hit();
      // Partner back — leave solo escape if they return mid-wait
      if (forceSolo && params.solo !== '1') {
        setForceSolo(false);
        idleForced.current = false;
      }
    }
    prevPresence.current = cur;
  }, [pair?.partnerPresence, forceSolo, params.solo]);

  // Soft-lock escape: partner's turn + no advance → countdown → соло
  useEffect(() => {
    const waiting =
      sessionStarted &&
      live &&
      !turnMine &&
      !forceSolo &&
      params.solo !== '1';
    if (!waiting) {
      turnWaitSince.current = null;
      setPeerIdleSec(0);
      return;
    }
    if (turnWaitSince.current == null) turnWaitSince.current = Date.now();
    const id = setInterval(() => {
      const sec = Math.floor((Date.now() - (turnWaitSince.current ?? Date.now())) / 1000);
      setPeerIdleSec(sec);
      if (sec >= 35 && !idleForced.current) {
        idleForced.current = true;
        setForceSolo(true);
        showTurnToast('Партнёр молчит · соло 35с');
        void juice.miss();
        pairRealtime.sendGame(GAME_ID, {
          soloEscape: true,
          fromId: user?.id,
          from: user?.displayName,
        });
      }
    }, 400);
    return () => clearInterval(id);
  }, [sessionStarted, live, turnMine, forceSolo, params.solo, user?.id, user?.displayName]);

  useEffect(() => {
    if (turnMine) {
      turnWaitSince.current = null;
      setPeerIdleSec(0);
      idleForced.current = false;
    }
  }, [turnMine]);

  const canAct = sessionStarted && (turnMine || forceSolo || params.solo === '1' || !live);

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
      if (msg.type === 'peer_left') {
        setLive(false);
        showTurnToast('Партнёр вышел');
        void juice.miss();
        return;
      }
      if (msg.type === 'peer_joined') {
        setLive(true);
        showTurnToast(
          turnToastRef.current === 'Партнёр вышел' ||
            turnToastRef.current === 'Партнёр вернулся' ||
            turnToastRef.current === 'Оба снова здесь'
            ? 'Оба снова здесь'
            : 'Партнёр вернулся',
        );
        void juice.sync();
        lastHelloAt.current = Date.now();
        pairRealtime.sendGame(GAME_ID, {
          hello: true,
          fromName: user.displayName,
          fromId: user.id,
        });
        return;
      }
      if (msg.type !== 'game' || msg.gameId !== GAME_ID) return;
      const payload = msg.payload as {
        index?: number;
        filter?: SparkFilter;
        skips?: number;
        fromName?: string;
        fromId?: string;
        rematch?: boolean;
        seed?: number;
        skipped?: boolean;
        filterChange?: boolean;
        hello?: boolean;
        deckWrap?: boolean;
        soloEscape?: boolean;
        phase?: string;
        cards?: number;
        skipsUsed?: number;
      } | undefined;
      if (!payload) return;
      setLive(true);
      if (payload.phase === 'finished' && payload.fromId !== user.id) {
        finishLogged.current = true;
        setSyncFinish(true);
        setFinished(true);
        if (typeof payload.cards === 'number') setCardsDone(payload.cards);
        if (typeof payload.skipsUsed === 'number') setSkipsUsed(payload.skipsUsed);
        showTurnToast(
          turnToastRef.current === 'Оба закрыли вечер' || turnToastRef.current === 'Оба финиш'
            ? 'Оба закрыли вечер'
            : 'Партнёр закрыл вечер',
        );
        void juice.perfect();
        return;
      }
      if (payload.soloEscape && payload.fromId !== user.id) {
        showTurnToast(
          turnToastRef.current === 'Партнёр ушёл в соло' ||
            turnToastRef.current === 'Оба в соло'
            ? 'Оба в соло'
            : 'Партнёр ушёл в соло',
        );
        void juice.miss();
        return;
      }
      if (payload.hello) {
        if (payload.fromName) setPeerName(payload.fromName);
        const both = Date.now() - lastHelloAt.current < 2500;
        showTurnToast(
          both
            ? turnToastRef.current === 'Оба в игре' || turnToastRef.current === 'Оба здесь'
              ? 'Оба здесь'
              : 'Оба в игре'
            : `${payload.fromName ?? 'Партнёр'} в игре`,
        );
        void (both ? juice.perfect() : juice.sync());
        return;
      }
      if (payload.rematch && typeof payload.seed === 'number') {
        setMatchSeed(payload.seed);
        setIndex(0);
        setSkips(SKIP_LIMIT);
        setTurnMine(true);
        setFinished(false);
        setSyncFinish(false);
        setCardsDone(0);
        setSkipsUsed(0);
        finishLogged.current = false;
        const both = Date.now() - lastRematchAt.current < 2500;
        const racing =
          both &&
          (turnToastRef.current === 'Оба: новая колода' ||
            turnToastRef.current === 'Оба снова');
        showTurnToast(
          racing
            ? 'Оба снова'
            : both
              ? 'Оба: новая колода'
              : 'Партнёр: новая колода — твой ход',
        );
        void (both ? juice.perfect() : juice.sync());
        return;
      }
      if (payload.filterChange && (payload.filter === 'soft' || payload.filter === 'spicy')) {
        if (payload.filter === 'spicy' && !spicyUnlocked) {
          if (typeof payload.index === 'number') setIndex(payload.index);
          if (typeof payload.skips === 'number') setSkips(payload.skips);
          if (payload.fromName) setPeerName(payload.fromName);
          setFilter('soft');
          setTurnMine(true);
          showTurnToast('Spicy · Duo Plus — партнёр в spicy, ты soft');
          void juice.miss();
          return;
        }
        setFilter(payload.filter);
        if (typeof payload.index === 'number') setIndex(payload.index);
        if (typeof payload.skips === 'number') setSkips(payload.skips);
        if (payload.fromName) setPeerName(payload.fromName);
        setTurnMine(true);
        const who = payload.fromName || 'Партнёр';
        const both =
          Date.now() - lastFilterAt.current < 2800 &&
          lastFilterChoice.current === payload.filter;
        const raceFilter =
          both &&
          (turnToastRef.current === 'Оба: soft' ||
            turnToastRef.current === 'Оба: spicy' ||
            turnToastRef.current === 'Оба в soft' ||
            turnToastRef.current === 'Оба в spicy');
        showTurnToast(
          both
            ? raceFilter
              ? payload.filter === 'spicy'
                ? 'Оба в spicy'
                : 'Оба в soft'
              : payload.filter === 'spicy'
                ? 'Оба: spicy'
                : 'Оба: soft'
            : payload.filter === 'spicy'
              ? `${who}: spicy`
              : `${who}: soft`,
        );
        void (both ? juice.perfect() : juice.card());
        return;
      }
      if (typeof payload.index === 'number') setIndex(payload.index);
      if (payload.filter === 'soft' || payload.filter === 'spicy') {
        if (payload.filter === 'spicy' && !spicyUnlocked) setFilter('soft');
        else setFilter(payload.filter);
      }
      if (typeof payload.skips === 'number') setSkips(payload.skips);
      if (payload.fromName) setPeerName(payload.fromName);
      if (payload.fromId && payload.fromId !== user.id) {
        setTurnMine(true);
        const who = payload.fromName || 'Партнёр';
        if (payload.deckWrap) {
          const both = Date.now() - lastDeckWrapAt.current < 2800;
          const racing =
            both &&
            (turnToastRef.current === 'Оба: колода по кругу' ||
              turnToastRef.current === 'Оба по кругу');
          showTurnToast(
            racing
              ? 'Оба по кругу'
              : both
                ? 'Оба: колода по кругу'
                : `${who}: колода по кругу — твой ход`,
          );
          void (both ? juice.perfect() : juice.sync());
        } else if (payload.skipped) {
          const both = Date.now() - lastSkipAt.current < 2200;
          const racing =
            both &&
            (turnToastRef.current === 'Оба скипнули' ||
              turnToastRef.current === 'Оба мимо карт');
          showTurnToast(
            racing
              ? 'Оба мимо карт'
              : both
                ? 'Оба скипнули'
                : `${who} скипнул — твой ход`,
          );
          void (both ? juice.sync() : juice.miss());
        } else {
          const both = Date.now() - lastNextAt.current < 2200;
          const racing = both && Date.now() - lastNextAt.current < 900;
          showTurnToast(
            racing ? 'Оба на карте' : both ? 'Оба листают' : `${who} передал ход`,
          );
          void (racing || both ? juice.perfect() : juice.hit());
        }
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id, spicyUnlocked]);

  useEffect(() => {
    if (!pair || !user || params.solo === '1') return;
    lastHelloAt.current = Date.now();
    pairRealtime.sendGame(GAME_ID, {
      hello: true,
      fromName: user.displayName,
      fromId: user.id,
    });
  }, [pair?.code, user?.id, user?.displayName, params.solo]);

  useEffect(() => {
    if (params.solo === '1') {
      setSessionStarted(true);
      return;
    }
    const at = Number(params.startAt);
    if (!Number.isFinite(at)) {
      setSessionStarted(true);
      return;
    }
    const delay = Math.max(0, at - Date.now());
    if (delay < 400) {
      showTurnToast('догоняем');
      void juice.hit();
      const id = setTimeout(() => {
        setSessionStarted(true);
        if (pair && user) {
          lastHelloAt.current = Date.now();
          pairRealtime.sendGame(GAME_ID, {
            hello: true,
            sessionStart: true,
            seed: matchSeed,
            fromName: user.displayName,
            fromId: user.id,
          });
        }
      }, delay);
      return () => clearTimeout(id);
    }
    setSessionStarted(false);
    const ticks: ReturnType<typeof setTimeout>[] = [];
    for (const sec of [3, 2, 1]) {
      const when = delay - sec * 1000;
      if (when > 80) {
        ticks.push(
          setTimeout(() => {
            showTurnToast(`старт ${sec}`);
            void juice.hit();
          }, when),
        );
      }
    }
    const id = setTimeout(() => {
      setSessionStarted(true);
      showTurnToast('старт');
      void juice.sync();
      if (pair && user) {
        lastHelloAt.current = Date.now();
        pairRealtime.sendGame(GAME_ID, {
          hello: true,
          sessionStart: true,
          seed: matchSeed,
          fromName: user.displayName,
          fromId: user.id,
        });
      }
    }, delay);
    return () => {
      clearTimeout(id);
      ticks.forEach(clearTimeout);
    };
  }, [params.startAt, params.solo, pair?.code, user?.id, user?.displayName, matchSeed]);

  const broadcast = (
    nextIndex: number,
    nextFilter: SparkFilter,
    nextSkips: number,
    opts?: { skipped?: boolean; filterChange?: boolean; deckWrap?: boolean },
  ) => {
    pairRealtime.sendGame(GAME_ID, {
      index: nextIndex,
      filter: nextFilter,
      skips: nextSkips,
      fromName: user?.displayName,
      fromId: user?.id,
      seed: matchSeed,
      skipped: opts?.skipped === true,
      filterChange: opts?.filterChange === true,
      deckWrap: opts?.deckWrap === true,
    });
  };

  const finishEvening = (cards: number, usedSkips: number, dual?: boolean) => {
    if (finishLogged.current) return;
    finishLogged.current = true;
    setCardsDone(cards);
    setSkipsUsed(usedSkips);
    setFinished(true);
    if (dual) setSyncFinish(true);
    const mem = addMemory({
      kind: 'spark',
      title: 'Truth Or Spark',
      detail: `${filter} · ${cards} карт · skip ${usedSkips} · seed ${matchSeed}`,
    });
    broadcastMemory(mem, user);
    pairRealtime.sendGame(GAME_ID, {
      phase: 'finished',
      cards,
      skipsUsed: usedSkips,
      filter,
      seed: matchSeed,
      fromId: user?.id,
      fromName: user?.displayName,
    });
    void juice.postMatch();
  };

  const next = () => {
    if (!sessionStarted || finished) return;
    const ni = index + 1;
    const wrapped = ni > 0 && ni % deck.length === 0;
    if (wrapped) {
      lastDeckWrapAt.current = Date.now();
      showTurnToast('Колода по кругу');
      void juice.sync();
    }
    lastNextAt.current = Date.now();
    setIndex(ni);
    setTurnMine(false);
    broadcast(ni, filter, skips, wrapped ? { deckWrap: true } : undefined);
    void juice.card();
    if (ni >= EVENING_CARDS) {
      finishEvening(ni, SKIP_LIMIT - skips);
    }
  };

  const skip = () => {
    if (!sessionStarted || finished || skips <= 0) return;
    const ns = skips - 1;
    const ni = index + 1;
    lastSkipAt.current = Date.now();
    setSkips(ns);
    setIndex(ni);
    setTurnMine(false);
    broadcast(ni, filter, ns, { skipped: true });
    void juice.miss();
    if (ni >= EVENING_CARDS) {
      finishEvening(ni, SKIP_LIMIT - ns);
    }
  };

  const changeFilter = (f: SparkFilter) => {
    if (!sessionStarted) return;
    if (f === 'spicy' && !spicyUnlocked) {
      showTurnToast('Spicy · Duo Plus (Profile → Plus / trial 7д)');
      void juice.miss();
      return;
    }
    setFilter(f);
    setIndex(0);
    setSkips(SKIP_LIMIT);
    setTurnMine(true);
    lastFilterAt.current = Date.now();
    lastFilterChoice.current = f;
    broadcast(0, f, SKIP_LIMIT, { filterChange: true });
    void juice.card();
  };

  const reshuffle = () => {
    if (!sessionStarted) return;
    const nextSeed = Math.floor(Math.random() * 100000);
    setMatchSeed(nextSeed);
    setIndex(0);
    setSkips(SKIP_LIMIT);
    setTurnMine(true);
    setFinished(false);
    setSyncFinish(false);
    setCardsDone(0);
    setSkipsUsed(0);
    finishLogged.current = false;
    lastRematchAt.current = Date.now();
    pairRealtime.sendGame(GAME_ID, {
      rematch: true,
      seed: nextSeed,
      index: 0,
      filter,
      skips: SKIP_LIMIT,
      hello: true,
      fromName: user?.displayName,
      fromId: user?.id,
    });
    void juice.sync();
  };

  const progress = deck.length > 0 ? ((index % deck.length) + 1) / deck.length : 0;
  const eveningProgress = Math.min(1, index / EVENING_CARDS);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { scale: cardScale.value },
      { rotateZ: `${cardTilt.value}deg` },
    ],
  }));

  if (finished) {
    const line = pickPostMatchLine(cardsDone, cardsDone, matchSeed + cardsDone);
    return (
      <LpdBackground mood={filter === 'spicy' ? 'warm' : 'night'}>
        <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.title}>Truth Or Spark</Text>
          <Text style={styles.syncMeta}>
            {filter} · карт {cardsDone}/{EVENING_CARDS} · skip {skipsUsed}/{SKIP_LIMIT} · seed{' '}
            {matchSeed}
            {live ? ' · live' : params.solo === '1' || forceSolo ? ' · solo' : ''}
          </Text>
          <PostMatchCard
            title={syncFinish ? 'Вечер закрыт вдвоём' : 'Вечер закрыт'}
            gameId={GAME_ID}
            winnerLabel={syncFinish ? 'Оба финиш' : filter === 'spicy' ? 'Spicy night' : 'Soft night'}
            line={line.text}
            onRematch={reshuffle}
            onHome={() =>
              router.replace({ pathname: '/game/lobby', params: { game: GAME_ID } })
            }
          />
        </View>
      </LpdBackground>
    );
  }

  return (
    <LpdBackground mood={filter === 'spicy' ? 'warm' : 'night'}>
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.top}>
          <Text style={styles.title}>Truth Or Spark</Text>
          <Pressable
            onPress={() => {
              void confirmLeaveMatch(sessionStarted && index > 0).then((ok) => {
                if (ok) router.back();
              });
            }}
          >
            <Text style={styles.back}>Закрыть</Text>
          </Pressable>
        </View>

        <Text style={styles.syncMeta}>
          seed {matchSeed} ·{' '}
          {!sessionStarted
            ? 'общий старт…'
            : live
              ? `live с ${peerName ?? 'партнёром'}`
              : params.solo === '1'
                ? 'solo'
                : 'ожидаем партнёра'}
          {isHost ? ' · host' : ''} · ход:{' '}
          {turnMine || params.solo === '1' ? 'твой' : 'партнёра'}
        </Text>
        {turnToast ? <Text style={styles.turnToast}>{turnToast}</Text> : null}
        {!sessionStarted ? (
          <Text style={styles.waitStart}>Ждём общий countdown из лобби — карточки откроются вместе.</Text>
        ) : null}
        {sessionStarted && live && !turnMine && !forceSolo && params.solo !== '1' ? (
          <Text style={styles.idleHint}>
            Ход партнёра · ждём {peerIdleSec}с
            {peerIdleSec >= 18 ? ' · скоро можно соло' : ''}
            {peerIdleSec >= 18 ? ` · авто через ${Math.max(0, 35 - peerIdleSec)}с` : ''}
          </Text>
        ) : null}
        {forceSolo && params.solo !== '1' ? (
          <Text style={styles.idleHintOn}>Соло-режим · партнёр не отвечал</Text>
        ) : null}

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, eveningProgress * 100)}%` }]} />
        </View>
        <Text style={styles.syncMeta}>
          вечер {Math.min(index, EVENING_CARDS)}/{EVENING_CARDS} · колода{' '}
          {Math.round(progress * 100)}% · skip {skips}/{SKIP_LIMIT}
        </Text>

        <View style={styles.filters}>
          {(['soft', 'spicy'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => changeFilter(f)}
              disabled={!sessionStarted}
              style={[
                styles.chip,
                filter === f && styles.chipActive,
                !sessionStarted && styles.chipDim,
                f === 'spicy' && !spicyUnlocked && styles.chipLocked,
              ]}
            >
              <Text style={[styles.chipLabel, filter === f && styles.chipLabelActive]}>
                {f === 'spicy' && !spicyUnlocked ? 'spicy · plus' : f}
                {f === 'spicy' && isPlus ? ' ✓' : ''}
              </Text>
            </Pressable>
          ))}
        </View>

        <Animated.View style={[styles.card, cardStyle, !sessionStarted && styles.cardDim]}>
          <Text style={styles.kind}>{card.kind}</Text>
          <Text style={styles.text}>{sessionStarted ? card.text : '…'}</Text>
          <Text style={styles.meta}>
            {sessionStarted
              ? `Карточка ${(index % deck.length) + 1}/${deck.length} · skip осталось ${skips}`
              : 'Старт через мгновение'}
          </Text>
        </Animated.View>

        <View style={styles.actions}>
          <LpdButton
            label={forceSolo && params.solo !== '1' ? 'Дальше (соло)' : 'Дальше (обоим)'}
            onPress={next}
            disabled={!canAct}
          />
          <LpdButton
            label={`Skip · ${skips}`}
            variant="ghost"
            disabled={!canAct || skips <= 0}
            onPress={skip}
          />
          {sessionStarted &&
          live &&
          !turnMine &&
          !forceSolo &&
          params.solo !== '1' &&
          peerIdleSec >= 18 ? (
            <LpdButton
              label={`Продолжить соло · ${peerIdleSec}с`}
              variant="ghost"
              onPress={() => {
                setForceSolo(true);
                idleForced.current = true;
                showTurnToast('Соло — можно листать');
                void juice.hit();
                pairRealtime.sendGame(GAME_ID, {
                  soloEscape: true,
                  fromId: user?.id,
                  from: user?.displayName,
                });
              }}
            />
          ) : null}
          {index > 0 && index % deck.length === 0 ? (
            <LpdButton
              label="Перетасовать колоду"
              variant="ghost"
              onPress={reshuffle}
              disabled={!sessionStarted}
            />
          ) : null}
          {sessionStarted && index >= 3 ? (
            <LpdButton
              label={`Завершить вечер · ${index}/${EVENING_CARDS}`}
              variant="ghost"
              onPress={() => finishEvening(index, SKIP_LIMIT - skips)}
            />
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
  turnToast: {
    fontFamily: fonts.uiSemi,
    fontSize: 14,
    color: colors.accentRose,
  },
  waitStart: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  idleHint: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textMuted,
  },
  idleHintOn: {
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    color: colors.accentAmber,
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
  chipDim: {
    opacity: 0.45,
  },
  chipLocked: {
    borderStyle: 'dashed',
    opacity: 0.75,
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
  cardDim: {
    opacity: 0.55,
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
