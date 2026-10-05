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
import { consumeMatchSession } from '../../src/realtime/matchSession';
import { juice } from '../../src/audio/juice';
import { useMemories } from '../../src/store/MemoriesStore';

type Phase = 'ready' | 'playing' | 'finished';

export default function SkyClaimScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, pair } = useApp();
  const { addMemory } = useMemories();
  const params = useLocalSearchParams<{ seed?: string; startAt?: string; solo?: string }>();
  const initialSeed = useMemo(() => {
    const fromParam = Number(params.seed);
    if (Number.isFinite(fromParam) && fromParam > 0) return fromParam;
    const session = consumeMatchSession('sky-claim');
    if (session) return session.seed;
    return Date.now() % 100000;
  }, [params.seed]);
  const [matchSeed, setMatchSeed] = useState(initialSeed);
  const spawner = useMemo(() => createSkySpawner(matchSeed), [matchSeed]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [objects, setObjects] = useState<SkyObject[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(skyClaimConfig.durationSec);
  const [partnerScore, setPartnerScore] = useState(0);
  const [partnerLive, setPartnerLive] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [partnerFlash, setPartnerFlash] = useState(false);
  const [peerNote, setPeerNote] = useState<string | null>(null);
  const [syncFinish, setSyncFinish] = useState(false);
  const peerNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPresence = useRef(pair?.partnerPresence);
  const size = useRef({ w: 1, h: 1 });
  const comboRef = useRef(0);
  const scoreRef = useRef(0);
  const partnerLiveRef = useRef(false);
  const partnerFinishedRef = useRef(false);
  const flashRef = useRef<string | null>(null);
  const timeLeftRef = useRef(skyClaimConfig.durationSec);
  const seedRef = useRef(initialSeed);
  const startRef = useRef<() => void>(() => undefined);
  const phaseRef = useRef<Phase>('ready');
  const lastRematchAt = useRef(0);
  const lastHelloAt = useRef(0);
  const partnerScale = useSharedValue(1);

  useEffect(() => {
    seedRef.current = matchSeed;
  }, [matchSeed]);

  useEffect(() => {
    flashRef.current = flash;
  }, [flash]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const bumpPeerNote = (text: string) => {
    setPeerNote(text);
    if (peerNoteTimer.current) clearTimeout(peerNoteTimer.current);
    peerNoteTimer.current = setTimeout(() => setPeerNote(null), 1000);
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
      bumpPeerNote('online');
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
        bumpPeerNote('вышел');
        void juice.miss();
        return;
      }
      if (msg.type === 'peer_joined') {
        setPartnerLive(true);
        partnerLiveRef.current = true;
        bumpPeerNote('вернулся');
        void juice.sync();
        lastHelloAt.current = Date.now();
        pairRealtime.sendGame('sky-claim', { hello: true, fromId: user.id });
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
        } | undefined;
        if (payload?.hello) {
          setPartnerLive(true);
          partnerLiveRef.current = true;
          const both = Date.now() - lastHelloAt.current < 2500;
          bumpPeerNote(both ? 'оба в игре' : 'в игре');
          void (both ? juice.perfect() : juice.sync());
          return;
        }
        if (payload?.phase === 'start') {
          setPartnerLive(true);
          partnerLiveRef.current = true;
        }
        if (payload?.rematch && typeof payload.seed === 'number') {
          setPartnerLive(true);
          partnerLiveRef.current = true;
          setMatchSeed(payload.seed);
          seedRef.current = payload.seed;
          const both = Date.now() - lastRematchAt.current < 2500;
          bumpPeerNote(both ? 'оба ещё раунд' : 'ещё раунд');
          void (both ? juice.perfect() : juice.sync());
          setTimeout(() => startRef.current(), 0);
          return;
        }
        if (payload?.miss || payload?.decoy) {
          const kind = payload.decoy ? 'decoy' : 'miss';
          const both = flashRef.current === kind;
          bumpPeerNote(both ? (kind === 'decoy' ? 'оба decoy' : 'оба miss') : kind);
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
          bumpPeerNote(both ? `оба combo×${payload.combo}` : `combo×${payload.combo}`);
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
            setSyncFinish(true);
            bumpPeerNote('оба финиш');
            void juice.perfect();
          } else if (
            !payload.phase &&
            !payload.combo &&
            !payload.miss &&
            !payload.decoy &&
            flashRef.current === 'catch'
          ) {
            bumpPeerNote('оба ловят');
            void juice.perfect();
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
    pairRealtime.sendGame('sky-claim', { hello: true, fromId: user.id });
  }, [pair?.code, user?.id, params.solo]);

  const start = () => {
    setPhase('playing');
    setObjects([]);
    setScore(0);
    setCombo(0);
    comboRef.current = 0;
    scoreRef.current = 0;
    partnerFinishedRef.current = false;
    setSyncFinish(false);
    setTimeLeft(skyClaimConfig.durationSec);
    timeLeftRef.current = skyClaimConfig.durationSec;
    setFlash(null);
    pairRealtime.sendGame('sky-claim', {
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
    lastRematchAt.current = Date.now();
    pairRealtime.sendGame('sky-claim', { rematch: true, seed: next, hello: true });
    setTimeout(() => startRef.current(), 0);
  };

  useEffect(() => {
    if (params.solo === '1') return;
    const at = Number(params.startAt);
    if (!Number.isFinite(at)) return;
    const delay = Math.max(0, at - Date.now());
    if (delay < 400) {
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

    const scheduleSpawn = (progress: number) => {
      if (spawnTimer) clearInterval(spawnTimer);
      spawnTimer = setInterval(() => {
        const p =
          1 - timeLeftRef.current / skyClaimConfig.durationSec;
        setObjects((prev) => [...prev, spawner(p)].slice(-18));
      }, spawnIntervalMs(progress));
    };

    scheduleSpawn(0);

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
      setTimeLeft((t) => {
        timeLeftRef.current = t - 1;
        if (t <= 1) {
          if (spawnTimer) clearInterval(spawnTimer);
          clearInterval(tick);
          pairRealtime.sendGame('sky-claim', {
            phase: 'finished',
            score: scoreRef.current,
          });
          if (!partnerLiveRef.current) {
            const partner = Math.max(
              0,
              Math.round(scoreRef.current * (0.72 + Math.random() * 0.5)),
            );
            setPartnerScore(partner);
          }
          if (partnerFinishedRef.current) {
            setSyncFinish(true);
            bumpPeerNote('оба финиш');
            void juice.perfect();
          }
          setPhase('finished');
          void juice.postMatch();
          addMemory({
            kind: 'sky',
            title: 'Sky Claim',
            detail: partnerFinishedRef.current
              ? `Оба финиш · ты ${scoreRef.current}`
              : `Ты ${scoreRef.current} · Партнёр ${partnerLiveRef.current ? 'live' : 'demo'}`,
          });
          return 0;
        }
        if (t % 5 === 0) {
          pairRealtime.sendGame('sky-claim', {
            phase: 'playing',
            score: scoreRef.current,
          });
          scheduleSpawn(1 - (t - 1) / skyClaimConfig.durationSec);
        }
        return t - 1;
      });
    }, 50);

    return () => {
      if (spawnTimer) clearInterval(spawnTimer);
      clearInterval(tick);
    };
  }, [phase, spawner]);

  const onLayout = (e: LayoutChangeEvent) => {
    size.current = {
      w: e.nativeEvent.layout.width,
      h: e.nativeEvent.layout.height,
    };
  };

  const onTap = useCallback(
    (x: number, y: number) => {
      if (phase !== 'playing') return;
      const nx = x / size.current.w;
      const ny = y / size.current.h;
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
          setFlash('miss');
          void juice.miss();
          pairRealtime.sendGame('sky-claim', { miss: true, score: scoreRef.current });
          return prev;
        }
        const result = scoreCatch(comboRef.current, hit.points);
        comboRef.current = result.combo;
        scoreRef.current += result.scoreDelta;
        setCombo(result.combo);
        setScore(scoreRef.current);
        setFlash(hit.type === 'decoy' ? 'decoy' : 'catch');
        if (hit.type === 'decoy') {
          void juice.decoy();
          pairRealtime.sendGame('sky-claim', { decoy: true, score: scoreRef.current });
        } else if (result.combo > 0 && result.combo % 5 === 0) {
          void juice.perfect();
          pairRealtime.sendGame('sky-claim', {
            score: scoreRef.current,
            combo: result.combo,
          });
        } else {
          void juice.catch();
          pairRealtime.sendGame('sky-claim', { score: scoreRef.current });
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
            Ты {score} · Партнёр {partnerScore}
            {partnerLive ? ' · live' : ' · demo'}
          </Text>
          <PostMatchCard
            title={score > partnerScore ? 'Ты ведёшь' : score < partnerScore ? 'Партнёр впереди' : 'Синхрон'}
            winnerLabel={syncFinish ? 'Оба финиш' : 'Post-match'}
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
          <Text style={styles.timer}>{timeLeft}s</Text>
        </View>
        <View style={styles.stats}>
          <Text style={styles.stat}>Очки {score}</Text>
          <Text style={[styles.stat, combo >= 5 && styles.comboHot]}>Комбо ×{combo}</Text>
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

        {phase === 'ready' ? (
          <View style={styles.ready}>
            <Text style={styles.readyTitle}>Лови огни</Text>
            <Text style={styles.readyBody}>
              Своё поле. Янтарные искры дороже. Обманки штрафуют. ~50 секунд.
              {params.solo !== '1' && !partnerLive ? ' Ждём партнёра в Sky…' : ''}
            </Text>
            <Pressable onPress={start} style={styles.startBtn}>
              <Text style={styles.startLabel}>Старт</Text>
            </Pressable>
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
  timer: {
    fontFamily: fonts.mono,
    color: colors.accentAmber,
    fontSize: 20,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    fontFamily: fonts.uiMedium,
    color: colors.textSecondary,
    fontSize: 14,
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
