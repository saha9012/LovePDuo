import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  createSkySpawner,
  scoreCatch,
  SkyObject,
  skyClaimConfig,
  spawnIntervalMs,
} from '../../src/games/skyClaim';
import { pickPostMatchLine } from '../../src/content/postMatch';
import { useApp } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { sendGameIfPeerLive } from '../../src/realtime/sendGameIfPeerLive';
import { announceLeaveMatch } from '../../src/realtime/leaveMatch';
import { consumeMatchSession } from '../../src/realtime/matchSession';
import { juice } from '../../src/audio/juice';
import { confirmLeaveMatch } from '../../src/utils/confirmLeaveMatch';
import { useMemories } from '../../src/store/MemoriesStore';
import { broadcastMemory } from '../../src/memories/broadcastMemory';
import { useSyncedStartWaiting, syncedStartCountdownLabel } from '../../src/game/syncedStart';

type Phase = 'ready' | 'playing' | 'finished';

export default function SkyClaimScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, pair } = useApp();
  const { addMemory } = useMemories();
  const params = useLocalSearchParams<{ seed?: string; startAt?: string; solo?: string }>();
  const waitingSyncedStart = useSyncedStartWaiting(params.solo, params.startAt);
  const initialSeed = useMemo(() => {
    const session = consumeMatchSession('sky-claim');
    const fromParam = Number(params.seed);
    if (Number.isFinite(fromParam) && fromParam > 0) return fromParam;
    if (session) return session.seed;
    return Date.now() % 100000;
  }, [params.seed]);
  const [matchSeed, setMatchSeed] = useState(initialSeed);
  const spawner = useMemo(() => createSkySpawner(matchSeed), [matchSeed]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [objects, setObjects] = useState<SkyObject[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [layoutReady, setLayoutReady] = useState(false);
  const [timeLeft, setTimeLeft] = useState(skyClaimConfig.durationSec);
  const [partnerScore, setPartnerScore] = useState(0);
  const [partnerLive, setPartnerLive] = useState(false);
  const [forceSolo, setForceSolo] = useState(params.solo === '1');
  const [flash, setFlash] = useState<string | null>(null);
  const [partnerFlash, setPartnerFlash] = useState(false);
  const [peerNote, setPeerNote] = useState<string | null>(null);
  const [syncFinish, setSyncFinish] = useState(false);
  const [finishDualLabel, setFinishDualLabel] = useState<'Оба финиш' | 'Оба на финише' | null>(
    null,
  );
  const peerNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPresence = useRef(pair?.partnerPresence);
  const size = useRef({ w: 1, h: 1 });
  const comboRef = useRef(0);
  const scoreRef = useRef(0);
  const partnerLiveRef = useRef(false);
  const partnerScoreRef = useRef(0);
  const forceSoloRef = useRef(params.solo === '1');
  const partnerFinishedRef = useRef(false);
  const flashRef = useRef<string | null>(null);
  const peerNoteRef = useRef<string | null>(null);
  const timeLeftRef = useRef(skyClaimConfig.durationSec);
  const seedRef = useRef(initialSeed);
  const startRef = useRef<() => void>(() => undefined);
  const phaseRef = useRef<Phase>('ready');
  const lastRematchAt = useRef(0);
  const lastHelloAt = useRef(0);
  const lateStartAt = useRef(0);
  const partnerScale = useSharedValue(1);

  useEffect(() => {
    seedRef.current = matchSeed;
  }, [matchSeed]);

  useEffect(() => {
    flashRef.current = flash;
  }, [flash]);

  useEffect(() => {
    partnerScoreRef.current = partnerScore;
  }, [partnerScore]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    forceSoloRef.current = forceSolo;
  }, [forceSolo]);

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
      bumpPeerNote(
        peerNoteRef.current === 'offline' ||
          peerNoteRef.current === 'online' ||
          peerNoteRef.current === 'оба на связи'
          ? 'оба на связи'
          : 'online',
      );
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
        if (phaseRef.current === 'playing' || phaseRef.current === 'finished') {
          setForceSolo(true);
          forceSoloRef.current = true;
          bumpPeerNote('вышел · соло');
        } else {
          bumpPeerNote('вышел');
        }
        void juice.miss();
        return;
      }
      if (msg.type === 'peer_joined') {
        setPartnerLive(true);
        partnerLiveRef.current = true;
        setForceSolo(false);
        forceSoloRef.current = false;
        bumpPeerNote(
          peerNoteRef.current === 'вышел' ||
            peerNoteRef.current === 'вышел · соло' ||
            peerNoteRef.current === 'вернулся' ||
            peerNoteRef.current === 'оба снова здесь'
            ? 'оба снова здесь'
            : 'вернулся',
        );
        void juice.sync();
        lastHelloAt.current = Date.now();
        sendGameIfPeerLive('sky-claim', { hello: true, fromId: user.id });
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'sky-claim') {
        const payload = msg.payload as {
          score?: number;
          phase?: string;
          rematch?: boolean;
          seed?: number;
          miss?: boolean;
          decoy?: boolean;
          combo?: number;
          hello?: boolean;
          leaveMatch?: boolean;
          fromId?: string;
        } | undefined;
        if (payload?.leaveMatch && payload.fromId !== user.id) {
          setPartnerLive(false);
          partnerLiveRef.current = false;
          setForceSolo(true);
          forceSoloRef.current = true;
          bumpPeerNote('соло');
          void juice.miss();
          return;
        }
        if (payload?.hello) {
          setPartnerLive(true);
          partnerLiveRef.current = true;
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
        if (payload?.phase === 'start') {
          setPartnerLive(true);
          partnerLiveRef.current = true;
          if (Date.now() - lateStartAt.current < 2500) {
            bumpPeerNote(
              peerNoteRef.current === 'оба догоняют' || peerNoteRef.current === 'оба в старте'
                ? 'оба в старте'
                : 'оба догоняют',
            );
            void juice.perfect();
          }
        }
        if (payload?.rematch && typeof payload.seed === 'number') {
          setPartnerLive(true);
          partnerLiveRef.current = true;
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
        if (payload?.miss || payload?.decoy) {
          const kind = payload.decoy ? 'decoy' : 'miss';
          const both =
            flashRef.current === kind ||
            peerNoteRef.current === `оба ${kind}` ||
            peerNoteRef.current === 'оба мимо' ||
            peerNoteRef.current === 'оба decoy синх';
          const racing =
            peerNoteRef.current === `оба ${kind}` ||
            peerNoteRef.current === 'оба мимо' ||
            peerNoteRef.current === 'оба decoy синх';
          bumpPeerNote(
            both
              ? racing
                ? kind === 'decoy'
                  ? 'оба decoy синх'
                  : 'оба мимо'
                : kind === 'decoy'
                  ? 'оба decoy'
                  : 'оба miss'
              : kind,
          );
          setPartnerFlash(true);
          partnerScale.value = withSequence(
            withSpring(0.94, { damping: 10 }),
            withTiming(1, { duration: 200 }),
          );
          setTimeout(() => setPartnerFlash(false), 420);
          void (both ? juice.sync() : payload.decoy ? juice.decoy() : juice.miss());
          return;
        }
        if (typeof payload?.combo === 'number' && payload.combo > 0) {
          const both = comboRef.current >= 5;
          const racing =
            both &&
            (peerNoteRef.current?.startsWith('оба combo') ||
              peerNoteRef.current === 'оба в комбо');
          bumpPeerNote(
            racing
              ? 'оба в комбо'
              : both
                ? `оба combo×${payload.combo}`
                : `combo×${payload.combo}`,
          );
          setPartnerFlash(true);
          partnerScale.value = withSequence(
            withSpring(1.16, { damping: 9 }),
            withTiming(1, { duration: 240 }),
          );
          setTimeout(() => setPartnerFlash(false), 500);
          void juice.perfect();
        }
        if (typeof payload?.score === 'number') {
          setPartnerScore(payload.score);
          setPartnerLive(true);
          partnerLiveRef.current = true;
          setPartnerFlash(true);
          partnerScale.value = withSequence(
            withSpring(1.14, { damping: 10 }),
            withTiming(1, { duration: 220 }),
          );
          setTimeout(() => setPartnerFlash(false), 420);
          if (payload.phase === 'finished' && phaseRef.current === 'playing') {
            partnerFinishedRef.current = true;
            bumpPeerNote('финиш');
            void juice.sync();
          } else if (payload.phase === 'finished' && phaseRef.current === 'finished') {
            partnerFinishedRef.current = true;
            const racing =
              peerNoteRef.current === 'оба финиш' || peerNoteRef.current === 'оба на финише';
            const dual = racing ? 'Оба на финише' : 'Оба финиш';
            setFinishDualLabel(dual);
            setSyncFinish(true);
            bumpPeerNote(racing ? 'оба на финише' : 'оба финиш');
            void juice.perfect();
          } else if (
            !payload.phase &&
            !payload.combo &&
            !payload.miss &&
            !payload.decoy &&
            flashRef.current === 'catch'
          ) {
            bumpPeerNote(
              peerNoteRef.current === 'оба ловят' || peerNoteRef.current === 'оба в небе'
                ? 'оба в небе'
                : 'оба ловят',
            );
            void juice.perfect();
            if (payload.score === scoreRef.current && scoreRef.current > 0) {
              setTimeout(() => {
                bumpPeerNote(
              peerNoteRef.current === 'оба на очках' || peerNoteRef.current === 'оба в счёте'
                ? 'оба в счёте'
                : 'оба на очках',
            );
                void juice.sync();
              }, 380);
            }
          } else if (
            !payload.phase &&
            !payload.miss &&
            !payload.decoy &&
            payload.score === scoreRef.current &&
            scoreRef.current > 0
          ) {
            bumpPeerNote(
              peerNoteRef.current === 'оба на очках' || peerNoteRef.current === 'оба в счёте'
                ? 'оба в счёте'
                : 'оба на очках',
            );
            void juice.sync();
          } else if (
            !payload.phase &&
            !payload.miss &&
            !payload.decoy &&
            phaseRef.current === 'playing' &&
            payload.score > scoreRef.current + 5
          ) {
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
  }, [pair?.code, user?.id, partnerScale]);

  useEffect(() => {
    if (!pair || !user || params.solo === '1') return;
    lastHelloAt.current = Date.now();
    sendGameIfPeerLive('sky-claim', { hello: true, fromId: user.id });
  }, [pair?.code, user?.id, params.solo]);

  const start = () => {
    setPhase('playing');
    setObjects([]);
    setScore(0);
    setCombo(0);
    setHits(0);
    setMisses(0);
    comboRef.current = 0;
    scoreRef.current = 0;
    partnerFinishedRef.current = false;
    setSyncFinish(false);
    setFinishDualLabel(null);
    setTimeLeft(skyClaimConfig.durationSec);
    timeLeftRef.current = skyClaimConfig.durationSec;
    setFlash(null);
    sendGameIfPeerLive('sky-claim', {
      phase: 'start',
      seed: seedRef.current,
      score: 0,
      hello: true,
      fromId: user?.id,
    });
  };

  startRef.current = start;

  const rematch = () => {
    const next = Math.floor(Math.random() * 100000);
    setMatchSeed(next);
    seedRef.current = next;
    const soloAgain = params.solo === '1' || !partnerLiveRef.current;
    setForceSolo(soloAgain);
    forceSoloRef.current = soloAgain;
    lastRematchAt.current = Date.now();
    sendGameIfPeerLive('sky-claim', { rematch: true, seed: next, hello: true });
    setTimeout(() => startRef.current(), 0);
  };

  useEffect(() => {
    if (params.solo === '1') return;
    const at = Number(params.startAt);
    if (!Number.isFinite(at)) return;
    const delay = Math.max(0, at - Date.now());
    if (delay < 400) {
      lateStartAt.current = Date.now();
      bumpPeerNote('догоняем');
      void juice.hit();
      const id = setTimeout(() => startRef.current(), delay);
      return () => clearTimeout(id);
    }
    const ticks: ReturnType<typeof setTimeout>[] = [];
    for (const sec of [3, 2, 1]) {
      const when = delay - sec * 1000;
      if (when > 80) {
        ticks.push(
          setTimeout(() => {
            bumpPeerNote(`старт ${sec}`);
            void juice.hit();
          }, when),
        );
      }
    }
    const id = setTimeout(() => startRef.current(), delay);
    return () => {
      clearTimeout(id);
      ticks.forEach(clearTimeout);
    };
  }, [params.startAt, params.solo]);

  useEffect(() => {
    if (phase !== 'playing') return;
    let spawnTimer: ReturnType<typeof setInterval> | null = null;
    const endAt = Date.now() + skyClaimConfig.durationSec * 1000;
    let lastShownSec = skyClaimConfig.durationSec;
    let lastSyncElapsed = -1;
    let finished = false;

    const scheduleSpawn = (progress: number) => {
      if (spawnTimer) clearInterval(spawnTimer);
      spawnTimer = setInterval(() => {
        const p = 1 - timeLeftRef.current / skyClaimConfig.durationSec;
        setObjects((prev) => [...prev, spawner(p)].slice(-18));
      }, spawnIntervalMs(progress));
    };

    scheduleSpawn(0);

    const finishRound = () => {
      if (finished) return;
      finished = true;
      if (spawnTimer) clearInterval(spawnTimer);
      sendGameIfPeerLive('sky-claim', {
        phase: 'finished',
        score: scoreRef.current,
      });
      // Demo partner score only in solo / forceSolo — never invent while waiting on a live pair.
      if (!partnerLiveRef.current && (params.solo === '1' || forceSoloRef.current)) {
        const partner = Math.max(
          0,
          Math.round(scoreRef.current * (0.72 + Math.random() * 0.5)),
        );
        setPartnerScore(partner);
      }
      if (partnerFinishedRef.current) {
        setSyncFinish(true);
        const racing =
          peerNoteRef.current === 'оба финиш' || peerNoteRef.current === 'оба на финише';
        const dual = racing ? 'Оба на финише' : 'Оба финиш';
        setFinishDualLabel(dual);
        bumpPeerNote(racing ? 'оба на финише' : 'оба финиш');
        void juice.perfect();
      }
      setPhase('finished');
      void juice.postMatch();
      const mem = addMemory({
        kind: 'sky',
        title: 'Sky Claim',
        detail: partnerFinishedRef.current
          ? `Оба финиш · ты ${scoreRef.current}`
          : params.solo === '1' || forceSoloRef.current
            ? `Solo demo · ты ${scoreRef.current}`
            : partnerLiveRef.current
              ? `Ты ${scoreRef.current} · партнёр live`
              : `Ты ${scoreRef.current} · ждём партнёра`,
      });
      broadcastMemory(mem, user);
      setTimeLeft(0);
      timeLeftRef.current = 0;
    };

    // 50ms = physics only; wall-clock drives the real seconds HUD
    const tick = setInterval(() => {
      setObjects((prev) => {
        const next: SkyObject[] = [];
        for (const obj of prev) {
          const y = obj.y + obj.speed * 0.05;
          if (y > 1.12) {
            if (obj.points > 0) {
              comboRef.current = 0;
              setCombo(0);
            }
            continue;
          }
          next.push({ ...obj, y });
        }
        return next;
      });

      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      if (remaining !== lastShownSec) {
        lastShownSec = remaining;
        timeLeftRef.current = remaining;
        setTimeLeft(remaining);
        const elapsed = skyClaimConfig.durationSec - remaining;
        if (elapsed > 0 && elapsed % 5 === 0 && elapsed !== lastSyncElapsed) {
          lastSyncElapsed = elapsed;
          sendGameIfPeerLive('sky-claim', {
            phase: 'playing',
            score: scoreRef.current,
          });
          scheduleSpawn(1 - remaining / skyClaimConfig.durationSec);
        }
      }
      if (remaining <= 0) {
        clearInterval(tick);
        finishRound();
      }
    }, 50);

    return () => {
      if (spawnTimer) clearInterval(spawnTimer);
      clearInterval(tick);
    };
  }, [phase, spawner, addMemory, user, params.solo]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.max(1, e.nativeEvent.layout.width);
    const h = Math.max(1, e.nativeEvent.layout.height);
    size.current = { w, h };
    setLayoutReady(w > 8 && h > 8);
  };

  const onTap = useCallback(
    (x: number, y: number) => {
      if (phase !== 'playing') return;
      const { w, h } = size.current;
      // Ignore taps until field has real layout (avoids nx/ny ≈ garbage on 1×1)
      if (w < 8 || h < 8) return;
      const nx = Math.max(0, Math.min(1, x / w));
      const ny = Math.max(0, Math.min(1, y / h));
      setObjects((prev) => {
        let hit: SkyObject | null = null;
        const rest: SkyObject[] = [];
        for (const obj of prev) {
          if (hit) {
            rest.push(obj);
            continue;
          }
          const dx = obj.x - nx;
          const dy = obj.y - ny;
          if (Math.hypot(dx, dy) <= obj.radius * 1.8) {
            hit = obj;
          } else {
            rest.push(obj);
          }
        }
        if (!hit) {
          comboRef.current = 0;
          setCombo(0);
          setMisses((m) => m + 1);
          setFlash('miss');
          void juice.miss();
          sendGameIfPeerLive('sky-claim', { miss: true, score: scoreRef.current });
          return prev;
        }
        const result = scoreCatch(comboRef.current, hit.points);
        comboRef.current = result.combo;
        scoreRef.current += result.scoreDelta;
        setCombo(result.combo);
        setScore(scoreRef.current);
        if (hit.type !== 'decoy') setHits((n) => n + 1);
        else setMisses((m) => m + 1);
        setFlash(hit.type === 'decoy' ? 'decoy' : 'catch');
        if (hit.type === 'decoy') {
          void juice.decoy();
          sendGameIfPeerLive('sky-claim', { decoy: true, score: scoreRef.current });
        } else if (result.combo > 0 && result.combo % 5 === 0) {
          void juice.perfect();
          sendGameIfPeerLive('sky-claim', {
            score: scoreRef.current,
            combo: result.combo,
          });
        } else {
          void juice.catch();
          sendGameIfPeerLive('sky-claim', { score: scoreRef.current });
        }
        if (
          hit.type !== 'decoy' &&
          partnerLiveRef.current &&
          scoreRef.current === partnerScoreRef.current &&
          scoreRef.current > 0
        ) {
          setTimeout(() => {
            bumpPeerNote(
              peerNoteRef.current === 'оба на очках' || peerNoteRef.current === 'оба в счёте'
                ? 'оба в счёте'
                : 'оба на очках',
            );
            void juice.sync();
          }, 320);
        } else if (
          hit.type !== 'decoy' &&
          partnerLiveRef.current &&
          scoreRef.current > partnerScoreRef.current + 5
        ) {
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
        return rest;
      });
    },
    [phase],
  );

  const line = pickPostMatchLine(score, partnerScore, matchSeed);
  const partnerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: partnerScale.value }],
  }));

  if (phase === 'finished') {
    return (
      <LpdBackground mood="warm">
        <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.hud}>Sky Claim</Text>
          <Text style={styles.scoreline}>
            Ты {score}
            {params.solo === '1' || forceSolo
              ? ` · Партнёр ${partnerScore} · demo`
              : partnerLive
                ? ` · Партнёр ${partnerScore} · live`
                : partnerScore > 0
                  ? ` · Партнёр ${partnerScore}`
                  : ' · ждём партнёра'}
          </Text>
          <PostMatchCard
            title={
              params.solo !== '1' && !forceSolo && !partnerLive && partnerScore === 0
                ? 'Ждём счёт партнёра'
                : score > partnerScore
                  ? 'Ты ведёшь'
                  : score < partnerScore
                    ? 'Партнёр впереди'
                    : 'Синхрон'
            }
            winnerLabel={
              syncFinish ? finishDualLabel ?? 'Оба финиш' : 'Post-match'
            }
            gameId="sky-claim"
            line={line.text}
            onRematch={rematch}
            onHome={() => router.replace({ pathname: '/game/lobby', params: { game: 'sky-claim' } })}
          />
        </View>
      </LpdBackground>
    );
  }

  return (
    <LpdBackground mood="night">
      <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.topHud}>
          <Text style={styles.hud}>Sky Claim</Text>
          <Pressable
            onPress={() => {
              void confirmLeaveMatch(phase === 'playing').then((ok) => {
                if (!ok) return;
                if (phase === 'playing') {
                  announceLeaveMatch('sky-claim', user);
                }
                router.back();
              });
            }}
          >
            <Text style={styles.leave}>Выйти</Text>
          </Pressable>
          <Text style={styles.timer}>{timeLeft}s</Text>
        </View>
        <View style={styles.stats}>
          <Text style={styles.stat}>Очки {score}</Text>
          <Text style={[styles.stat, combo >= 5 && styles.comboHot]}>Комбо ×{combo}</Text>
          <Text style={styles.stat}>
            {hits}✓/{misses}✗
            {hits + misses > 0
              ? ` · ${Math.round((hits / (hits + misses)) * 100)}%`
              : ''}
          </Text>
          <Animated.Text
            style={[
              styles.stat,
              partnerLive && styles.partnerLive,
              partnerFlash && styles.partnerHot,
              partnerStyle,
            ]}
          >
            Партнёр {partnerScore}
            {partnerLive ? ' ·live' : ''}
            {peerNote ? ` · ${peerNote}` : ''}
          </Animated.Text>
        </View>
        {!layoutReady && phase === 'playing' ? (
          <Text style={styles.layoutWait}>Калибровка поля…</Text>
        ) : null}

        {phase === 'ready' ? (
          <View style={styles.ready}>
            <Text style={styles.readyTitle}>Лови огни</Text>
            <Text style={styles.readyBody}>
              Своё поле. Янтарные искры дороже. Обманки штрафуют. ~50 секунд.
              {waitingSyncedStart
                ? ' Синхронный старт с лобби — не жми раньше партнёра.'
                : params.solo !== '1' && !partnerLive
                  ? ' Ждём партнёра в Sky…'
                  : ''}
            </Text>
            {waitingSyncedStart ? (
              <Text style={styles.readyBody}>
                {syncedStartCountdownLabel(params.startAt, peerNote)}
              </Text>
            ) : (
              <Pressable onPress={start} style={styles.startBtn}>
                <Text style={styles.startLabel}>Старт</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <Pressable
            style={styles.field}
            onLayout={onLayout}
            onPress={(e) => onTap(e.nativeEvent.locationX, e.nativeEvent.locationY)}
          >
            {objects.map((obj) => {
              const dim = obj.radius * 2 * size.current.w || 28;
              const color =
                obj.type === 'amber'
                  ? colors.accentAmber
                  : obj.type === 'decoy'
                    ? colors.accentWine
                    : colors.accentRose;
              return (
                <View key={obj.id} style={StyleSheet.absoluteFill} pointerEvents="none">
                  <View
                    style={[
                      styles.trail,
                      {
                        left: `${obj.x * 100}%`,
                        top: `${Math.max(0, (obj.y - 0.08) * 100)}%`,
                        backgroundColor: color,
                        opacity: 0.25,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.orb,
                      {
                        left: `${obj.x * 100}%`,
                        top: `${obj.y * 100}%`,
                        width: dim,
                        height: dim,
                        marginLeft: -(dim / 2),
                        marginTop: -(dim / 2),
                        backgroundColor: color,
                        shadowColor: color,
                      },
                    ]}
                  />
                </View>
              );
            })}
            {flash ? (
              <Text style={styles.flash}>
                {flash === 'catch' ? 'CATCH' : flash === 'decoy' ? 'DECOY' : 'MISS'}
              </Text>
            ) : null}
          </Pressable>
        )}
      </View>
    </LpdBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  topHud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hud: {
    fontFamily: fonts.uiSemi,
    color: colors.textPrimary,
    fontSize: 18,
  },
  leave: {
    fontFamily: fonts.uiMedium,
    color: colors.accentAmber,
    marginHorizontal: spacing.sm,
  },
  timer: {
    fontFamily: fonts.mono,
    color: colors.accentAmber,
    fontSize: 20,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  layoutWait: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  stat: {
    fontFamily: fonts.uiMedium,
    color: colors.textSecondary,
    fontSize: 13,
  },
  comboHot: {
    color: colors.accentAmber,
    fontFamily: fonts.uiSemi,
  },
  partnerLive: {
    color: colors.textSecondary,
  },
  partnerHot: {
    color: colors.accentRose,
    fontFamily: fonts.uiSemi,
  },
  ready: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  readyTitle: {
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.textPrimary,
  },
  readyBody: {
    fontFamily: fonts.ui,
    color: colors.textSecondary,
    lineHeight: 22,
    fontSize: 15,
  },
  startBtn: {
    marginTop: spacing.lg,
    alignSelf: 'flex-start',
    backgroundColor: colors.accentWine,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.35)',
  },
  startLabel: {
    fontFamily: fonts.uiSemi,
    color: colors.textPrimary,
    fontSize: 16,
  },
  field: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(18,16,24,0.55)',
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    shadowOpacity: 0.85,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  trail: {
    position: 'absolute',
    width: 3,
    height: 28,
    marginLeft: -1.5,
    borderRadius: 2,
  },
  flash: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    fontFamily: fonts.uiSemi,
    color: colors.accentAmber,
    letterSpacing: 2,
  },
  scoreline: {
    fontFamily: fonts.uiMedium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
});
