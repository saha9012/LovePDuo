import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { PostMatchCard } from '../../src/components/PostMatchCard';
import { colors, fonts, spacing } from '../../src/theme/tokens';
import { pickPostMatchLine } from '../../src/content/postMatch';
import { useApp } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { juice } from '../../src/audio/juice';
import { useMemories } from '../../src/store/MemoriesStore';

type Phase = 'ready' | 'playing' | 'finished';

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
  const caughtRef = useRef(0);
  const partnerRef = useRef(0);
  const startRef = useRef<() => void>(() => undefined);

  const speed = useMemo(() => 0.045 + (seed % 7) * 0.004, [seed]);

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'game' && msg.gameId === 'orbit-catch') {
        const payload = msg.payload as { caught?: number } | undefined;
        if (typeof payload?.caught === 'number') {
          partnerRef.current = payload.caught;
          setPartnerCaught(payload.caught);
        }
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id]);

  const start = () => {
    caughtRef.current = 0;
    partnerRef.current = 0;
    setCaught(0);
    setPartnerCaught(0);
    setTimeLeft(35);
    setAngle(0);
    setOrbAngle((seed % 360) * (Math.PI / 180));
    setPhase('playing');
    pairRealtime.sendGame('orbit-catch', { phase: 'start', seed });
    void juice.beat();
  };
  startRef.current = start;

  useEffect(() => {
    if (params.solo === '1') return;
    const at = Number(params.startAt);
    if (!Number.isFinite(at)) return;
    const id = setTimeout(() => startRef.current(), Math.max(0, at - Date.now()));
    return () => clearTimeout(id);
  }, [params.startAt, params.solo]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const tick = setInterval(() => {
      setAngle((a) => a + speed);
      setOrbAngle((a) => a + speed * 1.35);
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(tick);
          setPhase('finished');
          void juice.postMatch();
          if (partnerRef.current === 0) {
            setPartnerCaught(Math.max(0, caughtRef.current - 1 + Math.floor(Math.random() * 3)));
          }
          addMemory({
            kind: 'sky',
            title: 'Orbit Catch',
            detail: `Co-op ${caughtRef.current + partnerRef.current} catches`,
          });
          return 0;
        }
        return t - 1;
      });
    }, 50);
    return () => clearInterval(tick);
  }, [phase, speed, addMemory]);

  const onCatch = () => {
    if (phase !== 'playing') return;
    const diff = Math.abs(Math.sin(angle - orbAngle));
    if (diff < 0.22) {
      caughtRef.current += 1;
      setCaught(caughtRef.current);
      pairRealtime.sendGame('orbit-catch', { caught: caughtRef.current });
      void juice.catch();
      setOrbAngle(orbAngle + Math.PI * (0.6 + (seed % 5) * 0.08));
    } else {
      void juice.miss();
    }
  };

  const team = caught + partnerCaught;
  const line = pickPostMatchLine(caught, partnerCaught || 1, seed);

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
            line={line.text}
            onRematch={start}
            onHome={() => router.replace('/(tabs)/play')}
          />
        </View>
      </LpdBackground>
    );
  }

  const cx = 140;
  const cy = 140;
  const r = 100;
  const px = cx + Math.cos(angle) * r;
  const py = cy + Math.sin(angle) * r;
  const ox = cx + Math.cos(orbAngle) * (r * 0.72);
  const oy = cy + Math.sin(orbAngle) * (r * 0.72);

  return (
    <LpdBackground mood="rain">
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.title}>Orbit Catch · co-op</Text>
        {phase === 'ready' ? (
          <View style={styles.ready}>
            <Text style={styles.hero}>Ловите орбиту</Text>
            <Text style={styles.body}>
              Жми, когда янтарный маркер совпадает с розовым орбом. Очки пары складываются.
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
              <Text style={styles.stat}>партнёр {partnerCaught}</Text>
            </View>
            <Pressable style={styles.stage} onPress={onCatch}>
              <View style={styles.ring} />
              <View style={[styles.mark, { left: px - 8, top: py - 8 }]} />
              <View style={[styles.orb, { left: ox - 12, top: oy - 12 }]} />
              <Text style={styles.hint}>TAP в совпадении</Text>
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
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  mark: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.accentAmber,
    marginLeft: -140 + 140,
    marginTop: -140 + 140,
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
    marginLeft: -140 + 140,
    marginTop: -140 + 140,
  },
  hint: {
    position: 'absolute',
    bottom: 40,
    fontFamily: fonts.ui,
    color: colors.textMuted,
  },
  meta: { fontFamily: fonts.ui, color: colors.textSecondary, marginBottom: spacing.sm },
});
