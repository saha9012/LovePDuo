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
  const seed = useMemo(() => {
    const fromParam = Number(params.seed);
    if (Number.isFinite(fromParam) && fromParam > 0) return fromParam;
    const session = consumeMatchSession('sky-claim');
    if (session) return session.seed;
    return Date.now() % 100000;
  }, [params.seed]);
  const spawner = useMemo(() => createSkySpawner(seed), [seed]);

  const [phase, setPhase] = useState<Phase>('ready');
  const [objects, setObjects] = useState<SkyObject[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(skyClaimConfig.durationSec);
  const [partnerScore, setPartnerScore] = useState(0);
  const [partnerLive, setPartnerLive] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const size = useRef({ w: 1, h: 1 });
  const comboRef = useRef(0);
  const scoreRef = useRef(0);
  const partnerLiveRef = useRef(false);
  const timeLeftRef = useRef(skyClaimConfig.durationSec);
  const startRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'game' && msg.gameId === 'sky-claim') {
        const payload = msg.payload as { score?: number; phase?: string } | undefined;
        if (typeof payload?.score === 'number') {
          setPartnerScore(payload.score);
          setPartnerLive(true);
          partnerLiveRef.current = true;
        }
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id]);

  const start = () => {
    setPhase('playing');
    setObjects([]);
    setScore(0);
    setCombo(0);
    comboRef.current = 0;
    scoreRef.current = 0;
    setTimeLeft(skyClaimConfig.durationSec);
    timeLeftRef.current = skyClaimConfig.durationSec;
    setFlash(null);
    setPartnerLive(false);
    partnerLiveRef.current = false;
    pairRealtime.sendGame('sky-claim', { phase: 'start', seed, score: 0 });
  };

  startRef.current = start;

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
          setPhase('finished');
          void juice.postMatch();
          addMemory({
            kind: 'sky',
            title: 'Sky Claim',
            detail: `Ты ${scoreRef.current} · Партнёр ${partnerLiveRef.current ? 'live' : 'demo'}`,
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
        } else if (result.combo > 0 && result.combo % 5 === 0) {
          void juice.perfect();
        } else {
          void juice.catch();
        }
        return rest;
      });
    },
    [phase],
  );

  const line = pickPostMatchLine(score, partnerScore, seed);

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
            winnerLabel="Post-match"
            gameId="sky-claim"
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
      <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.topHud}>
          <Text style={styles.hud}>Sky Claim</Text>
          <Text style={styles.timer}>{timeLeft}s</Text>
        </View>
        <View style={styles.stats}>
          <Text style={styles.stat}>Очки {score}</Text>
          <Text style={[styles.stat, combo >= 5 && styles.comboHot]}>Комбо ×{combo}</Text>
          <Text style={styles.stat}>
            Партнёр {partnerScore}
            {partnerLive ? '·live' : ''}
          </Text>
        </View>

        {phase === 'ready' ? (
          <View style={styles.ready}>
            <Text style={styles.readyTitle}>Лови огни</Text>
            <Text style={styles.readyBody}>
              Своё поле. Янтарные искры дороже. Обманки штрафуют. ~50 секунд.
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
