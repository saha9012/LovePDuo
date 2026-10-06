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

const ROUNDS = 8;
const PROMPTS = ['Жар', 'Тише', 'Ближе', 'Смелей', 'Стоп', 'Ещё', 'Сейчас', 'Вдвоём'];

type Phase = 'ready' | 'playing' | 'finished';

export default function SoftDuelScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, pair } = useApp();
  const { addMemory } = useMemories();
  const params = useLocalSearchParams<{ seed?: string; startAt?: string; solo?: string }>();
  const [matchSeed, setMatchSeed] = useState(() => {
    const session = consumeMatchSession('soft-duel');
    const fromParam = Number(params.seed);
    if (Number.isFinite(fromParam) && fromParam > 0) return fromParam;
    if (session) return session.seed;
    return Date.now() % 100000;
  });
  const seed = matchSeed;

  const [phase, setPhase] = useState<Phase>('ready');
  const [round, setRound] = useState(0);
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [myScore, setMyScore] = useState(0);
  const [partnerScore, setPartnerScore] = useState(0);
  const [perfects, setPerfects] = useState(0);
  const [goods, setGoods] = useState(0);
  const [oks, setOks] = useState(0);
  const [earlies, setEarlies] = useState(0);
  const [lastMs, setLastMs] = useState<number | null>(null);
  const [partnerPerfects, setPartnerPerfects] = useState(0);
  const [partnerGoods, setPartnerGoods] = useState(0);
  const [partnerOks, setPartnerOks] = useState(0);
  const [partnerEarlies, setPartnerEarlies] = useState(0);
  const [partnerLastMs, setPartnerLastMs] = useState<number | null>(null);
  const [partnerLive, setPartnerLive] = useState(false);
  const [forceSolo, setForceSolo] = useState(params.solo === '1');
  const forceSoloRef = useRef(params.solo === '1');
  const [flash, setFlash] = useState('');
  const [armed, setArmed] = useState(false);
  const [partnerFlash, setPartnerFlash] = useState(false);
  const [partnerRound, setPartnerRound] = useState(0);
  const [syncFinish, setSyncFinish] = useState(false);
  const [finishDualLabel, setFinishDualLabel] = useState<'Оба финиш' | 'Оба на финише' | null>(
    null,
  );
  const myScoreRef = useRef(0);
  const partnerScoreRef = useRef(0);
  const partnerLiveRef = useRef(false);
  const nextRoundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashRef = useRef('');
  const partnerFinishedRef = useRef(false);
  const roundRef = useRef(0);
  const partnerRoundRef = useRef(0);
  const phaseRef = useRef<Phase>('ready');
  const seedRef = useRef(seed);
  const startRef = useRef<() => void>(() => undefined);
  const armAt = useRef(0);
  const lastRematchAt = useRef(0);
  const lastHelloAt = useRef(0);
  /** Intentional leaveMatch — peer_joined must not silently rejoin the round. */
  const peerLeftMatchRef = useRef(false);
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
    forceSoloRef.current = forceSolo;
  }, [forceSolo]);

  useEffect(() => {
    flashRef.current = flash;
  }, [flash]);

  useEffect(() => {
    partnerScoreRef.current = partnerScore;
  }, [partnerScore]);

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
      const duoLive = (pair?.roomSize ?? 0) >= 2;
      const racing =
        duoLive &&
        (flashRef.current === 'Партнёр offline' ||
          flashRef.current === 'Партнёр online' ||
          flashRef.current === 'Оба на связи');
      setFlash(
        racing
          ? 'Оба на связи'
          : duoLive
            ? 'Партнёр online'
            : 'Партнёр presence · ждём WS 2/2',
      );
      void juice.hit();
    }
    prevPresence.current = cur;
  }, [pair?.partnerPresence, pair?.roomSize, phase]);

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'peer_left') {
        setPartnerLive(false);
        partnerLiveRef.current = false;
        if (phaseRef.current === 'playing' || phaseRef.current === 'finished') {
          setForceSolo(true);
          forceSoloRef.current = true;
          setFlash('Партнёр вышел · соло');
        } else if (phaseRef.current === 'ready') {
          setForceSolo(true);
          forceSoloRef.current = true;
          setFlash('Партнёр вышел · соло');
          setTimeout(() => startRef.current(), 0);
        } else {
          setFlash('Партнёр вышел');
        }
        void juice.miss();
        return;
      }
      if (msg.type === 'peer_joined') {
        if (peerLeftMatchRef.current) {
          setFlash('Партнёр в комнате · соло до rematch');
          void juice.hit();
        } else if (params.solo === '1') {
          setFlash('Партнёр в комнате · соло');
          void juice.sync();
        } else {
          setPartnerLive(true);
          partnerLiveRef.current = true;
          setForceSolo(false);
          forceSoloRef.current = false;
          const racing =
            flashRef.current === 'Партнёр вышел' ||
            flashRef.current === 'Партнёр вышел · соло' ||
            flashRef.current === 'Партнёр вышел из матча · соло' ||
            flashRef.current === 'Партнёр снова в паре' ||
            flashRef.current === 'Оба снова в паре' ||
            flashRef.current === 'Партнёр снова в комнате' ||
            flashRef.current === 'Оба снова в комнате';
          setFlash(racing ? 'Оба снова в паре' : 'Партнёр снова в паре');
          void juice.sync();
        }
        lastHelloAt.current = Date.now();
        if (!peerLeftMatchRef.current && params.solo !== '1') {
          sendGameIfPeerLive('soft-duel', { hello: true, fromId: user.id });
        }
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
        leaveMatch?: boolean;
        fromId?: string;
      } | undefined;
      if (payload?.leaveMatch && payload.fromId !== user.id) {
        // Stale leave from a prior seed — rematch already started a new round.
        if (typeof payload.seed === 'number' && payload.seed !== seedRef.current) {
          return;
        }
        peerLeftMatchRef.current = true;
        setPartnerLive(false);
        partnerLiveRef.current = false;
        setForceSolo(true);
        forceSoloRef.current = true;
        setFlash('Партнёр вышел из матча · соло');
        void juice.miss();
        if (phaseRef.current === 'ready') {
          setTimeout(() => startRef.current(), 0);
        }
        return;
      }
      if (payload?.hello) {
        if (peerLeftMatchRef.current) {
          setFlash('Партнёр в комнате · соло до rematch');
          void juice.hit();
          return;
        }
        if (params.solo === '1') {
          setFlash('Партнёр в комнате · соло');
          void juice.sync();
          return;
        }
        setPartnerLive(true);
        partnerLiveRef.current = true;
        const both = Date.now() - lastHelloAt.current < 2500;
        setFlash(
          both
            ? flashRef.current === 'Оба в игре' || flashRef.current === 'Оба здесь'
              ? 'Оба здесь'
              : 'Оба в игре'
            : 'Партнёр в игре',
        );
        void (both ? juice.perfect() : juice.sync());
        return;
      }
      if (payload?.arm) {
        if (peerLeftMatchRef.current || params.solo === '1') return;
        setPartnerFlash(true);
        const bothPress =
          flashRef.current === 'ЖМИ' ||
          flashRef.current === 'Оба ЖМИ' ||
          flashRef.current === 'Оба жмут';
        const bothWait =
          flashRef.current === 'Жди…' ||
          flashRef.current === 'Оба ждут' ||
          flashRef.current === 'Оба ждут вместе';
        const racingPress = flashRef.current === 'Оба ЖМИ' || flashRef.current === 'Оба жмут';
        const racingWait = flashRef.current === 'Оба ждут' || flashRef.current === 'Оба ждут вместе';
        setFlash((cur) =>
          bothPress
            ? racingPress
              ? 'Оба жмут'
              : 'Оба ЖМИ'
            : bothWait
              ? racingWait
                ? 'Оба ждут вместе'
                : 'Оба ждут'
              : cur === 'ЖМИ' || cur === 'Жди…'
                ? cur
                : 'Партнёр ЖМИ',
        );
        partnerScale.value = withSequence(
          withSpring(1.1, { damping: 10 }),
          withTiming(1, { duration: 200 }),
        );
        setTimeout(() => setPartnerFlash(false), 420);
        void (bothPress || bothWait ? juice.perfect() : juice.beat());
        return;
      }
      if (payload?.phase === 'start') {
        if (peerLeftMatchRef.current || params.solo === '1') return;
        setPartnerLive(true);
        partnerLiveRef.current = true;
        const late =
          flashRef.current === 'Догоняем старт' ||
          flashRef.current === 'Оба догоняют' ||
          flashRef.current === 'Оба в старте';
        if (late) {
          setFlash(
            flashRef.current === 'Оба догоняют' || flashRef.current === 'Оба в старте'
              ? 'Оба в старте'
              : 'Оба догоняют',
          );
          void juice.perfect();
        }
      }
      if (payload?.rematch && typeof payload.seed === 'number') {
        if (params.solo === '1') {
          setFlash('Партнёр: ещё раунд · соло');
          void juice.sync();
          return;
        }
        peerLeftMatchRef.current = false;
        setPartnerLive(true);
        partnerLiveRef.current = true;
        setForceSolo(false);
        forceSoloRef.current = false;
        partnerFinishedRef.current = false;
        setMatchSeed(payload.seed);
        seedRef.current = payload.seed;
        setPartnerRound(0);
        partnerRoundRef.current = 0;
        const both = Date.now() - lastRematchAt.current < 2500;
        const racing =
          both &&
          (flashRef.current === 'Оба: ещё раунд' || flashRef.current === 'Оба снова');
        setFlash(racing ? 'Оба снова' : both ? 'Оба: ещё раунд' : 'Партнёр: ещё раунд');
        void (both ? juice.perfect() : juice.sync());
        setTimeout(() => startRef.current(), 0);
        return;
      }
      // Abandoned / intentional Solo — ignore mid-match duo payloads.
      if (peerLeftMatchRef.current || params.solo === '1') return;
      if (payload?.early) {
        setPartnerEarlies((n) => n + 1);
        setPartnerLastMs(null);
        const both =
          flashRef.current === 'Рано' ||
          flashRef.current === 'Оба рано' ||
          flashRef.current === 'Оба спешат';
        const racing = flashRef.current === 'Оба рано' || flashRef.current === 'Оба спешат';
        setFlash(racing ? 'Оба спешат' : both ? 'Оба рано' : 'Партнёр рано');
        setPartnerFlash(true);
        partnerScale.value = withSequence(
          withSpring(1.08, { damping: 10 }),
          withTiming(1, { duration: 200 }),
        );
        setTimeout(() => setPartnerFlash(false), 420);
        void (both ? juice.sync() : juice.miss());
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
        const prevPartnerRound = partnerRoundRef.current;
        if (typeof payload.round === 'number') {
          partnerRoundRef.current = payload.round;
          setPartnerRound(payload.round);
        }
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
          if (params.solo !== '1' && !forceSoloRef.current) {
            const racing =
              flashRef.current === 'Оба финиш' || flashRef.current === 'Оба на финише';
            const dual = racing ? 'Оба на финише' : 'Оба финиш';
            setFinishDualLabel(dual);
            setSyncFinish(true);
            setFlash(dual);
            void juice.perfect();
          }
        } else if (typeof payload.tap === 'number') {
          const grade =
            payload.tap < 180 ? 'PERFECT' : payload.tap < 420 ? 'GOOD' : 'OK';
          setPartnerLastMs(payload.tap);
          if (grade === 'PERFECT') setPartnerPerfects((n) => n + 1);
          else if (grade === 'GOOD') setPartnerGoods((n) => n + 1);
          else setPartnerOks((n) => n + 1);
          const label =
            grade === 'PERFECT'
              ? 'Партнёр PERFECT'
              : grade === 'GOOD'
                ? 'Партнёр GOOD'
                : 'Партнёр OK';
          const bothPerfect =
            grade === 'PERFECT' &&
            (flashRef.current === 'PERFECT' ||
              flashRef.current === 'Оба PERFECT' ||
              flashRef.current === 'Оба в ритме');
          const bothGood =
            grade === 'GOOD' &&
            (flashRef.current === 'GOOD' ||
              flashRef.current === 'Оба GOOD' ||
              flashRef.current === 'Оба в темпе');
          const bothOk =
            grade === 'OK' &&
            (flashRef.current === 'OK' ||
              flashRef.current === 'Оба OK' ||
              flashRef.current === 'Оба в такте');
          const racePerfect =
            flashRef.current === 'Оба PERFECT' || flashRef.current === 'Оба в ритме';
          const raceGood =
            flashRef.current === 'Оба GOOD' || flashRef.current === 'Оба в темпе';
          const raceOk =
            flashRef.current === 'Оба OK' || flashRef.current === 'Оба в такте';
          setFlash(
            bothPerfect
              ? racePerfect
                ? 'Оба в ритме'
                : 'Оба PERFECT'
              : bothGood
                ? raceGood
                  ? 'Оба в темпе'
                  : 'Оба GOOD'
                : bothOk
                  ? raceOk
                    ? 'Оба в такте'
                    : 'Оба OK'
                  : label,
          );
          flashScale.value = withSpring(1.16, { damping: 10 });
          void (
            bothPerfect || bothGood || bothOk || grade === 'PERFECT'
              ? juice.perfect()
              : juice.hit()
          );
          if (
            !bothPerfect &&
            !bothGood &&
            !bothOk &&
            payload.score === myScoreRef.current
          ) {
            setTimeout(() => {
              setFlash(
                flashRef.current === 'Оба на очках' || flashRef.current === 'Оба в счёте'
                  ? 'Оба в счёте'
                  : 'Оба на очках',
              );
              flashScale.value = withSpring(1.12, { damping: 10 });
              void juice.sync();
            }, 380);
          }
        } else if (ahead) {
          const racing =
            flashRef.current === 'Партнёр впереди' ||
            flashRef.current === 'Гонка' ||
            flashRef.current === 'Оба в гонке';
          setFlash(
            flashRef.current === 'Гонка' || flashRef.current === 'Оба в гонке'
              ? 'Оба в гонке'
              : racing
                ? 'Гонка'
                : 'Партнёр впереди',
          );
          flashScale.value = withSpring(1.14, { damping: 10 });
          void (racing ? juice.sync() : juice.hit());
        } else if (
          typeof payload.round === 'number' &&
          payload.round === roundRef.current &&
          prevPartnerRound < roundRef.current &&
          phaseRef.current === 'playing'
        ) {
          setFlash(
            flashRef.current === 'Наравне' || flashRef.current === 'Оба наравне'
              ? 'Оба наравне'
              : 'Наравне',
          );
          flashScale.value = withSpring(1.14, { damping: 10 });
          void juice.perfect();
        }
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id, partnerScale]);

  useEffect(() => {
    if (!pair || !user || params.solo === '1' || forceSolo) return;
    lastHelloAt.current = Date.now();
    sendGameIfPeerLive('soft-duel', { hello: true, fromId: user.id });
  }, [pair?.code, user?.id, params.solo, forceSolo]);

  const nextRound = (r: number) => {
      if (r >= ROUNDS) {
      setPhase('finished');
      void juice.postMatch();
      sendGameIfDuo(forceSoloRef.current, 'soft-duel', {
        phase: 'finished',
        score: myScoreRef.current,
        round: ROUNDS,
      });
      const mem = addMemory({
        kind: 'duel',
        title: 'Soft Duel',
        detail:
          params.solo === '1' || forceSoloRef.current
            ? `Solo demo · ты ${myScoreRef.current}`
            : partnerFinishedRef.current
              ? `Оба финиш · ты ${myScoreRef.current}`
              : partnerLiveRef.current
                ? `Ты ${myScoreRef.current} · партнёр live`
                : `Ты ${myScoreRef.current} · ждём партнёра`,
      });
      broadcastMemory(mem, user);
      if (partnerFinishedRef.current && params.solo !== '1' && !forceSoloRef.current) {
        const racing =
          flashRef.current === 'Оба финиш' || flashRef.current === 'Оба на финише';
        const dual = racing ? 'Оба на финише' : 'Оба финиш';
        setFinishDualLabel(dual);
        setFlash(dual);
        setSyncFinish(true);
        void juice.perfect();
      }
      // Demo partner score only in solo / forceSolo — never invent while waiting on a live pair.
      if (!partnerLiveRef.current && (params.solo === '1' || forceSoloRef.current)) {
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
    const waitDual =
      flashRef.current === 'Партнёр ЖМИ' ||
      flashRef.current === 'Оба ЖМИ' ||
      flashRef.current === 'Оба жмут' ||
      flashRef.current === 'Оба ждут' ||
      flashRef.current === 'Оба ждут вместе';
    setFlash(
      waitDual
        ? flashRef.current === 'Оба ждут' || flashRef.current === 'Оба ждут вместе'
          ? 'Оба ждут вместе'
          : 'Оба ждут'
        : 'Жди…',
    );
    flashScale.value = withTiming(0.92, { duration: 120 });
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => {
      armTimer.current = null;
      const pressDual =
        flashRef.current === 'Партнёр ЖМИ' ||
        flashRef.current === 'Оба ЖМИ' ||
        flashRef.current === 'Оба жмут' ||
        flashRef.current === 'Оба ждут' ||
        flashRef.current === 'Оба ждут вместе';
      setFlash(
        pressDual
          ? flashRef.current === 'Оба ЖМИ' || flashRef.current === 'Оба жмут'
            ? 'Оба жмут'
            : 'Оба ЖМИ'
          : 'ЖМИ',
      );
      setArmed(true);
      flashScale.value = withSpring(1.12, { damping: 8, stiffness: 200 });
      void juice.beat();
      sendGameIfDuo(forceSoloRef.current, 'soft-duel', {
        arm: true,
        round: roundRef.current,
      });
    }, wait);
  };

  const clearRoundTimers = () => {
    if (armTimer.current) {
      clearTimeout(armTimer.current);
      armTimer.current = null;
    }
    if (nextRoundTimer.current) {
      clearTimeout(nextRoundTimer.current);
      nextRoundTimer.current = null;
    }
  };

  const start = () => {
    clearRoundTimers();
    myScoreRef.current = 0;
    partnerFinishedRef.current = false;
    setSyncFinish(false);
    setFinishDualLabel(null);
    setMyScore(0);
    setPartnerScore(0);
    setPerfects(0);
    setGoods(0);
    setOks(0);
    setEarlies(0);
    setLastMs(null);
    setPartnerPerfects(0);
    setPartnerGoods(0);
    setPartnerOks(0);
    setPartnerEarlies(0);
    setPartnerLastMs(null);
    setPartnerRound(0);
    partnerRoundRef.current = 0;
    setPhase('playing');
    sendGameIfDuo(forceSoloRef.current, 'soft-duel', {
      phase: 'start',
      seed: seedRef.current,
      hello: true,
      fromId: user?.id,
    });
    nextRound(0);
  };
  startRef.current = start;

  const rematch = () => {
    clearRoundTimers();
    const next = Math.floor(Math.random() * 100000);
    setMatchSeed(next);
    seedRef.current = next;
    setSyncFinish(false);
    setFinishDualLabel(null);
    const peerLive =
      pairRealtime.connected &&
      getLastRoomSize() >= 2 &&
      !peerLeftMatchRef.current;
    const soloAgain = params.solo === '1' || !peerLive;
    peerLeftMatchRef.current = false;
    if (peerLive) {
      setPartnerLive(true);
      partnerLiveRef.current = true;
    }
    setForceSolo(soloAgain);
    forceSoloRef.current = soloAgain;
    lastRematchAt.current = Date.now();
    const racing =
      !soloAgain &&
      (flashRef.current === 'Оба: ещё раунд' ||
        flashRef.current === 'Оба снова' ||
        flashRef.current === 'Партнёр: ещё раунд');
    setFlash(
      soloAgain
        ? 'Ещё раунд · соло'
        : flashRef.current === 'Оба: ещё раунд' || flashRef.current === 'Оба снова'
          ? 'Оба снова'
          : racing
            ? 'Оба: ещё раунд'
            : 'Ещё раунд',
    );
    void (racing ? juice.perfect() : juice.sync());
    sendGameIfDuo(forceSoloRef.current, 'soft-duel', { rematch: true, seed: next, hello: true });
    setTimeout(() => startRef.current(), 0);
  };

  const waitingSyncedStart = useSyncedStartWaiting(params.solo, params.startAt, forceSolo);

  useEffect(() => {
    if (params.solo === '1' || forceSolo) return;
    const at = Number(params.startAt);
    if (!Number.isFinite(at)) return;
    const delay = Math.max(0, at - Date.now());
    if (delay < 400) {
      setFlash('Догоняем старт');
      void juice.hit();
      const id = setTimeout(() => {
        if (forceSoloRef.current) return;
        startRef.current();
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
            setFlash(`Старт ${sec}`);
            void juice.hit();
          }, when),
        );
      }
    }
    const id = setTimeout(() => {
      if (forceSoloRef.current) return;
      startRef.current();
    }, delay);
    return () => {
      clearTimeout(id);
      ticks.forEach(clearTimeout);
    };
  }, [params.startAt, params.solo, forceSolo]);

  const onTap = () => {
    if (phase !== 'playing') return;
    const now = Date.now();
    padScale.value = withSequence(
      withTiming(0.94, { duration: 60 }),
      withSpring(1, { damping: 12, stiffness: 220 }),
    );
    if (now < armAt.current) {
      const peerEarly =
        flashRef.current === 'Партнёр рано' ||
        flashRef.current === 'Оба рано' ||
        flashRef.current === 'Оба спешат';
      const racing = flashRef.current === 'Оба рано' || flashRef.current === 'Оба спешат';
      setFlash(racing ? 'Оба спешат' : peerEarly ? 'Оба рано' : 'Рано');
      setArmed(false);
      setEarlies((n) => n + 1);
      setLastMs(-(armAt.current - now));
      void (peerEarly ? juice.sync() : juice.miss());
      myScoreRef.current = Math.max(0, myScoreRef.current - 1);
      setMyScore(myScoreRef.current);
      sendGameIfDuo(forceSoloRef.current, 'soft-duel', {
        early: true,
        score: myScoreRef.current,
        round: roundRef.current,
      });
      return;
    }
    const delta = now - armAt.current;
    const pts = delta < 180 ? 3 : delta < 420 ? 2 : 1;
    const catchingUp =
      partnerRoundRef.current > roundRef.current &&
      partnerRoundRef.current === roundRef.current + 1;
    myScoreRef.current += pts;
    setMyScore(myScoreRef.current);
    setLastMs(delta);
    if (pts === 3) setPerfects((n) => n + 1);
    else if (pts === 2) setGoods((n) => n + 1);
    else setOks((n) => n + 1);
    setFlash(pts === 3 ? 'PERFECT' : pts === 2 ? 'GOOD' : 'OK');
    setArmed(false);
    flashScale.value = withSpring(1.2, { damping: 10 });
    void (pts === 3 ? juice.perfect() : juice.hit());
    sendGameIfDuo(forceSoloRef.current, 'soft-duel', {
      score: myScoreRef.current,
      tap: delta,
      round: roundRef.current,
    });
    if (catchingUp) {
      setTimeout(() => {
        setFlash(
          flashRef.current === 'Наравне' || flashRef.current === 'Оба наравне'
            ? 'Оба наравне'
            : 'Наравне',
        );
        flashScale.value = withSpring(1.14, { damping: 10 });
        void juice.perfect();
      }, 320);
    } else if (partnerLiveRef.current && myScoreRef.current === partnerScoreRef.current) {
      setTimeout(() => {
        setFlash(
          flashRef.current === 'Оба на очках' || flashRef.current === 'Оба в счёте'
            ? 'Оба в счёте'
            : 'Оба на очках',
        );
        flashScale.value = withSpring(1.12, { damping: 10 });
        void juice.sync();
      }, 320);
    } else if (partnerLiveRef.current && myScoreRef.current > partnerScoreRef.current + 2) {
      setTimeout(() => {
        const racing =
          flashRef.current === 'Я впереди' ||
          flashRef.current === 'Гонка' ||
          flashRef.current === 'Оба в гонке';
        setFlash(
          flashRef.current === 'Гонка' || flashRef.current === 'Оба в гонке'
            ? 'Оба в гонке'
            : racing
              ? 'Гонка'
              : 'Я впереди',
        );
        flashScale.value = withSpring(1.14, { damping: 10 });
        void (racing ? juice.sync() : juice.hit());
      }, 320);
    }
    if (nextRoundTimer.current) clearTimeout(nextRoundTimer.current);
    nextRoundTimer.current = setTimeout(() => {
      nextRoundTimer.current = null;
      nextRound(roundRef.current + 1);
    }, 420);
  };

  useEffect(() => () => clearRoundTimers(), []);

  const line = pickPostMatchLine(myScore, partnerScore, matchSeed, params.solo === '1' || forceSolo);
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
            Ты {myScore}
            {params.solo === '1' || forceSolo
              ? ` · Партнёр ${partnerScore} · demo`
              : partnerLive
                ? ` · Партнёр ${partnerScore} · live`
                : partnerScore > 0
                  ? ` · Партнёр ${partnerScore}`
                  : ' · ждём партнёра'}
          </Text>
          <Text style={styles.meta}>
            ты P{perfects}/G{goods}/Ok{oks}/E{earlies}
            {lastMs != null ? ` · ${lastMs}ms` : ''}
          </Text>
          {partnerLive || partnerScore > 0 ? (
            <Text style={styles.meta}>
              партнёр P{partnerPerfects}/G{partnerGoods}/Ok{partnerOks}/E{partnerEarlies}
              {partnerLastMs != null ? ` · ${partnerLastMs}ms` : ''}
              {partnerLive && !forceSolo && params.solo !== '1' ? ' · live' : ' · demo'}
            </Text>
          ) : null}
          <PostMatchCard
            title={
              params.solo === '1' || forceSolo
                ? 'Solo demo'
                : !partnerLive && partnerScore === 0
                  ? 'Ждём счёт партнёра'
                  : myScore >= partnerScore
                    ? 'Реакция твоя'
                    : 'Партнёр быстрее'
            }
            gameId="soft-duel"
            winnerLabel={
              params.solo === '1' || forceSolo
                ? 'Solo demo'
                : syncFinish
                  ? finishDualLabel ?? 'Оба финиш'
                  : undefined
            }
            line={line.text}
            onRematch={rematch}
            onHome={() => {
              announceLeaveMatch('soft-duel', user, seedRef.current);
              router.replace({ pathname: '/game/lobby', params: { game: 'soft-duel' } });
            }}
          />
        </View>
      </LpdBackground>
    );
  }

  return (
    <LpdBackground mood="night">
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Soft Duel</Text>
          <Pressable
            onPress={() => {
              void confirmLeaveMatch(phase === 'playing').then((ok) => {
                if (!ok) return;
                announceLeaveMatch('soft-duel', user, seedRef.current);
                router.back();
              });
            }}
          >
            <Text style={styles.leave}>Выйти</Text>
          </Pressable>
        </View>
        {phase === 'ready' ? (
          <View style={styles.ready}>
            <Text style={styles.hero}>
              {params.solo === '1' || forceSolo
                ? 'Реакция · соло demo'
                : 'Реакция на двоих'}
            </Text>
            <Text style={styles.body}>
              {params.solo === '1' || forceSolo
                ? `Слово вспыхивает — жми. Рано = штраф. Perfect / Good / Ok. ${ROUNDS} раундов. Счёт партнёра здесь demo — не живая реакция пары.`
                : `Слово вспыхивает — жми. Рано = штраф. Perfect / Good / Ok. ${ROUNDS} раундов.`}
              {waitingSyncedStart
                ? ' Синхронный старт с лобби — не жми раньше партнёра.'
                : params.solo !== '1' && !forceSolo && !partnerLive
                  ? ' Ждём, пока партнёр зайдёт в Soft Duel…'
                  : forceSolo && params.solo !== '1'
                    ? ' Партнёр вышел — играешь соло.'
                    : ''}
            </Text>
            {waitingSyncedStart ? (
              <Text style={styles.meta}>
                {syncedStartCountdownLabel(params.startAt, flash)}
              </Text>
            ) : (
              <Pressable onPress={start} style={styles.btn}>
                <Text style={styles.btnLabel}>Старт</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            <View style={styles.hudRow}>
              <Text style={styles.meta}>
                r{round + 1}/{ROUNDS} · ты {myScore} · P{perfects}/G{goods}/Ok{oks}/E{earlies}
                {lastMs != null ? ` · ${lastMs}ms` : ''}
              </Text>
              {params.solo === '1' || forceSolo ? (
                <Text style={styles.meta}>партнёр demo</Text>
              ) : partnerLive ? (
                <Animated.Text
                  style={[styles.partnerHud, partnerFlash && styles.partnerHudHot, partnerStyle]}
                >
                  партнёр {partnerScore} · P{partnerPerfects}/G{partnerGoods}/Ok{partnerOks}/E
                  {partnerEarlies}
                  {partnerLastMs != null ? ` · ${partnerLastMs}ms` : ''} · r
                  {Math.min(ROUNDS, partnerRound + 1)} · live
                </Animated.Text>
              ) : (
                <Text style={styles.meta}>ожидаем партнёра…</Text>
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
