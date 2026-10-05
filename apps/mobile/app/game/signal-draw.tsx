import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { PostMatchCard } from '../../src/components/PostMatchCard';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, spacing } from '../../src/theme/tokens';
import { pickPostMatchLine } from '../../src/content/postMatch';
import { useApp } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { juice } from '../../src/audio/juice';
import { useMemories } from '../../src/store/MemoriesStore';

type Pt = { x: number; y: number };
type Stroke = { id: string; color: string; points: Pt[]; by: 'me' | 'peer' };

type Phase = 'ready' | 'playing' | 'finished';

const ROUND_SEC = 40;

export default function SignalDrawScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, pair } = useApp();
  const { addMemory } = useMemories();
  const params = useLocalSearchParams<{ seed?: string; startAt?: string; solo?: string }>();
  const seed = Number(params.seed) || Date.now() % 100000;

  const [phase, setPhase] = useState<Phase>('ready');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [timeLeft, setTimeLeft] = useState(ROUND_SEC);
  const [partnerStrokes, setPartnerStrokes] = useState(0);
  const size = useRef({ w: 1, h: 1 });
  const current = useRef<Stroke | null>(null);
  const myCount = useRef(0);
  const peerCount = useRef(0);
  const startRef = useRef<() => void>(() => undefined);

  const myColor = colors.accentAmber;
  const peerColor = colors.accentRose;

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type !== 'game' || msg.gameId !== 'signal-draw') return;
      const payload = msg.payload as {
        stroke?: Stroke;
        point?: Pt & { strokeId: string };
        end?: string;
        count?: number;
      } | undefined;
      if (!payload) return;
      if (payload.stroke) {
        const s = { ...payload.stroke, by: 'peer' as const, color: peerColor };
        setStrokes((prev) => [...prev, s]);
        peerCount.current += 1;
        setPartnerStrokes(peerCount.current);
      }
      if (payload.point) {
        setStrokes((prev) =>
          prev.map((s) =>
            s.id === payload.point!.strokeId
              ? { ...s, points: [...s.points, { x: payload.point!.x, y: payload.point!.y }] }
              : s,
          ),
        );
      }
      if (typeof payload.count === 'number') {
        peerCount.current = payload.count;
        setPartnerStrokes(payload.count);
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id, peerColor]);

  const start = () => {
    setStrokes([]);
    current.current = null;
    myCount.current = 0;
    peerCount.current = 0;
    setPartnerStrokes(0);
    setTimeLeft(ROUND_SEC);
    setPhase('playing');
    pairRealtime.sendGame('signal-draw', { phase: 'start', seed });
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
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(id);
          setPhase('finished');
          void juice.postMatch();
          addMemory({
            kind: 'spark',
            title: 'Signal Draw',
            detail: `Штрихи ${myCount.current} · партнёр ${peerCount.current}`,
          });
          if (peerCount.current === 0 && params.solo !== '0') {
            // demo partner activity
            setPartnerStrokes(Math.max(1, Math.round(myCount.current * 0.8)));
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, addMemory, params.solo]);

  const onLayout = (e: LayoutChangeEvent) => {
    size.current = {
      w: e.nativeEvent.layout.width,
      h: e.nativeEvent.layout.height,
    };
  };

  const toNorm = (x: number, y: number): Pt => ({
    x: Math.max(0, Math.min(1, x / size.current.w)),
    y: Math.max(0, Math.min(1, y / size.current.h)),
  });

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => phase === 'playing',
        onMoveShouldSetPanResponder: () => phase === 'playing',
        onPanResponderGrant: (evt) => {
          const p = toNorm(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          const stroke: Stroke = {
            id: `s_${user?.id ?? 'me'}_${Date.now()}`,
            color: myColor,
            points: [p],
            by: 'me',
          };
          current.current = stroke;
          setStrokes((prev) => [...prev, stroke]);
          myCount.current += 1;
          pairRealtime.sendGame('signal-draw', {
            stroke: { ...stroke, by: 'peer' },
            count: myCount.current,
          });
          void juice.hit();
        },
        onPanResponderMove: (evt) => {
          const cur = current.current;
          if (!cur) return;
          const p = toNorm(evt.nativeEvent.locationX, evt.nativeEvent.locationY);
          cur.points.push(p);
          setStrokes((prev) =>
            prev.map((s) => (s.id === cur.id ? { ...s, points: [...cur.points] } : s)),
          );
          pairRealtime.sendGame('signal-draw', {
            point: { ...p, strokeId: cur.id },
          });
        },
        onPanResponderRelease: () => {
          current.current = null;
        },
      }),
    [phase, user?.id, myColor],
  );

  const myScore = myCount.current * 10;
  const theirScore = (partnerStrokes || peerCount.current) * 10;
  const line = pickPostMatchLine(myScore, theirScore || 1, seed);

  const renderStroke = useCallback((stroke: Stroke) => {
    if (stroke.points.length < 2) {
      const p = stroke.points[0];
      if (!p) return null;
      return (
        <View
          key={stroke.id}
          style={[
            styles.dot,
            {
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              backgroundColor: stroke.color,
            },
          ]}
        />
      );
    }
    const segs = [];
    for (let i = 1; i < stroke.points.length; i += 1) {
      const a = stroke.points[i - 1];
      const b = stroke.points[i];
      const dx = (b.x - a.x) * size.current.w;
      const dy = (b.y - a.y) * size.current.h;
      const len = Math.hypot(dx, dy);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      segs.push(
        <View
          key={`${stroke.id}_${i}`}
          style={[
            styles.seg,
            {
              left: a.x * size.current.w,
              top: a.y * size.current.h,
              width: len,
              backgroundColor: stroke.color,
              transform: [{ rotate: `${angle}deg` }],
            },
          ]}
        />,
      );
    }
    return <View key={stroke.id}>{segs}</View>;
  }, []);

  if (phase === 'finished') {
    return (
      <LpdBackground mood="warm">
        <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.title}>Signal Draw</Text>
          <Text style={styles.meta}>
            Твои линии {myCount.current} · Партнёр {partnerStrokes || peerCount.current}
          </Text>
          <PostMatchCard
            title="Общий холст закрыт"
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
        <Text style={styles.title}>Signal Draw</Text>
        {phase === 'ready' ? (
          <View style={styles.ready}>
            <Text style={styles.hero}>Рисуйте сигнал</Text>
            <Text style={styles.body}>
              Общий холст на двоих. Янтарь — ты, пыльная роза — партнёр. {ROUND_SEC} секунд.
            </Text>
            <LpdButton label="Старт" onPress={start} />
          </View>
        ) : (
          <>
            <View style={styles.hud}>
              <Text style={styles.stat}>{timeLeft}s</Text>
              <Text style={styles.stat}>ты {myCount.current}</Text>
              <Text style={styles.stat}>партнёр {partnerStrokes}</Text>
            </View>
            <View
              style={styles.canvas}
              onLayout={onLayout}
              {...pan.panHandlers}
            >
              {strokes.map(renderStroke)}
            </View>
          </>
        )}
      </View>
    </LpdBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.sm },
  title: { fontFamily: fonts.uiSemi, color: colors.textPrimary, fontSize: 18 },
  ready: { flex: 1, justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.sm },
  hero: { fontFamily: fonts.display, fontSize: 34, color: colors.textPrimary },
  body: { fontFamily: fonts.ui, color: colors.textSecondary, lineHeight: 22 },
  hud: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { fontFamily: fonts.uiMedium, color: colors.textSecondary },
  canvas: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(18,16,24,0.7)',
    overflow: 'hidden',
  },
  seg: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
  },
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    marginLeft: -3,
    marginTop: -3,
    borderRadius: 3,
  },
  meta: { fontFamily: fonts.ui, color: colors.textSecondary, marginBottom: spacing.sm },
});
