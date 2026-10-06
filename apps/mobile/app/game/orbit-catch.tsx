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

type Phase = 'ready' | 'playing' | 'finished';

const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R = 100;

export default function OrbitCatchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, pair } = useApp();
  const { addMemory } = useMemories();
  const params = useLocalSearchParams<{ seed?: string; startAt?: string; solo?: string }>();
  const syncedStartGate = useSyncedStartWaiting(params.solo, params.startAt);
  const [matchSeed, setMatchSeed] = useState(() => {
    const session = consumeMatchSession('orbit-catch');
    const fromParam = Number(params.seed);
    if (Number.isFinite(fromParam) && fromParam > 0) return fromParam;
    if (session) return session.seed;
    return 11;
  });
  const seed = matchSeed;
  const [phase, setPhase] = useState<Phase>('ready');
  const [angle, setAngle] = useState(0);
  const [orbAngle, setOrbAngle] = useState(0);
  const [caught, setCaught] = useState(0);
  const [misses, setMisses] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [partnerCaught, setPartnerCaught] = useState(0);
  const [timeLeft, setTimeLeft] = useState(35);
  const [aligned, setAligned] = useState(false);
  const [partnerFlash, setPartnerFlash] = useState(false);
  const [peerNote, setPeerNote] = useState<string | null>(null);
  const [peerSeen, setPeerSeen] = useState(false);
  const [forceSolo, setForceSolo] = useState(params.solo === '1');
  const waitingSyncedStart = syncedStartGate && !forceSolo;
  const [syncFinish, setSyncFinish] = useState(false);
  const [finishDualLabel, setFinishDualLabel] = useState<'Оба финиш' | 'Оба на финише' | null>(
    null,
  );
  const caughtRef = useRef(0);
  const partnerRef = useRef(0);
  const partnerFinishedRef = useRef(false);
  const forceSoloRef = useRef(params.solo === '1');
  const phaseRef = useRef<Phase>('ready');
  const seedRef = useRef(seed);
  const startRef = useRef<() => void>(() => undefined);
  const peerNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPresence = useRef(pair?.partnerPresence);
  const flash = useSharedValue(0);
  const ringPulse = useSharedValue(1);
  const partnerScale = useSharedValue(1);
  const lastAlignSend = useRef(0);
  const alignedRef = useRef(false);
  const lastCatchAt = useRef(0);
  const lastMissAt = useRef(0);
  const lastRematchAt = useRef(0);
  const lastHelloAt = useRef(0);
  const lateStartAt = useRef(0);
  const peerLeftMatchRef = useRef(false);
  const peerNoteRef = useRef<string | null>(null);

  const speed = useMemo(() => 0.045 + (matchSeed % 7) * 0.004, [matchSeed]);

  const bumpPeerNote = (text: string) => {
    peerNoteRef.current = text;
    setPeerNote(text);
    if (peerNoteTimer.current) clearTimeout(peerNoteTimer.current);
    peerNoteTimer.current = setTimeout(() => {
      peerNoteRef.current = null;
      setPeerNote(null);
    }, 1000);
  };

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
    if (phase !== 'playing') {
      prevPresence.current = pair?.partnerPresence;
      return;
    }
    const cur = pair?.partnerPresence;
    const prev = prevPresence.current;
    if (prev === 'online' && (cur === 'away' || cur === 'offline')) {
      bumpPeerNote('offline');
      void juice.miss();
    } else if ((prev === 'away' || prev === 'offline') && cur === 'online') {
      const duoLive = (pair?.roomSize ?? 0) >= 2;
      const racing =
        duoLive &&
        (peerNoteRef.current === 'offline' ||
          peerNoteRef.current === 'online' ||
          peerNoteRef.current === 'оба на связи');
      bumpPeerNote(
        racing
          ? 'оба на связи'
          : duoLive
            ? 'online'
            : 'presence · ждём WS 2/2',
      );
      void juice.hit();
    }
    prevPresence.current = cur;
  }, [pair?.partnerPresence, pair?.roomSize, phase]);

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'peer_left') {
        setPeerSeen(false);
        if (phaseRef.current === 'playing' || phaseRef.current === 'finished') {
          setForceSolo(true);
          forceSoloRef.current = true;
          bumpPeerNote('вышел · соло');
        } else if (phaseRef.current === 'ready') {
          setForceSolo(true);
          forceSoloRef.current = true;
          bumpPeerNote('вышел · соло');
          setTimeout(() => startRef.current(), 0);
        } else {
          bumpPeerNote('вышел');
        }
        void juice.miss();
        return;
      }
      if (msg.type === 'peer_joined') {
        setPeerSeen(true);
        if (peerLeftMatchRef.current) {
          bumpPeerNote('комната · соло');
          void juice.hit();
        } else if (params.solo !== '1') {
          setForceSolo(false);
          forceSoloRef.current = false;
          bumpPeerNote(
            peerNoteRef.current === 'вышел' ||
              peerNoteRef.current === 'вышел · соло' ||
              peerNoteRef.current === 'матч·соло' ||
              peerNoteRef.current === 'вернулся' ||
              peerNoteRef.current === 'оба снова здесь'
              ? 'оба снова здесь'
              : 'вернулся',
          );
          void juice.sync();
        } else {
          bumpPeerNote('комната · соло');
          void juice.sync();
        }
        lastHelloAt.current = Date.now();
        if (!peerLeftMatchRef.current) {
          sendGameIfPeerLive('orbit-catch', { hello: true, fromId: user.id });
        }
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'orbit-catch') {
        const payload = msg.payload as {
          caught?: number;
          rematch?: boolean;
          seed?: number;
          miss?: boolean;
          align?: boolean;
          phase?: string;
          hello?: boolean;
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
          setPeerSeen(false);
          bumpPeerNote('матч·соло');
          void juice.miss();
          if (phaseRef.current === 'ready') {
            setTimeout(() => startRef.current(), 0);
          }
          return;
        }
        if (payload?.hello || payload?.phase === 'start') {
          if (peerLeftMatchRef.current) {
            if (payload?.hello) {
              bumpPeerNote('комната · соло');
              void juice.hit();
            }
            return;
          }
          setPeerSeen(true);
          if (payload?.hello) {
            const both = Date.now() - lastHelloAt.current < 2500;
            bumpPeerNote(
              both
                ? peerNoteRef.current === 'оба в игре' || peerNoteRef.current === 'оба здесь'
                  ? 'оба здесь'
                  : 'оба в игре'
                : 'в игре',
            );
            void (both ? juice.perfect() : juice.sync());
            return;
          }
          if (payload?.phase === 'start' && Date.now() - lateStartAt.current < 2500) {
            bumpPeerNote(
              peerNoteRef.current === 'оба догоняют' || peerNoteRef.current === 'оба в старте'
                ? 'оба в старте'
                : 'оба догоняют',
            );
            void juice.perfect();
          }
        }
        if (payload?.rematch && typeof payload.seed === 'number') {
          peerLeftMatchRef.current = false;
          setPeerSeen(true);
          setForceSolo(false);
          forceSoloRef.current = false;
          setMatchSeed(payload.seed);
          seedRef.current = payload.seed;
          const both = Date.now() - lastRematchAt.current < 2500;
          const racing =
            both &&
            (peerNoteRef.current === 'оба ещё раунд' || peerNoteRef.current === 'оба снова');
          bumpPeerNote(racing ? 'оба снова' : both ? 'оба ещё раунд' : 'ещё раунд');
          void (both ? juice.perfect() : juice.sync());
          setTimeout(() => startRef.current(), 0);
          return;
        }
        if (peerLeftMatchRef.current) return;
        if (payload?.phase === 'finished') {
          partnerFinishedRef.current = true;
          if (typeof payload.caught === 'number') {
            partnerRef.current = payload.caught;
            setPartnerCaught(payload.caught);
          }
          if (phaseRef.current === 'finished') {
            if (params.solo !== '1' && !forceSoloRef.current) {
              const racing =
                peerNoteRef.current === 'оба финиш' || peerNoteRef.current === 'оба на финише';
              const dual = racing ? 'Оба на финише' : 'Оба финиш';
              setFinishDualLabel(dual);
              setSyncFinish(true);
              bumpPeerNote(racing ? 'оба на финише' : 'оба финиш');
              void juice.perfect();
            }
          } else {
            bumpPeerNote('финиш');
            void juice.sync();
          }
          return;
        }
        if (payload?.miss) {
          const both = Date.now() - lastMissAt.current < 900;
          const racing =
            both &&
            (peerNoteRef.current === 'оба miss' || peerNoteRef.current === 'оба мимо');
          bumpPeerNote(racing ? 'оба мимо' : both ? 'оба miss' : 'промах');
          setPartnerFlash(true);
          partnerScale.value = withSequence(
            withSpring(0.94, { damping: 10 }),
            withTiming(1, { duration: 200 }),
          );
          setTimeout(() => setPartnerFlash(false), 400);
          void (both ? juice.sync() : juice.miss());
          return;
        }
        if (payload?.align) {
          const synced = alignedRef.current;
          const racing =
            synced &&
            (peerNoteRef.current === 'sync align' ||
              peerNoteRef.current === 'оба sync');
          bumpPeerNote(
            racing ? 'оба sync' : synced ? 'sync align' : 'align',
          );
          ringPulse.value = withSequence(
            withTiming(1.08, { duration: 90 }),
            withTiming(1, { duration: 220 }),
          );
          void (synced ? juice.perfect() : juice.hit());
          return;
        }
        if (typeof payload?.caught === 'number') {
          const grew = payload.caught > partnerRef.current;
          partnerRef.current = payload.caught;
          setPartnerCaught(payload.caught);
          setPartnerFlash(true);
          partnerScale.value = withSequence(
            withSpring(1.12, { damping: 10 }),
            withTiming(1, { duration: 200 }),
          );
          setTimeout(() => setPartnerFlash(false), 400);
          if (grew && Date.now() - lastCatchAt.current < 900) {
            bumpPeerNote(
              peerNoteRef.current === 'оба catch' || peerNoteRef.current === 'оба в орбите'
                ? 'оба в орбите'
                : 'оба catch',
            );
            void juice.perfect();
            if (payload.caught === caughtRef.current && caughtRef.current > 0) {
              setTimeout(() => {
                bumpPeerNote(
              peerNoteRef.current === 'оба на очках' || peerNoteRef.current === 'оба в счёте'
                ? 'оба в счёте'
                : 'оба на очках',
            );
                void juice.sync();
              }, 380);
            }
          } else if (payload.caught === caughtRef.current && caughtRef.current > 0) {
            bumpPeerNote(
              peerNoteRef.current === 'оба на очках' || peerNoteRef.current === 'оба в счёте'
                ? 'оба в счёте'
                : 'оба на очках',
            );
            void juice.sync();
          } else if (grew && payload.caught > caughtRef.current + 1) {
            const racing =
              peerNoteRef.current === 'партнёр впереди' ||
              peerNoteRef.current === 'гонка' ||
              peerNoteRef.current === 'оба в гонке';
            bumpPeerNote(
              peerNoteRef.current === 'гонка' || peerNoteRef.current === 'оба в гонке'
                ? 'оба в гонке'
                : racing
                  ? 'гонка'
                  : 'партнёр впереди',
            );
            void (racing ? juice.sync() : juice.hit());
          }
        }
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id, partnerScale, ringPulse]);

  useEffect(() => {
    if (!pair || !user || params.solo === '1' || forceSolo) return;
    lastHelloAt.current = Date.now();
    sendGameIfPeerLive('orbit-catch', { hello: true, fromId: user.id });
  }, [pair?.code, user?.id, params.solo, forceSolo]);

  const start = () => {
    caughtRef.current = 0;
    partnerRef.current = 0;
    partnerFinishedRef.current = false;
    setSyncFinish(false);
    setFinishDualLabel(null);
    setCaught(0);
    setMisses(0);
    setAttempts(0);
    setPartnerCaught(0);
    setTimeLeft(35);
    setAngle(0);
    setOrbAngle((seedRef.current % 360) * (Math.PI / 180));
    setAligned(false);
    setPhase('playing');
    sendGameIfDuo(forceSoloRef.current, 'orbit-catch', {
      phase: 'start',
      seed: seedRef.current,
      hello: true,
      fromId: user?.id,
    });
    void juice.beat();
  };
  startRef.current = start;

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
    if (peerLive) setPeerSeen(true);
    setForceSolo(soloAgain);
    forceSoloRef.current = soloAgain;
    lastRematchAt.current = Date.now();
    sendGameIfDuo(forceSoloRef.current, 'orbit-catch', { rematch: true, seed: next, hello: true });
    bumpPeerNote(soloAgain ? 'ещё · соло' : 'ещё раунд');
    setTimeout(() => startRef.current(), 0);
  };

  useEffect(() => {
    if (params.solo === '1' || forceSolo) return;
    const at = Number(params.startAt);
    if (!Number.isFinite(at)) return;
    const delay = Math.max(0, at - Date.now());
    if (delay < 400) {
      lateStartAt.current = Date.now();
      bumpPeerNote('догоняем');
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
            bumpPeerNote(`старт ${sec}`);
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

  useEffect(() => {
    if (phase !== 'playing') return;
    const ROUND_SEC = 35;
    const endAt = Date.now() + ROUND_SEC * 1000;
    let finished = false;
    setTimeLeft(ROUND_SEC);

    const finishRound = () => {
      if (finished) return;
      finished = true;
      if (partnerFinishedRef.current && params.solo !== '1' && !forceSoloRef.current) {
        const racing =
          peerNoteRef.current === 'оба финиш' || peerNoteRef.current === 'оба на финише';
        const dual = racing ? 'Оба на финише' : 'Оба финиш';
        setFinishDualLabel(dual);
        setSyncFinish(true);
        bumpPeerNote(racing ? 'оба на финише' : 'оба финиш');
        void juice.perfect();
      }
      setPhase('finished');
      void juice.postMatch();
      sendGameIfDuo(forceSoloRef.current, 'orbit-catch', {
        phase: 'finished',
        caught: caughtRef.current,
      });
      // Demo scores only in solo / forceSolo — never invent partner catches while duo is live.
      if (partnerRef.current === 0 && (params.solo === '1' || forceSoloRef.current)) {
        const demo = Math.max(0, caughtRef.current - 1 + Math.floor(Math.random() * 3));
        partnerRef.current = demo;
        setPartnerCaught(demo);
      }
      const coop = caughtRef.current + partnerRef.current;
      const mem = addMemory({
        kind: 'orbit',
        title: 'Orbit Catch',
        detail:
          params.solo === '1' || forceSoloRef.current
            ? `Solo demo · co-op ${coop}`
            : partnerFinishedRef.current
              ? `Оба финиш · co-op ${coop}`
              : partnerRef.current > 0
                ? `Ты ${caughtRef.current} · партнёр ${partnerRef.current}`
                : `Ты ${caughtRef.current} · ждём партнёра`,
      });
      broadcastMemory(mem, user);
      setTimeLeft(0);
    };

    // 50ms = orbit motion; wall-clock = real seconds
    const tick = setInterval(() => {
      setAngle((a) => a + speed);
      setOrbAngle((oa) => oa + speed * 1.35);
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(tick);
        finishRound();
      }
    }, 50);
    return () => clearInterval(tick);
  }, [phase, speed, addMemory, user, params.solo]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const diff = Math.abs(Math.sin(angle - orbAngle));
    const next = diff < 0.22;
    alignedRef.current = next;
    setAligned(next);
  }, [angle, orbAngle, phase]);

  useEffect(() => {
    ringPulse.value = withTiming(aligned ? 1.04 : 1, { duration: 120 });
    if (aligned && phase === 'playing') {
      const now = Date.now();
      if (now - lastAlignSend.current > 700) {
        lastAlignSend.current = now;
        sendGameIfDuo(forceSoloRef.current, 'orbit-catch', { align: true });
      }
    }
  }, [aligned, ringPulse, phase]);

  const onCatch = () => {
    if (phase !== 'playing') return;
    setAttempts((a) => a + 1);
    const diff = Math.abs(Math.sin(angle - orbAngle));
    if (diff < 0.22) {
      caughtRef.current += 1;
      setCaught(caughtRef.current);
      lastCatchAt.current = Date.now();
      sendGameIfDuo(forceSoloRef.current, 'orbit-catch', { caught: caughtRef.current });
      void juice.catch();
      flash.value = withSequence(
        withTiming(1, { duration: 40 }),
        withTiming(0, { duration: 280 }),
      );
      setOrbAngle(orbAngle + Math.PI * (0.6 + (seedRef.current % 5) * 0.08));
      setAligned(false);
      if (caughtRef.current === partnerRef.current && caughtRef.current > 0) {
        setTimeout(() => {
          bumpPeerNote('оба на очках');
          void juice.sync();
        }, 320);
      } else if (caughtRef.current > partnerRef.current + 1) {
        setTimeout(() => {
          const racing =
            peerNoteRef.current === 'я впереди' ||
            peerNoteRef.current === 'гонка' ||
            peerNoteRef.current === 'оба в гонке';
          bumpPeerNote(
            peerNoteRef.current === 'гонка' || peerNoteRef.current === 'оба в гонке'
              ? 'оба в гонке'
              : racing
                ? 'гонка'
                : 'я впереди',
          );
          void (racing ? juice.sync() : juice.hit());
        }, 320);
      }
    } else {
      setMisses((m) => m + 1);
      lastMissAt.current = Date.now();
      void juice.miss();
      sendGameIfDuo(forceSoloRef.current, 'orbit-catch', { miss: true });
      flash.value = withSpring(0);
    }
  };

  const team = caught + partnerCaught;
  const line = pickPostMatchLine(
    caught,
    partnerCaught || 1,
    matchSeed,
    params.solo === '1' || forceSolo,
  );
  const px = CX + Math.cos(angle) * R;
  const py = CY + Math.sin(angle) * R;
  const ox = CX + Math.cos(orbAngle) * (R * 0.72);
  const oy = CY + Math.sin(orbAngle) * (R * 0.72);

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flash.value * 0.35,
  }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringPulse.value }],
    borderColor: aligned ? 'rgba(226,176,122,0.7)' : 'rgba(226,176,122,0.22)',
  }));
  const partnerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: partnerScale.value }],
  }));

  if (phase === 'finished') {
    return (
      <LpdBackground mood="warm">
        <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.title}>Orbit Catch</Text>
          <Text style={styles.meta}>
            Ты {caught} · Партнёр {partnerCaught}
            {params.solo === '1' || forceSolo
              ? ' · demo'
              : partnerCaught > 0
                ? ` · вместе ${team}${peerSeen ? ' · live' : ''}`
                : ' · ждём партнёра'}
          </Text>
          <PostMatchCard
            title={params.solo === '1' || forceSolo ? 'Solo demo' : 'Орбита закрыта'}
            gameId="orbit-catch"
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
              announceLeaveMatch('orbit-catch', user, seedRef.current);
              router.replace({ pathname: '/game/lobby', params: { game: 'orbit-catch' } });
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
          <Text style={styles.title}>Orbit Catch · co-op</Text>
          <Pressable
            onPress={() => {
              void confirmLeaveMatch(phase === 'playing').then((ok) => {
                if (!ok) return;
                announceLeaveMatch('orbit-catch', user, seedRef.current);
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
                ? 'Орбита · соло demo'
                : 'Ловите орбиту'}
            </Text>
            <Text style={styles.body}>
              {params.solo === '1' || forceSolo
                ? 'Жми, когда янтарный маркер совпадает с розовым орбом. Счёт партнёра здесь demo — не co-op пары.'
                : 'Жми, когда янтарный маркер совпадает с розовым орбом. Очки пары складываются.'}
              {waitingSyncedStart
                ? ' Синхронный старт с лобби — не жми раньше партнёра.'
                : params.solo !== '1' && !forceSolo && !peerSeen
                  ? ' Ждём партнёра на орбите…'
                  : ''}
            </Text>
            {waitingSyncedStart ? (
              <Text style={styles.meta}>
                {syncedStartCountdownLabel(params.startAt, peerNote)}
              </Text>
            ) : (
              <Pressable onPress={start} style={styles.btn}>
                <Text style={styles.btnLabel}>Старт</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <>
            <View style={styles.hud}>
              <Text style={styles.stat}>{timeLeft}s</Text>
              <Text style={styles.stat}>ты {caught}</Text>
              <Text style={styles.stat}>
                {caught}✓/{misses}✗
                {attempts > 0 ? ` · ${Math.round((caught / attempts) * 100)}%` : ''}
              </Text>
              <Animated.Text
                style={[styles.stat, partnerFlash && styles.partnerHot, partnerStyle]}
              >
                {params.solo === '1' || forceSolo ? (
                  <>
                    партнёр · demo
                    {peerNote ? ` · ${peerNote}` : ''}
                  </>
                ) : (
                  <>
                    партнёр {partnerCaught}
                    {peerNote ? ` · ${peerNote}` : ''}
                  </>
                )}
              </Animated.Text>
            </View>
            <Pressable style={styles.stage} onPress={onCatch}>
              <View style={styles.board}>
                <Animated.View style={[styles.ring, ringStyle]} />
                <Animated.View style={[styles.flash, flashStyle]} />
                <View
                  style={[
                    styles.mark,
                    aligned && styles.markHot,
                    { left: px - 8, top: py - 8 },
                  ]}
                />
                <View
                  style={[
                    styles.orb,
                    aligned && styles.orbHot,
                    { left: ox - 12, top: oy - 12 },
                  ]}
                />
              </View>
              <Text style={[styles.hint, aligned && styles.hintHot]}>
                {aligned
                  ? `СЕЙЧАС · Δ${Math.abs(Math.sin(angle - orbAngle)).toFixed(2)}`
                  : `TAP в совпадении · Δ${Math.abs(Math.sin(angle - orbAngle)).toFixed(2)}`}
              </Text>
            </Pressable>
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
    gap: spacing.sm,
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
  hud: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  stat: { fontFamily: fonts.uiMedium, color: colors.textSecondary, fontSize: 13 },
  partnerHot: { color: colors.accentRose, fontFamily: fonts.uiSemi },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  board: {
    width: SIZE,
    height: SIZE,
    position: 'relative',
  },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: SIZE / 2,
    borderWidth: 1.5,
  },
  flash: {
    ...StyleSheet.absoluteFill,
    borderRadius: SIZE / 2,
    backgroundColor: colors.accentAmber,
  },
  mark: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accentAmber,
  },
  markHot: {
    shadowColor: colors.accentAmber,
    shadowOpacity: 1,
    shadowRadius: 12,
    transform: [{ scale: 1.15 }],
  },
  orb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentRose,
    shadowColor: colors.accentRose,
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  orbHot: {
    shadowOpacity: 1,
    shadowRadius: 16,
  },
  hint: {
    fontFamily: fonts.ui,
    color: colors.textMuted,
  },
  hintHot: {
    color: colors.accentAmber,
    fontFamily: fonts.uiSemi,
    letterSpacing: 1.5,
  },
  meta: { fontFamily: fonts.ui, color: colors.textSecondary, marginBottom: spacing.sm },
});
