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
import { juice } from '../../src/audio/juice';
import { useMemories } from '../../src/store/MemoriesStore';

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
  const seed = Number(params.seed) || 11;

  const [phase, setPhase] = useState<Phase>('ready');
  const [angle, setAngle] = useState(0);
  const [orbAngle, setOrbAngle] = useState(0);
  const [caught, setCaught] = useState(0);
  const [partnerCaught, setPartnerCaught] = useState(0);
  const [timeLeft, setTimeLeft] = useState(35);
  const [aligned, setAligned] = useState(false);
  const [partnerFlash, setPartnerFlash] = useState(false);
  const [peerNote, setPeerNote] = useState<string | null>(null);
  const [peerSeen, setPeerSeen] = useState(false);
  const [matchSeed, setMatchSeed] = useState(seed);
  const [syncFinish, setSyncFinish] = useState(false);
  const caughtRef = useRef(0);
  const partnerRef = useRef(0);
  const partnerFinishedRef = useRef(false);
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

  const speed = useMemo(() => 0.045 + (matchSeed % 7) * 0.004, [matchSeed]);

  const bumpPeerNote = (text: string) => {
    setPeerNote(text);
    if (peerNoteTimer.current) clearTimeout(peerNoteTimer.current);
    peerNoteTimer.current = setTimeout(() => setPeerNote(null), 1000);
  };

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
        setPeerSeen(false);
        bumpPeerNote('вышел');
        void juice.miss();
        return;
      }
      if (msg.type === 'peer_joined') {
        setPeerSeen(true);
        bumpPeerNote('вернулся');
        void juice.sync();
        lastHelloAt.current = Date.now();
        pairRealtime.sendGame('orbit-catch', { hello: true, fromId: user.id });
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
        } | undefined;
        if (payload?.hello || payload?.phase === 'start') {
          setPeerSeen(true);
          if (payload?.hello) {
            const both = Date.now() - lastHelloAt.current < 2500;
            bumpPeerNote(both ? 'оба в игре' : 'в игре');
            void (both ? juice.perfect() : juice.sync());
            return;
          }
          if (payload?.phase === 'start' && Date.now() - lateStartAt.current < 2500) {
            bumpPeerNote('оба догоняют');
            void juice.perfect();
          }
        }
        if (payload?.rematch && typeof payload.seed === 'number') {
          setPeerSeen(true);
          setMatchSeed(payload.seed);
          seedRef.current = payload.seed;
          const both = Date.now() - lastRematchAt.current < 2500;
          bumpPeerNote(both ? 'оба ещё раунд' : 'ещё раунд');
          void (both ? juice.perfect() : juice.sync());
          startRef.current();
          return;
        }
        if (payload?.phase === 'finished') {
          partnerFinishedRef.current = true;
          if (typeof payload.caught === 'number') {
            partnerRef.current = payload.caught;
            setPartnerCaught(payload.caught);
          }
          if (phaseRef.current === 'finished') {
            setSyncFinish(true);
            bumpPeerNote('оба финиш');
            void juice.perfect();
          } else {
            bumpPeerNote('финиш');
            void juice.sync();
          }
          return;
        }
        if (payload?.miss) {
          const both = Date.now() - lastMissAt.current < 900;
          bumpPeerNote(both ? 'оба miss' : 'промах');
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
          bumpPeerNote(alignedRef.current ? 'sync align' : 'align');
          ringPulse.value = withSequence(
            withTiming(1.08, { duration: 90 }),
            withTiming(1, { duration: 220 }),
          );
          void (alignedRef.current ? juice.perfect() : juice.hit());
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
            bumpPeerNote('оба catch');
            void juice.perfect();
            if (payload.caught === caughtRef.current && caughtRef.current > 0) {
              setTimeout(() => {
                bumpPeerNote('оба на очках');
                void juice.sync();
              }, 380);
            }
          } else if (payload.caught === caughtRef.current && caughtRef.current > 0) {
            bumpPeerNote('оба на очках');
            void juice.sync();
          }
        }
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id, partnerScale, ringPulse]);

  useEffect(() => {
    if (!pair || !user || params.solo === '1') return;
    lastHelloAt.current = Date.now();
    pairRealtime.sendGame('orbit-catch', { hello: true, fromId: user.id });
  }, [pair?.code, user?.id, params.solo]);

  const start = () => {
    caughtRef.current = 0;
    partnerRef.current = 0;
    partnerFinishedRef.current = false;
    setSyncFinish(false);
    setCaught(0);
    setPartnerCaught(0);
    setTimeLeft(35);
    setAngle(0);
    setOrbAngle((seedRef.current % 360) * (Math.PI / 180));
    setAligned(false);
    setPhase('playing');
    pairRealtime.sendGame('orbit-catch', {
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
    lastRematchAt.current = Date.now();
    pairRealtime.sendGame('orbit-catch', { rematch: true, seed: next, hello: true });
    start();
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
    const tick = setInterval(() => {
      setAngle((a) => a + speed);
      setOrbAngle((oa) => oa + speed * 1.35);
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(tick);
          if (partnerFinishedRef.current) {
            setSyncFinish(true);
            bumpPeerNote('оба финиш');
            void juice.perfect();
          }
          setPhase('finished');
          void juice.postMatch();
          pairRealtime.sendGame('orbit-catch', {
            phase: 'finished',
            caught: caughtRef.current,
          });
          if (partnerRef.current === 0) {
            setPartnerCaught(Math.max(0, caughtRef.current - 1 + Math.floor(Math.random() * 3)));
          }
          addMemory({
            kind: 'orbit',
            title: 'Orbit Catch',
            detail: partnerFinishedRef.current
              ? `Оба финиш · co-op ${caughtRef.current + partnerRef.current}`
              : `Co-op ${caughtRef.current + partnerRef.current} catches`,
          });
          return 0;
        }
        return t - 1;
      });
    }, 50);
    return () => clearInterval(tick);
  }, [phase, speed, addMemory]);

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
        pairRealtime.sendGame('orbit-catch', { align: true });
      }
    }
  }, [aligned, ringPulse, phase]);

  const onCatch = () => {
    if (phase !== 'playing') return;
    const diff = Math.abs(Math.sin(angle - orbAngle));
    if (diff < 0.22) {
      caughtRef.current += 1;
      setCaught(caughtRef.current);
      lastCatchAt.current = Date.now();
      pairRealtime.sendGame('orbit-catch', { caught: caughtRef.current });
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
      }
    } else {
      lastMissAt.current = Date.now();
      void juice.miss();
      pairRealtime.sendGame('orbit-catch', { miss: true });
      flash.value = withSpring(0);
    }
  };

  const team = caught + partnerCaught;
  const line = pickPostMatchLine(caught, partnerCaught || 1, matchSeed);
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
            Ты {caught} · Партнёр {partnerCaught} · вместе {team}
          </Text>
          <PostMatchCard
            title="Орбита закрыта"
            gameId="orbit-catch"
            winnerLabel={syncFinish ? 'Оба финиш' : undefined}
            line={line.text}
            onRematch={rematch}
            onHome={() => router.replace({ pathname: '/game/lobby', params: { game: 'orbit-catch' } })}
          />
        </View>
      </LpdBackground>
    );
  }

  return (
    <LpdBackground mood="rain">
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.title}>Orbit Catch · co-op</Text>
        {phase === 'ready' ? (
          <View style={styles.ready}>
            <Text style={styles.hero}>Ловите орбиту</Text>
            <Text style={styles.body}>
              Жми, когда янтарный маркер совпадает с розовым орбом. Очки пары складываются.
              {params.solo !== '1' && !peerSeen ? ' Ждём партнёра на орбите…' : ''}
            </Text>
            <Pressable onPress={start} style={styles.btn}>
              <Text style={styles.btnLabel}>Старт</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.hud}>
              <Text style={styles.stat}>{timeLeft}s</Text>
              <Text style={styles.stat}>ты {caught}</Text>
              <Animated.Text
                style={[styles.stat, partnerFlash && styles.partnerHot, partnerStyle]}
              >
                партнёр {partnerCaught}
                {peerNote ? ` · ${peerNote}` : ''}
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
                {aligned ? 'СЕЙЧАС' : 'TAP в совпадении'}
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
  hud: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { fontFamily: fonts.uiMedium, color: colors.textSecondary },
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
