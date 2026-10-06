import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
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
import { confirmLeaveMatch } from '../../src/utils/confirmLeaveMatch';
import { useMemories } from '../../src/store/MemoriesStore';
import { broadcastMemory } from '../../src/memories/broadcastMemory';

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

/** Normalized 0..1 points → SVG path in the same unit space. */
function pointsToPath(points: Pt[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.0001} ${p.y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${points[i].x} ${points[i].y}`;
  }
  return d;
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
  const [peerPulse, setPeerPulse] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [peerSeen, setPeerSeen] = useState(false);
  const [syncFinish, setSyncFinish] = useState(false);
  const [finishDualLabel, setFinishDualLabel] = useState<'Оба финиш' | 'Оба на финише' | null>(
    null,
  );
  const [canvasSize, setCanvasSize] = useState({ w: 1, h: 1 });
  const size = useRef({ w: 1, h: 1 });
  const canvasOrigin = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<View>(null);
  const current = useRef<Stroke | null>(null);
  const myCount = useRef(0);
  const peerCount = useRef(0);
  const partnerFinishedRef = useRef(false);
  const phaseRef = useRef<Phase>('ready');
  const lastSend = useRef(0);
  const startRef = useRef<() => void>(() => undefined);
  const peerPulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPresence = useRef(pair?.partnerPresence);
  const endWarned = useRef(false);
  const lastClearAt = useRef(0);
  const lastUndoAt = useRef(0);
  const lastRematchAt = useRef(0);
  const lastHelloAt = useRef(0);
  const lateStartAt = useRef(0);
  const brushRef = useRef<'fine' | 'bold'>('fine');
  const toastRef = useRef<string | null>(null);

  const myColor = colors.accentAmber;
  const peerColor = colors.accentRose;
  const brushW = brush === 'bold' ? 7 : 4;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    brushRef.current = brush;
  }, [brush]);

  const bumpPeer = () => {
    setPeerPulse(true);
    if (peerPulseTimer.current) clearTimeout(peerPulseTimer.current);
    peerPulseTimer.current = setTimeout(() => setPeerPulse(false), 420);
  };

  const showToast = (text: string) => {
    toastRef.current = text;
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      toastRef.current = null;
      setToast(null);
    }, 1600);
  };

  useEffect(() => {
    if (phase !== 'playing') {
      prevPresence.current = pair?.partnerPresence;
      return;
    }
    const cur = pair?.partnerPresence;
    const prev = prevPresence.current;
    if (prev === 'online' && (cur === 'away' || cur === 'offline')) {
      showToast('Партнёр offline');
      void juice.miss();
    } else if ((prev === 'away' || prev === 'offline') && cur === 'online') {
      showToast(
        toastRef.current === 'Партнёр offline' ||
          toastRef.current === 'Партнёр снова online' ||
          toastRef.current === 'Оба на связи'
          ? 'Оба на связи'
          : 'Партнёр снова online',
      );
      void juice.hit();
    }
    prevPresence.current = cur;
  }, [pair?.partnerPresence, phase]);

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'peer_left') {
        setPeerSeen(false);
        showToast('Партнёр вышел');
        void juice.miss();
        return;
      }
      if (msg.type === 'peer_joined') {
        setPeerSeen(true);
        showToast(
          toastRef.current === 'Партнёр вышел' ||
            toastRef.current === 'Партнёр вернулся' ||
            toastRef.current === 'Оба снова здесь'
            ? 'Оба снова здесь'
            : 'Партнёр вернулся',
        );
        void juice.sync();
        lastHelloAt.current = Date.now();
        pairRealtime.sendGame('signal-draw', { hello: true, fromId: user.id });
        return;
      }
      if (msg.type !== 'game' || msg.gameId !== 'signal-draw') return;
      const payload = msg.payload as {
        stroke?: Stroke;
        point?: Pt & { strokeId: string };
        clear?: boolean;
        undo?: boolean;
        count?: number;
        rematch?: boolean;
        seed?: number;
        brush?: 'fine' | 'bold';
        phase?: string;
        hello?: boolean;
      } | undefined;
      if (!payload) return;
      if (payload.hello || payload.phase === 'start') {
        setPeerSeen(true);
        if (payload.hello) {
          const both = Date.now() - lastHelloAt.current < 2500;
          showToast(
            both
              ? toastRef.current === 'Оба в игре' || toastRef.current === 'Оба здесь'
                ? 'Оба здесь'
                : 'Оба в игре'
              : 'Партнёр в игре',
          );
          void (both ? juice.perfect() : juice.sync());
          return;
        }
        if (payload.phase === 'start' && Date.now() - lateStartAt.current < 2500) {
          showToast(
            toastRef.current === 'Оба догоняют' || toastRef.current === 'Оба в старте'
              ? 'Оба в старте'
              : 'Оба догоняют',
          );
          void juice.perfect();
        }
      }
      if (payload.rematch) {
        setPeerSeen(true);
        const both = Date.now() - lastRematchAt.current < 2500;
        const racing =
          both &&
          (toastRef.current === 'Оба: ещё раунд' || toastRef.current === 'Оба снова');
        showToast(racing ? 'Оба снова' : both ? 'Оба: ещё раунд' : 'Партнёр: ещё раунд');
        void (both ? juice.perfect() : juice.sync());
        startRef.current();
        return;
      }
      if (payload.phase === 'finished') {
        partnerFinishedRef.current = true;
        if (typeof payload.count === 'number') {
          peerCount.current = payload.count;
          setPartnerStrokes(payload.count);
        }
        if (phaseRef.current === 'finished') {
          const racing =
            toastRef.current === 'Оба финиш' || toastRef.current === 'Оба на финише';
          const dual = racing ? 'Оба на финише' : 'Оба финиш';
          setFinishDualLabel(dual);
          setSyncFinish(true);
          showToast(dual);
          void juice.perfect();
        } else {
          showToast('Партнёр закончил');
          void juice.sync();
        }
        return;
      }
      if (payload.brush === 'fine' || payload.brush === 'bold') {
        const both = brushRef.current === payload.brush;
        const racing =
          both &&
          (toastRef.current === 'Оба: жирная кисть' ||
            toastRef.current === 'Оба: тонкая кисть' ||
            toastRef.current === 'Оба одной кистью');
        showToast(
          racing
            ? 'Оба одной кистью'
            : both
              ? payload.brush === 'bold'
                ? 'Оба: жирная кисть'
                : 'Оба: тонкая кисть'
              : payload.brush === 'bold'
                ? 'Партнёр: жирная кисть'
                : 'Партнёр: тонкая кисть',
        );
        void (both ? juice.perfect() : juice.hit());
        return;
      }
      if (payload.clear) {
        setStrokes((prev) => prev.filter((s) => s.by === 'me'));
        const both = Date.now() - lastClearAt.current < 1600;
        const racing =
          both &&
          (toastRef.current === 'Оба стёрли' || toastRef.current === 'Оба чисто');
        showToast(
          racing ? 'Оба чисто' : both ? 'Оба стёрли' : 'Партнёр стёр свои линии',
        );
        void (both ? juice.sync() : juice.miss());
        return;
      }
      if (payload.undo) {
        setStrokes((prev) => {
          const peerIdx = [...prev].map((s, i) => (s.by === 'peer' ? i : -1)).filter((i) => i >= 0);
          const last = peerIdx[peerIdx.length - 1];
          if (last == null) return prev;
          return prev.filter((_, i) => i !== last);
        });
        peerCount.current = Math.max(0, peerCount.current - 1);
        setPartnerStrokes(peerCount.current);
        bumpPeer();
        const both = Date.now() - lastUndoAt.current < 1200;
        const racing =
          both &&
          (toastRef.current === 'Оба undo' || toastRef.current === 'Оба назад');
        showToast(
          racing ? 'Оба назад' : both ? 'Оба undo' : 'Партнёр отменил штрих',
        );
        void (both ? juice.sync() : juice.hit());
        return;
      }
      if (payload.stroke) {
        const firstStroke = peerCount.current === 0;
        const s: Stroke = {
          ...payload.stroke,
          by: 'peer',
          color: peerColor,
          width: payload.stroke.width || 4,
        };
        setStrokes((prev) => [...prev, s]);
        peerCount.current += 1;
        setPartnerStrokes(peerCount.current);
        bumpPeer();
        if (firstStroke) {
          const racing =
            toastRef.current === 'Рисуем вместе' ||
            toastRef.current === 'Оба рисуют';
          showToast(
            myCount.current > 0
              ? racing
                ? 'Оба рисуют'
                : 'Рисуем вместе'
              : 'Партнёр рисует',
          );
          void (myCount.current > 0 ? juice.perfect() : juice.hit());
          if (peerCount.current === myCount.current && myCount.current > 0) {
            setTimeout(() => {
              showToast('Оба на штрихах');
              void juice.sync();
            }, 420);
          }
        } else if (peerCount.current === myCount.current && myCount.current > 0) {
          showToast('Оба на штрихах');
          void juice.sync();
        } else if (peerCount.current > myCount.current + 1) {
          const racing =
            toastRef.current === 'Партнёр впереди' ||
            toastRef.current === 'Гонка' ||
            toastRef.current === 'Оба в гонке';
          showToast(
            toastRef.current === 'Гонка' || toastRef.current === 'Оба в гонке'
              ? 'Оба в гонке'
              : racing
                ? 'Гонка'
                : 'Партнёр впереди',
          );
          void (racing ? juice.sync() : juice.hit());
        }
      }
      if (payload.point) {
        setStrokes((prev) =>
          prev.map((s) =>
            s.id === payload.point!.strokeId
              ? { ...s, points: densify([...s.points, { x: payload.point!.x, y: payload.point!.y }]) }
              : s,
          ),
        );
        bumpPeer();
      }
      if (typeof payload.count === 'number') {
        peerCount.current = payload.count;
        setPartnerStrokes(payload.count);
      }
    });
    return () => {
      off();
      if (peerPulseTimer.current) clearTimeout(peerPulseTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [pair?.code, user?.id, peerColor]);

  useEffect(() => {
    if (!pair || !user || params.solo === '1') return;
    lastHelloAt.current = Date.now();
    pairRealtime.sendGame('signal-draw', { hello: true, fromId: user.id });
  }, [pair?.code, user?.id, params.solo]);

  const start = () => {
    setStrokes([]);
    current.current = null;
    myCount.current = 0;
    peerCount.current = 0;
    partnerFinishedRef.current = false;
    setSyncFinish(false);
    setFinishDualLabel(null);
    setPartnerStrokes(0);
    setTimeLeft(ROUND_SEC);
    setPhase('playing');
    endWarned.current = false;
    pairRealtime.sendGame('signal-draw', {
      phase: 'start',
      seed,
      hello: true,
      brush,
      fromId: user?.id,
    });
    void juice.beat();
  };
  startRef.current = start;

  const rematch = () => {
    lastRematchAt.current = Date.now();
    pairRealtime.sendGame('signal-draw', { rematch: true, seed: Date.now() % 100000, hello: true });
    start();
  };

  useEffect(() => {
    if (params.solo === '1') return;
    const at = Number(params.startAt);
    if (!Number.isFinite(at)) return;
    const delay = Math.max(0, at - Date.now());
    if (delay < 400) {
      lateStartAt.current = Date.now();
      showToast('Догоняем старт');
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
            showToast(`Старт ${sec}`);
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
      setTimeLeft((t) => {
        if (t === 5 && !endWarned.current) {
          endWarned.current = true;
          showToast('5 секунд');
          void juice.hit();
        }
        if (t <= 1) {
          clearInterval(id);
          if (partnerFinishedRef.current) {
            const racing =
              toastRef.current === 'Оба финиш' || toastRef.current === 'Оба на финише';
            const dual = racing ? 'Оба на финише' : 'Оба финиш';
            setFinishDualLabel(dual);
            setSyncFinish(true);
            showToast(dual);
            void juice.perfect();
          }
          setPhase('finished');
          void juice.postMatch();
          pairRealtime.sendGame('signal-draw', {
            phase: 'finished',
            count: myCount.current,
          });
          const mem = addMemory({
            kind: 'draw',
            title: 'Signal Draw',
            detail: partnerFinishedRef.current
              ? `Оба финиш · штрихи ${myCount.current}`
              : params.solo === '1'
                ? `Solo demo · штрихи ${myCount.current}`
                : peerCount.current > 0
                  ? `Штрихи ${myCount.current} · партнёр ${peerCount.current}`
                  : `Штрихи ${myCount.current} · ждём партнёра`,
          });
          broadcastMemory(mem, user);
          // Demo partner ink only in solo — never backfill while duo is live.
          if (peerCount.current === 0 && params.solo === '1') {
            setPartnerStrokes(Math.max(1, Math.round(myCount.current * 0.85)));
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, addMemory, params.solo, user]);

  const applyCanvasFrame = (x: number, y: number, w: number, h: number) => {
    if (w < 2 || h < 2) return false;
    canvasOrigin.current = { x, y };
    const next = { w, h };
    size.current = next;
    setCanvasSize(next);
    return true;
  };

  const syncCanvasFrame = (cb?: () => void) => {
    const node = canvasRef.current;
    if (!node?.measureInWindow) {
      cb?.();
      return;
    }
    node.measureInWindow((x, y, w, h) => {
      applyCanvasFrame(x, y, w, h);
      cb?.();
    });
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const next = {
      w: Math.max(1, e.nativeEvent.layout.width),
      h: Math.max(1, e.nativeEvent.layout.height),
    };
    size.current = next;
    setCanvasSize(next);
    requestAnimationFrame(() => syncCanvasFrame());
  };

  const toNormPage = (pageX: number, pageY: number): Pt | null => {
    const { w, h } = size.current;
    if (w < 2 || h < 2) return null;
    return {
      x: Math.max(0, Math.min(1, (pageX - canvasOrigin.current.x) / w)),
      y: Math.max(0, Math.min(1, (pageY - canvasOrigin.current.y) / h)),
    };
  };

  const clearMine = () => {
    setStrokes((prev) => prev.filter((s) => s.by !== 'me'));
    myCount.current = 0;
    lastClearAt.current = Date.now();
    pairRealtime.sendGame('signal-draw', { clear: true });
    void juice.miss();
  };

  const undoMine = () => {
    setStrokes((prev) => {
      const mineIdx = [...prev].map((s, i) => (s.by === 'me' ? i : -1)).filter((i) => i >= 0);
      const last = mineIdx[mineIdx.length - 1];
      if (last == null) return prev;
      myCount.current = Math.max(0, myCount.current - 1);
      lastUndoAt.current = Date.now();
      pairRealtime.sendGame('signal-draw', { undo: true, count: myCount.current });
      void juice.hit();
      return prev.filter((_, i) => i !== last);
    });
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => phase === 'playing',
        onMoveShouldSetPanResponder: () => phase === 'playing',
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          const { pageX, pageY } = evt.nativeEvent;
          const begin = () => {
            const p = toNormPage(pageX, pageY);
            if (!p) return;
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
            if (myCount.current === peerCount.current && myCount.current > 0) {
              setTimeout(() => {
                showToast('Оба на штрихах');
                void juice.sync();
              }, 320);
            } else if (myCount.current > peerCount.current + 1) {
              setTimeout(() => {
                const racing =
                  toastRef.current === 'Я впереди' ||
                  toastRef.current === 'Гонка' ||
                  toastRef.current === 'Оба в гонке';
                showToast(
                  toastRef.current === 'Гонка' || toastRef.current === 'Оба в гонке'
                    ? 'Оба в гонке'
                    : racing
                      ? 'Гонка'
                      : 'Я впереди',
                );
                void (racing ? juice.sync() : juice.hit());
              }, 320);
            }
          };
          // Measure first — locationY often maps wrong vs flex canvas height (ink stuck at top)
          syncCanvasFrame(begin);
        },
        onPanResponderMove: (evt) => {
          const cur = current.current;
          if (!cur) return;
          const p = toNormPage(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
          if (!p) return;
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
  const myInkPts = useMemo(
    () =>
      strokes
        .filter((s) => s.by === 'me')
        .reduce((n, s) => n + s.points.length, 0),
    [strokes],
  );
  const peerInkPts = useMemo(
    () =>
      strokes
        .filter((s) => s.by === 'peer')
        .reduce((n, s) => n + s.points.length, 0),
    [strokes],
  );
  const line = pickPostMatchLine(myScore, theirScore, seed);

  const renderStroke = useCallback(
    (stroke: Stroke) => {
      const d = pointsToPath(stroke.points);
      if (!d) return null;
      const sw = (stroke.width || 4) / canvasSize.w;
      return (
        <Path
          key={stroke.id}
          d={d}
          stroke={stroke.color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity={stroke.by === 'peer' ? 0.9 : 0.96}
        />
      );
    },
    [canvasSize.w],
  );

  if (phase === 'finished') {
    return (
      <LpdBackground mood="warm">
        <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.title}>Signal Draw</Text>
          <Text style={styles.meta}>
            Твои линии {myCount.current}
            {params.solo === '1'
              ? ` · партнёр demo ${partnerStrokes || peerCount.current}`
              : peerCount.current > 0 || partnerStrokes > 0
                ? ` · партнёр ${partnerStrokes || peerCount.current}`
                : ' · ждём партнёра'}
          </Text>
          <PostMatchCard
            title="Общий холст закрыт"
            gameId="signal-draw"
            winnerLabel={syncFinish ? finishDualLabel ?? 'Оба финиш' : undefined}
            line={line.text}
            onRematch={rematch}
            onHome={() => router.replace({ pathname: '/game/lobby', params: { game: 'signal-draw' } })}
          />
        </View>
      </LpdBackground>
    );
  }

  return (
    <LpdBackground mood="night">
      <View style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Signal Draw</Text>
          <Pressable
            onPress={() => {
              void confirmLeaveMatch(phase === 'playing').then((ok) => {
                if (ok) router.back();
              });
            }}
          >
            <Text style={styles.leave}>Выйти</Text>
          </Pressable>
        </View>
        {phase === 'ready' ? (
          <View style={styles.ready}>
            <Text style={styles.hero}>Рисуйте сигнал</Text>
            <Text style={styles.body}>
              Общий холст (Svg). Янтарь — ты, пыльная роза — партнёр. Плотный штрих, {ROUND_SEC} секунд.
              {params.solo !== '1' && !peerSeen ? ' Ждём партнёра на холсте…' : ''}
            </Text>
            <LpdButton label="Старт" onPress={start} />
          </View>
        ) : (
          <>
            <View style={styles.hud}>
              <Text style={styles.stat}>{timeLeft}s</Text>
              <Text style={styles.stat}>
                ты {myCount.current} · {myInkPts} pts
              </Text>
              <Text style={[styles.stat, peerPulse && styles.peerLive]}>
                партнёр {partnerStrokes}
                {peerInkPts > 0 ? ` · ${peerInkPts} pts` : ''}
                {peerPulse ? ' · live' : ''}
              </Text>
            </View>
            {toast ? <Text style={styles.toast}>{toast}</Text> : null}
            <View style={styles.tools}>
              <Text
                onPress={() => {
                  setBrush('fine');
                  pairRealtime.sendGame('signal-draw', { brush: 'fine' });
                  void juice.hit();
                }}
                style={[styles.tool, brush === 'fine' && styles.toolOn]}
              >
                тонкий
              </Text>
              <Text
                onPress={() => {
                  setBrush('bold');
                  pairRealtime.sendGame('signal-draw', { brush: 'bold' });
                  void juice.beat();
                }}
                style={[styles.tool, brush === 'bold' && styles.toolOn]}
              >
                жирный
              </Text>
              <Text onPress={undoMine} style={styles.tool}>
                undo
              </Text>
              <Text onPress={clearMine} style={styles.toolDanger}>
                стереть моё
              </Text>
            </View>
            <View
              ref={canvasRef}
              collapsable={false}
              style={[styles.canvas, peerPulse && styles.canvasLive]}
              onLayout={onLayout}
              {...pan.panHandlers}
            >
              <View style={styles.grid} pointerEvents="none" />
              <Svg
                pointerEvents="none"
                style={StyleSheet.absoluteFill}
                width="100%"
                height="100%"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
              >
                {strokes.map(renderStroke)}
              </Svg>
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
  ready: { flex: 1, justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.sm },
  hero: { fontFamily: fonts.display, fontSize: 34, color: colors.textPrimary },
  body: { fontFamily: fonts.ui, color: colors.textSecondary, lineHeight: 22 },
  hud: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  stat: { fontFamily: fonts.uiMedium, color: colors.textSecondary, fontSize: 13 },
  peerLive: { color: colors.accentRose, fontFamily: fonts.uiSemi },
  toast: {
    fontFamily: fonts.uiMedium,
    color: colors.accentMist,
    fontSize: 13,
  },
  tools: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', flexWrap: 'wrap' },
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
  canvasLive: {
    borderColor: 'rgba(227,154,160,0.55)',
  },
  grid: {
    ...StyleSheet.absoluteFill,
    opacity: 0.07,
    borderWidth: 40,
    borderColor: 'rgba(255,214,186,0.35)',
  },
  meta: { fontFamily: fonts.ui, color: colors.textSecondary, marginBottom: spacing.sm },
});
