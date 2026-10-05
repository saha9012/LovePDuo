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
import {
  buildHeartbeatChart,
  heartbeatConfig,
  judgeTap,
  judgementScore,
  BeatJudgement,
} from '../../src/games/heartbeat';
import { pickPostMatchLine } from '../../src/content/postMatch';
import { useApp } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { consumeMatchSession } from '../../src/realtime/matchSession';
import { juice } from '../../src/audio/juice';
import { useMemories } from '../../src/store/MemoriesStore';

type Phase = 'ready' | 'playing' | 'finished';

export default function HeartbeatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, pair } = useApp();
  const { addMemory } = useMemories();
  const params = useLocalSearchParams<{ seed?: string; startAt?: string; solo?: string }>();

  const initialSeed = useMemo(() => {
    const fromParam = Number(params.seed);
    if (Number.isFinite(fromParam) && fromParam > 0) return fromParam;
    const session = consumeMatchSession('heartbeat');
    if (session) return session.seed;
    return 3;
  }, [params.seed]);

  const [matchSeed, setMatchSeed] = useState(initialSeed);
  const chart = useMemo(() => buildHeartbeatChart(matchSeed), [matchSeed]);
  const [phase, setPhase] = useState<Phase>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState(0);
  const [syncBonus, setSyncBonus] = useState(0);
  const [last, setLast] = useState<BeatJudgement | null>(null);
  const lastRef = useRef<BeatJudgement | null>(null);
  const [partnerScore, setPartnerScore] = useState(0);
  const [partnerLive, setPartnerLive] = useState(false);
  const startAt = useRef(0);
  const cursor = useRef(0);
  const scoreRef = useRef(0);
  const syncRef = useRef(0);
  const partnerLiveRef = useRef(false);
  const partnerScoreRef = useRef(0);
  const partnerFinishedRef = useRef(false);
  const lastPartnerTapMs = useRef<number | null>(null);
  const lastRematchAt = useRef(0);
  const lastHelloAt = useRef(0);
  const lateStartAt = useRef(0);
  const seedRef = useRef(initialSeed);
  const startRef = useRef<() => void>(() => undefined);
  const phaseRef = useRef<Phase>('ready');
  const padScale = useSharedValue(1);
  const syncGlow = useSharedValue(0);
  const partnerScale = useSharedValue(1);
  const [partnerFlash, setPartnerFlash] = useState(false);
  const [peerNote, setPeerNote] = useState<string | null>(null);
  const [syncFinish, setSyncFinish] = useState(false);
  const peerNoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerNoteRef = useRef<string | null>(null);
  const prevPresence = useRef(pair?.partnerPresence);

  const bumpPeerNote = (text: string, ms = 1000) => {
    peerNoteRef.current = text;
    setPeerNote(text);
    if (peerNoteTimer.current) clearTimeout(peerNoteTimer.current);
    peerNoteTimer.current = setTimeout(() => {
      peerNoteRef.current = null;
      setPeerNote(null);
    }, ms);
  };

  useEffect(() => {
    seedRef.current = matchSeed;
  }, [matchSeed]);

  useEffect(() => {
    lastRef.current = last;
  }, [last]);

  useEffect(() => {
    partnerScoreRef.current = partnerScore;
  }, [partnerScore]);

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
      setPeerNote('offline');
      if (peerNoteTimer.current) clearTimeout(peerNoteTimer.current);
      peerNoteTimer.current = setTimeout(() => setPeerNote(null), 1200);
      void juice.miss();
    } else if ((prev === 'away' || prev === 'offline') && cur === 'online') {
      setPeerNote('online');
      if (peerNoteTimer.current) clearTimeout(peerNoteTimer.current);
      peerNoteTimer.current = setTimeout(() => setPeerNote(null), 1200);
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
        setPeerNote('вышел');
        if (peerNoteTimer.current) clearTimeout(peerNoteTimer.current);
        peerNoteTimer.current = setTimeout(() => setPeerNote(null), 1400);
        void juice.miss();
        return;
      }
      if (msg.type === 'peer_joined') {
        setPartnerLive(true);
        partnerLiveRef.current = true;
        setPeerNote('вернулся');
        if (peerNoteTimer.current) clearTimeout(peerNoteTimer.current);
        peerNoteTimer.current = setTimeout(() => setPeerNote(null), 1400);
        void juice.sync();
        lastHelloAt.current = Date.now();
        pairRealtime.sendGame('heartbeat', { hello: true, fromId: user.id });
        return;
      }
      if (msg.type !== 'game' || msg.gameId !== 'heartbeat') return;
      const payload = msg.payload as {
        total?: number;
        tapAt?: number;
        phase?: string;
        rematch?: boolean;
        seed?: number;
        miss?: boolean;
        judgement?: BeatJudgement;
        hello?: boolean;
        sync?: boolean;
      } | undefined;
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
          1200,
        );
        void (both ? juice.perfect() : juice.sync());
        return;
      }
      if (payload?.phase === 'start') {
        setPartnerLive(true);
        partnerLiveRef.current = true;
        if (Date.now() - lateStartAt.current < 2500) {
          setPeerNote('оба догоняют');
          if (peerNoteTimer.current) clearTimeout(peerNoteTimer.current);
          peerNoteTimer.current = setTimeout(() => setPeerNote(null), 1200);
          void juice.perfect();
        }
      }
      if (payload?.rematch && typeof payload.seed === 'number') {
        setPartnerLive(true);
        partnerLiveRef.current = true;
        setMatchSeed(payload.seed);
        seedRef.current = payload.seed;
        const both = Date.now() - lastRematchAt.current < 2500;
        const racing =
          both &&
          (peerNoteRef.current === 'оба ещё раунд' || peerNoteRef.current === 'оба снова');
        bumpPeerNote(racing ? 'оба снова' : both ? 'оба ещё раунд' : 'ещё раунд', 1200);
        void (both ? juice.perfect() : juice.sync());
        // delay start until chart memo updates
        setTimeout(() => startRef.current(), 0);
        return;
      }
      if (payload?.sync) {
        setPartnerLive(true);
        partnerLiveRef.current = true;
        setPeerNote('sync!');
        if (peerNoteTimer.current) clearTimeout(peerNoteTimer.current);
        peerNoteTimer.current = setTimeout(() => setPeerNote(null), 900);
        syncGlow.value = withSequence(
          withTiming(1, { duration: 80 }),
          withTiming(0, { duration: 420 }),
        );
        void juice.perfect();
        if (typeof payload.total === 'number') {
          setPartnerScore(payload.total);
        }
        return;
      }
      if (payload?.miss) {
        const both = lastRef.current === 'miss';
        setPartnerFlash(true);
        setPeerNote(both ? 'оба miss' : 'промах');
        if (peerNoteTimer.current) clearTimeout(peerNoteTimer.current);
        peerNoteTimer.current = setTimeout(() => setPeerNote(null), 900);
        partnerScale.value = withSequence(
          withSpring(0.94, { damping: 10 }),
          withTiming(1, { duration: 200 }),
        );
        setTimeout(() => setPartnerFlash(false), 400);
        void (both ? juice.sync() : juice.miss());
        return;
      }
      if (payload?.phase === 'finished') {
        partnerFinishedRef.current = true;
        if (typeof payload.total === 'number') {
          setPartnerScore(payload.total);
          setPartnerLive(true);
          partnerLiveRef.current = true;
        }
        if (phaseRef.current === 'finished') {
          setSyncFinish(true);
          bumpPeerNote(
            peerNoteRef.current === 'оба финиш' || peerNoteRef.current === 'оба на финише'
              ? 'оба на финише'
              : 'оба финиш',
            1200,
          );
          void juice.perfect();
        } else {
          bumpPeerNote('финиш', 1200);
          void juice.sync();
        }
        return;
      }
      if (typeof payload?.total === 'number') {
        setPartnerScore(payload.total);
        setPartnerLive(true);
        partnerLiveRef.current = true;
        setPartnerFlash(true);
        const myTotal = scoreRef.current + syncRef.current;
        if (payload.judgement === 'perfect' || payload.judgement === 'great') {
          const both = lastRef.current === payload.judgement;
          setLast(payload.judgement);
          if (both) {
            const racing =
              peerNoteRef.current === `оба ${payload.judgement}` ||
              peerNoteRef.current === 'оба в ритме';
            setPeerNote(racing ? 'оба в ритме' : `оба ${payload.judgement}`);
            peerNoteRef.current = racing ? 'оба в ритме' : `оба ${payload.judgement}`;
            setTimeout(() => {
              peerNoteRef.current = null;
              setPeerNote(null);
            }, 1000);
            void juice.perfect();
            if (payload.total === myTotal && myTotal > 0) {
              setTimeout(() => {
                bumpPeerNote(
              peerNoteRef.current === 'оба на очках' || peerNoteRef.current === 'оба в счёте'
                ? 'оба в счёте'
                : 'оба на очках',
            );
                void juice.sync();
              }, 380);
            }
          } else if (payload.total === myTotal && myTotal > 0) {
            bumpPeerNote(
              peerNoteRef.current === 'оба на очках' || peerNoteRef.current === 'оба в счёте'
                ? 'оба в счёте'
                : 'оба на очках',
            );
            void juice.sync();
          }
        } else if (payload.total === myTotal && myTotal > 0) {
          bumpPeerNote(
            peerNoteRef.current === 'оба на очках' || peerNoteRef.current === 'оба в счёте'
              ? 'оба в счёте'
              : 'оба на очках',
          );
          void juice.sync();
        } else if (payload.total > myTotal + 40 && phaseRef.current === 'playing') {
          const racing =
            peerNoteRef.current === 'партнёр впереди' || peerNoteRef.current === 'гонка';
          bumpPeerNote(racing ? 'гонка' : 'партнёр впереди');
          void (racing ? juice.sync() : juice.hit());
        }
        partnerScale.value = withSequence(
          withSpring(1.12, { damping: 10 }),
          withTiming(1, { duration: 200 }),
        );
        setTimeout(() => setPartnerFlash(false), 400);
      }
      if (typeof payload?.tapAt === 'number') {
        lastPartnerTapMs.current = payload.tapAt;
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id, partnerScale]);

  useEffect(() => {
    if (!pair || !user || params.solo === '1') return;
    lastHelloAt.current = Date.now();
    pairRealtime.sendGame('heartbeat', { hello: true, fromId: user.id });
  }, [pair?.code, user?.id, params.solo]);

  const start = () => {
    setPhase('playing');
    setElapsed(0);
    setScore(0);
    setSyncBonus(0);
    setLast(null);
    setSyncFinish(false);
    cursor.current = 0;
    scoreRef.current = 0;
    syncRef.current = 0;
    partnerFinishedRef.current = false;
    lastPartnerTapMs.current = null;
    startAt.current = Date.now();
    pairRealtime.sendGame('heartbeat', {
      phase: 'start',
      total: 0,
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
    lastRematchAt.current = Date.now();
    pairRealtime.sendGame('heartbeat', { rematch: true, seed: next, hello: true });
    setTimeout(() => startRef.current(), 0);
  };

  useEffect(() => {
    if (params.solo === '1') return;
    const at = Number(params.startAt);
    if (!Number.isFinite(at)) return;
    const delay = Math.max(0, at - Date.now());
    if (delay < 400) {
      lateStartAt.current = Date.now();
      setPeerNote('догоняем');
      if (peerNoteTimer.current) clearTimeout(peerNoteTimer.current);
      peerNoteTimer.current = setTimeout(() => setPeerNote(null), 1200);
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
            setPeerNote(`старт ${sec}`);
            if (peerNoteTimer.current) clearTimeout(peerNoteTimer.current);
            peerNoteTimer.current = setTimeout(() => setPeerNote(null), 900);
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
    const id = setInterval(() => {
      const t = Date.now() - startAt.current;
      setElapsed(t);
      while (
        cursor.current < chart.length &&
        chart[cursor.current].atMs < t - heartbeatConfig.windowGreatMs
      ) {
        cursor.current += 1;
        setLast('miss');
      }
      if (t >= heartbeatConfig.durationMs) {
        clearInterval(id);
        const total = scoreRef.current + syncRef.current;
        pairRealtime.sendGame('heartbeat', { phase: 'finished', total });
        if (!partnerLiveRef.current) {
          const partner = Math.max(
            0,
            Math.round(total * (0.8 + Math.random() * 0.35)),
          );
          setPartnerScore(partner);
        }
        if (partnerFinishedRef.current) {
          setSyncFinish(true);
          bumpPeerNote(
            peerNoteRef.current === 'оба финиш' || peerNoteRef.current === 'оба на финише'
              ? 'оба на финише'
              : 'оба финиш',
          );
          if (peerNoteTimer.current) clearTimeout(peerNoteTimer.current);
          peerNoteTimer.current = setTimeout(() => setPeerNote(null), 1200);
          void juice.perfect();
        }
        setPhase('finished');
        void juice.postMatch();
        addMemory({
          kind: 'heartbeat',
          title: 'Heartbeat Tap',
          detail: partnerFinishedRef.current
            ? `Оба финиш · итог ${total}`
            : `Итог ${total} · sync +${syncRef.current}`,
        });
      } else if (Math.floor(t / 1000) % 4 === 0) {
        pairRealtime.sendGame('heartbeat', {
          phase: 'playing',
          total: scoreRef.current + syncRef.current,
        });
      }
    }, 32);
    return () => clearInterval(id);
  }, [phase, chart]);

  const onTap = () => {
    if (phase !== 'playing') return;
    padScale.value = withSequence(
      withTiming(0.92, { duration: 50 }),
      withSpring(1, { damping: 12, stiffness: 240 }),
    );
    const t = Date.now() - startAt.current;
    const note = chart[cursor.current];
    if (!note) return;
    const delta = t - note.atMs;
    if (Math.abs(delta) > heartbeatConfig.windowGreatMs + 40) {
      setLast('miss');
      void juice.miss();
      pairRealtime.sendGame('heartbeat', { miss: true, judgement: 'miss' });
      return;
    }
    const j = judgeTap(delta);
    const pts = judgementScore(j);
    scoreRef.current += pts;
    setScore(scoreRef.current);
    setLast(j);
    cursor.current += 1;
    pairRealtime.sendGame('heartbeat', {
      tapAt: t,
      total: scoreRef.current + syncRef.current,
      judgement: j,
    });

    const partnerTap = lastPartnerTapMs.current;
    const realSync =
      partnerTap != null && Math.abs(partnerTap - t) <= 120 && j !== 'miss';
    const demoSync =
      !partnerLiveRef.current &&
      j !== 'miss' &&
      Math.abs(delta) < 90 &&
      Math.random() > 0.35;

    if (realSync || demoSync) {
      syncRef.current += 40;
      setSyncBonus(syncRef.current);
      syncGlow.value = withSequence(
        withTiming(1, { duration: 80 }),
        withTiming(0, { duration: 420 }),
      );
      void juice.perfect();
      if (realSync) {
        setPeerNote('sync!');
        if (peerNoteTimer.current) clearTimeout(peerNoteTimer.current);
        peerNoteTimer.current = setTimeout(() => setPeerNote(null), 900);
        pairRealtime.sendGame('heartbeat', {
          sync: true,
          total: scoreRef.current + syncRef.current,
        });
      }
    } else if (
      partnerLiveRef.current &&
      scoreRef.current + syncRef.current === partnerScoreRef.current &&
      partnerScoreRef.current > 0
    ) {
      setTimeout(() => {
        bumpPeerNote(
          peerNoteRef.current === 'оба на очках' || peerNoteRef.current === 'оба в счёте'
            ? 'оба в счёте'
            : 'оба на очках',
        );
        void juice.sync();
      }, 320);
      if (j === 'perfect') void juice.perfect();
      else void juice.hit();
    } else if (
      partnerLiveRef.current &&
      scoreRef.current + syncRef.current > partnerScoreRef.current + 40
    ) {
      setTimeout(() => {
        const racing =
          peerNoteRef.current === 'я впереди' || peerNoteRef.current === 'гонка';
        bumpPeerNote(racing ? 'гонка' : 'я впереди');
        void (racing ? juice.sync() : juice.hit());
      }, 320);
      if (j === 'perfect') void juice.perfect();
      else void juice.hit();
    } else if (j === 'perfect') {
      void juice.perfect();
    } else {
      void juice.hit();
    }
  };

  const total = score + syncBonus;
  const line = pickPostMatchLine(total, partnerScore, matchSeed + (elapsed || 1));
  const beatPulse = Math.sin((elapsed / (60000 / heartbeatConfig.bpm)) * Math.PI * 2);
  const padStyle = useAnimatedStyle(() => ({
    transform: [{ scale: padScale.value }],
  }));
  const syncStyle = useAnimatedStyle(() => ({
    opacity: syncGlow.value * 0.45,
  }));
  const partnerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: partnerScale.value }],
  }));

  if (phase === 'finished') {
    return (
      <LpdBackground mood="warm">
        <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.title}>Heartbeat Tap</Text>
          <Text style={styles.meta}>
            Ты {total} · Партнёр {partnerScore} · sync +{syncBonus}
            {partnerLive ? ' · live' : ' · demo'}
          </Text>
          <PostMatchCard
            title={total >= partnerScore ? 'Ритм твой' : 'Партнёр чувствует лучше'}
            gameId="heartbeat"
            winnerLabel={syncFinish ? 'Оба финиш' : undefined}
            line={line.text}
            onRematch={rematch}
            onHome={() => router.replace({ pathname: '/game/lobby', params: { game: 'heartbeat' } })}
          />
        </View>
      </LpdBackground>
    );
  }

  return (
    <LpdBackground mood="rain">
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.title}>Heartbeat Tap · seed {matchSeed}</Text>
        {phase === 'ready' ? (
          <View style={styles.ready}>
            <Text style={styles.readyTitle}>Чувствуй бит вдвоём</Text>
            <Text style={styles.body}>
              Тапай в ритм. Perfect / Great / Miss. Sync bonus, если почти одновременно с партнёром.
              {params.solo !== '1' && !partnerLive ? ' Ждём партнёра на бите…' : ''}
            </Text>
            <Pressable onPress={start} style={styles.btn}>
              <Text style={styles.btnLabel}>Старт</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.hud}>
              <Text style={styles.stat}>Очки {score}</Text>
              <Text style={styles.stat}>Sync +{syncBonus}</Text>
              <Animated.Text
                style={[styles.stat, partnerFlash && styles.partnerHot, partnerStyle]}
              >
                партнёр {partnerScore}
                {partnerLive ? ' ·live' : ''}
                {peerNote ? ` · ${peerNote}` : ''}
              </Animated.Text>
              <Text style={styles.stat}>
                {Math.max(0, Math.ceil((heartbeatConfig.durationMs - elapsed) / 1000))}s
              </Text>
            </View>
            <View style={styles.stage}>
              <Animated.View style={[styles.syncFlash, syncStyle]} />
              <View
                style={[
                  styles.ring,
                  {
                    transform: [{ scale: 1 + beatPulse * 0.08 }],
                    borderColor:
                      last === 'perfect'
                        ? colors.success
                        : last === 'great'
                          ? colors.accentAmber
                          : last === 'miss'
                            ? colors.danger
                            : colors.accentRose,
                  },
                ]}
              />
              <Text style={styles.judgement}>{last?.toUpperCase() ?? 'TAP'}</Text>
            </View>
            <Animated.View style={padStyle}>
              <Pressable onPress={onTap} style={styles.pad}>
                <Text style={styles.padLabel}>TAP</Text>
              </Pressable>
            </Animated.View>
          </>
        )}
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
  title: {
    fontFamily: fonts.uiSemi,
    color: colors.textPrimary,
    fontSize: 18,
  },
  ready: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  readyTitle: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fonts.ui,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  btn: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: colors.accentWine,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.35)',
  },
  btnLabel: {
    fontFamily: fonts.uiSemi,
    color: colors.textPrimary,
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    fontFamily: fonts.uiMedium,
    color: colors.textSecondary,
  },
  partnerHot: {
    color: colors.accentRose,
    fontFamily: fonts.uiSemi,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncFlash: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.accentMist,
  },
  ring: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
  },
  judgement: {
    position: 'absolute',
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.textPrimary,
  },
  pad: {
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: 'rgba(227,154,160,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(227,154,160,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  padLabel: {
    fontFamily: fonts.uiSemi,
    letterSpacing: 3,
    color: colors.accentRose,
    fontSize: 18,
  },
  meta: {
    fontFamily: fonts.ui,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
});
