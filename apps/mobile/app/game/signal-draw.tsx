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
type Stroke = { id: string; color: string; points: Pt[]; by: 'me' | 'peer'; width: number };

type Phase = 'ready' | 'playing' | 'finished';

const ROUND_SEC = 45;

function densify(points: Pt[], step = 0.012): Pt[] {
  if (points.length < 2) return points;
  const out: Pt[] = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let k = 1; k <= n; k += 1) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

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
  const [brush, setBrush] = useState<'fine' | 'bold'>('fine');
  const size = useRef({ w: 1, h: 1 });
  const current = useRef<Stroke | null>(null);
  const myCount = useRef(0);
  const peerCount = useRef(0);
  const lastSend = useRef(0);
  const startRef = useRef<() => void>(() => undefined);

  const myColor = colors.accentAmber;
  const peerColor = colors.accentRose;
  const brushW = brush === 'bold' ? 7 : 4;

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type !== 'game' || msg.gameId !== 'signal-draw') return;
      const payload = msg.payload as {
        stroke?: Stroke;
        point?: Pt & { strokeId: string };
        clear?: boolean;
        count?: number;
      } | undefined;
      if (!payload) return;
      if (payload.clear) {
        setStrokes((prev) => prev.filter((s) => s.by === 'me'));
        return;
      }
      if (payload.stroke) {
        const s: Stroke = {
          ...payload.stroke,
          by: 'peer',
          color: peerColor,
          width: payload.stroke.width || 4,
        };
        setStrokes((prev) => [...prev, s]);
        peerCount.current += 1;
        setPartnerStrokes(peerCount.current);
      }
      if (payload.point) {
        setStrokes((prev) =>
          prev.map((s) =>
            s.id === payload.point!.strokeId
              ? { ...s, points: densify([...s.points, { x: payload.point!.x, y: payload.point!.y }]) }
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
          if (peerCount.current === 0) {
            setPartnerStrokes(Math.max(1, Math.round(myCount.current * 0.85)));
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, addMemory]);

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

  const clearMine = () => {
    setStrokes((prev) => prev.filter((s) => s.by !== 'me'));
    myCount.current = 0;
    pairRealtime.sendGame('signal-draw', { clear: true });
    void juice.miss();
  };

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
            width: brushW,
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
          const last = cur.points[cur.points.length - 1];
          if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.004) return;
          cur.points.push(p);
          const dense = densify(cur.points);
          setStrokes((prev) =>
            prev.map((s) => (s.id === cur.id ? { ...s, points: dense } : s)),
          );
          const now = Date.now();
          if (now - lastSend.current > 32) {
            lastSend.current = now;
            pairRealtime.sendGame('signal-draw', {
              point: { ...p, strokeId: cur.id },
            });
          }
        },
        onPanResponderRelease: () => {
          const cur = current.current;
          if (cur) {
            pairRealtime.sendGame('signal-draw', {
              point: { ...cur.points[cur.points.length - 1], strokeId: cur.id },
            });
          }
          current.current = null;
        },
      }),
    [phase, user?.id, myColor, brushW],
  );

  const myScore = myCount.current * 10;
  const theirScore = (partnerStrokes || peerCount.current) * 10;
  const line = pickPostMatchLine(myScore, theirScore || 1, seed);

  const renderStroke = useCallback((stroke: Stroke) => {
    const pts = stroke.points;
    const w = stroke.width || 4;
    return (
      <View key={stroke.id} pointerEvents="none">
        {pts.map((p, i) => (
          <View
            key={`${stroke.id}_${i}`}
            style={{
              position: 'absolute',
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              width: w,
              height: w,
              marginLeft: -w / 2,
              marginTop: -w / 2,
              borderRadius: w / 2,
              backgroundColor: stroke.color,
              opacity: stroke.by === 'peer' ? 0.85 : 0.95,
              shadowColor: stroke.color,
              shadowOpacity: 0.55,
              shadowRadius: 4,
            }}
          />
        ))}
      </View>
    );
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
            gameId="signal-draw"
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
              Общий холст. Янтарь — ты, пыльная роза — партнёр. Плотный штрих, {ROUND_SEC} секунд.
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
            <View style={styles.tools}>
              <Text
                onPress={() => setBrush('fine')}
                style={[styles.tool, brush === 'fine' && styles.toolOn]}
              >
                тонкий
              </Text>
              <Text
                onPress={() => setBrush('bold')}
                style={[styles.tool, brush === 'bold' && styles.toolOn]}
              >
                жирный
              </Text>
              <Text onPress={clearMine} style={styles.toolDanger}>
                стереть моё
              </Text>
            </View>
            <View style={styles.canvas} onLayout={onLayout} {...pan.panHandlers}>
              <View style={styles.grid} pointerEvents="none" />
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
  tools: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  tool: {
    fontFamily: fonts.uiMedium,
    color: colors.textMuted,
    fontSize: 13,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
  },
  toolOn: { color: colors.accentAmber, borderColor: 'rgba(226,176,122,0.45)' },
  toolDanger: {
    marginLeft: 'auto',
    fontFamily: fonts.uiMedium,
    color: colors.danger,
    fontSize: 13,
  },
  canvas: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(18,16,24,0.78)',
    overflow: 'hidden',
  },
  grid: {
    ...StyleSheet.absoluteFill,
    opacity: 0.07,
    borderWidth: 40,
    borderColor: 'rgba(255,214,186,0.35)',
  },
  meta: { fontFamily: fonts.ui, color: colors.textSecondary, marginBottom: spacing.sm },
});
