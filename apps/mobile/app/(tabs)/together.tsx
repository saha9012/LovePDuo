import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { EmptyState } from '../../src/components/EmptyState';
import { SectionRule } from '../../src/components/SectionRule';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { sparksRu, type SparkFilter } from '../../src/content/sparks';
import { juice } from '../../src/audio/juice';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { sendWarmthOrQueue, pendingWarmthCount } from '../../src/realtime/warmthOutbox';
import {
  sendNoteMutationOrQueue,
  pendingNoteMutationCount,
} from '../../src/realtime/noteMutationOutbox';
import { pendingMemoryMutationCount } from '../../src/realtime/memoryMutationOutbox';
import { sendPairMetaOrQueue } from '../../src/realtime/pairMetaOutbox';
import { sendGameIfPeerLive } from '../../src/realtime/sendGameIfPeerLive';
import { TinyNote, useApp } from '../../src/store/AppStore';
import { MemoryItem, useMemories } from '../../src/store/MemoriesStore';
import { usePremium } from '../../src/store/PremiumStore';
import { track } from '../../src/analytics/track';
import { confirmDestructive } from '../../src/utils/confirmDestructive';
import {
  broadcastMemory,
  broadcastMemoryClear,
  broadcastMemoryRemove,
} from '../../src/memories/broadcastMemory';

const CANDLE_SEC = 120;

function sparkDayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dailySparkIndex(pairCode: string, filter: SparkFilter, length: number) {
  if (length <= 0) return 0;
  const key = `${pairCode}|${sparkDayKey()}|${filter}`;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return h % length;
}

export default function TogetherScreen() {
  const insets = useSafeAreaInsets();
  const {
    user,
    pair,
    notes,
    addNote,
    removeNote,
    receiveNote,
    markNoteSynced,
    pendingNotes,
    warmthPulse,
  } = useApp();
  const { items: memories, clearMemories, removeMemory, addMemory, receiveMemory } = useMemories();
  const { spicyUnlocked, maxMemories, isPlus } = usePremium();
  const [sparkFilter, setSparkFilter] = useState<SparkFilter>('soft');
  const [candleLeft, setCandleLeft] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [peerToast, setPeerToast] = useState<string | null>(null);
  const [outboxTick, setOutboxTick] = useState(0);
  const deck = useMemo(
    () => sparksRu.filter((s) => s.filter === sparkFilter),
    [sparkFilter],
  );
  const idx = useMemo(
    () => dailySparkIndex(pair?.code ?? 'solo', sparkFilter, deck.length || 1),
    [pair?.code, sparkFilter, deck.length],
  );
  const card = deck[idx] ?? sparksRu[0];
  const flame = useSharedValue(1);
  const lit = candleLeft != null && candleLeft > 0;
  const candleLogged = useRef(false);
  const candleLitRef = useRef(false);
  const lastBlowAt = useRef(0);
  const lastSparkAt = useRef(0);
  const lastHelloAt = useRef(0);
  const lastCandleEndAt = useRef(0);
  const lastNoteSentAt = useRef(0);
  const lastNoteLen = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerToastRef = useRef<string | null>(null);
  const warmthSeen = useRef(0);
  const warmthSentAt = useRef(0);
  const lastWarmthMemAt = useRef(0);

  useEffect(() => {
    candleLitRef.current = lit;
  }, [lit]);

  useEffect(() => {
    if (!spicyUnlocked && sparkFilter === 'spicy') {
      setSparkFilter('soft');
    }
  }, [spicyUnlocked, sparkFilter]);

  useEffect(() => {
    if (!pair) return;
    const id = setInterval(() => setOutboxTick((n) => n + 1), 2000);
    return () => clearInterval(id);
  }, [pair?.code]);

  const showPeer = (text: string) => {
    peerToastRef.current = text;
    setPeerToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      peerToastRef.current = null;
      setPeerToast(null);
    }, 1800);
  };

  useEffect(() => {
    if (!warmthPulse || warmthPulse <= warmthSeen.current) return;
    warmthSeen.current = warmthPulse;
    const meet = Date.now() - warmthSentAt.current < 2800;
    const racing =
      meet &&
      (peerToastRef.current === 'Тепло встречное' ||
        peerToastRef.current === 'Оба в тепле');
    showPeer(racing ? 'Оба в тепле' : meet ? 'Тепло встречное' : 'Тепло от партнёра');
    void (meet ? juice.perfect() : juice.warmth());
    if (meet && Date.now() - lastWarmthMemAt.current > 8000) {
      lastWarmthMemAt.current = Date.now();
      const mem = addMemory({
        kind: 'spark',
        title: 'Warmth',
        detail: racing ? 'Оба в тепле — одновременно.' : 'Тепло встречное.',
      });
      broadcastMemory(mem, user);
    }
  }, [warmthPulse, addMemory, user]);

  useEffect(() => {
    if (!lit) {
      flame.value = withTiming(1, { duration: 200 });
      return;
    }
    flame.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: 520, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.92, { duration: 480, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [lit, flame]);

  const flameStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: flame.value }, { scaleX: 0.85 + (flame.value - 1) * 0.4 }],
    opacity: lit ? 0.75 + (flame.value - 1) * 0.8 : 0.35,
  }));

  useEffect(() => {
    if (candleLeft == null || candleLeft <= 0) return;
    const t = setTimeout(() => setCandleLeft((v) => (v == null ? v : v - 1)), 1000);
    return () => clearTimeout(t);
  }, [candleLeft]);

  useEffect(() => {
    if (candleLeft == null || candleLeft <= 0) return;
    if (candleLeft % 15 === 0 && candleLeft < CANDLE_SEC) {
      sendGameIfPeerLive('candle', { left: candleLeft });
    }
  }, [candleLeft]);

  useEffect(() => {
    if (candleLeft !== 0 || candleLogged.current) return;
    candleLogged.current = true;
    lastCandleEndAt.current = Date.now();
    void juice.postMatch();
    sendPairMetaOrQueue('candle', { end: true, left: 0 });
    showPeer('Свеча догорела');
    const mem = addMemory({
      kind: 'candle',
      title: 'Candle',
      detail: 'Две минуты огня. Тепло осталось.',
    });
    broadcastMemory(mem, user);
  }, [candleLeft, addMemory, user]);

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'peer_left') {
        showPeer(
          candleLitRef.current
            ? 'Партнёр ушёл · свеча горит у тебя'
            : 'Партнёр ушёл с Together',
        );
        void juice.miss();
        return;
      }
      if (msg.type === 'peer_joined') {
        const racing =
          peerToastRef.current === 'Партнёр снова рядом' ||
          peerToastRef.current === 'Оба снова вместе' ||
          peerToastRef.current === 'Партнёр ушёл с Together' ||
          peerToastRef.current === 'Партнёр ушёл · свеча горит у тебя';
        showPeer(racing ? 'Оба снова вместе' : 'Партнёр снова рядом');
        void juice.warmth();
        lastHelloAt.current = Date.now();
        sendGameIfPeerLive('together-hello', {
          from: user.displayName,
          fromId: user.id,
        });
        const outbox = pendingNotes();
        if (outbox.length > 0) {
          let sent = 0;
          for (const n of outbox) {
            const { pendingSync: _p, ...payload } = n;
            if (sendGameIfPeerLive('tiny-note', payload)) {
              markNoteSynced(n.id);
              sent += 1;
            }
          }
          if (sent > 0) {
            showPeer(
              sent === 1
                ? 'Записка ушла партнёру'
                : `${sent} записки ушли партнёру`,
            );
          }
        }
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'together-hello') {
        const payload = msg.payload as { from?: string; fromId?: string } | undefined;
        if (payload?.fromId === user.id) return;
        const both = Date.now() - lastHelloAt.current < 2500;
        showPeer(
          both
            ? peerToastRef.current === 'Оба на Together' ||
              peerToastRef.current === 'Оба рядом'
              ? 'Оба рядом'
              : 'Оба на Together'
            : `${payload?.from ?? 'Партнёр'} на Together`,
        );
        void (both ? juice.perfect() : juice.warmth());
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'candle') {
        const payload = msg.payload as {
          left?: number;
          start?: boolean;
          blow?: boolean;
          end?: boolean;
        } | undefined;
        if (payload?.start) {
          const alreadyLit = candleLitRef.current;
          candleLogged.current = false;
          setCandleLeft(CANDLE_SEC);
          const racing =
            alreadyLit &&
            (peerToastRef.current === 'Свеча синхрон' ||
              peerToastRef.current === 'Оба у свечи');
          showPeer(
            racing ? 'Оба у свечи' : alreadyLit ? 'Свеча синхрон' : 'Партнёр зажёг свечу',
          );
          void (alreadyLit ? juice.perfect() : juice.warmth());
        }
        if (payload?.blow) {
          candleLogged.current = true;
          const both = Date.now() - lastBlowAt.current < 2200;
          const racing =
            both &&
            (peerToastRef.current === 'Оба погасили' ||
              peerToastRef.current === 'Оба гасят');
          setCandleLeft(0);
          showPeer(
            racing ? 'Оба гасят' : both ? 'Оба погасили' : 'Партнёр погасил свечу',
          );
          void (both ? juice.sync() : juice.miss());
        }
        if (payload?.end) {
          candleLogged.current = true;
          const both = Date.now() - lastCandleEndAt.current < 2800;
          setCandleLeft(0);
          showPeer(
            both
              ? peerToastRef.current === 'Оба догорели' ||
                peerToastRef.current === 'Оба в пепле'
                ? 'Оба в пепле'
                : 'Оба догорели'
              : 'Свеча догорела у партнёра',
          );
          void (both ? juice.perfect() : juice.postMatch());
        }
        if (typeof payload?.left === 'number' && !payload?.end && !payload?.blow) {
          setCandleLeft(payload.left);
        }
      }
      if (msg.type === 'game' && msg.gameId === 'spark') {
        const payload = msg.payload as {
          idx?: number;
          from?: string;
          filter?: SparkFilter;
        } | undefined;
        if (payload?.filter === 'spicy' || payload?.filter === 'soft') {
          if (payload.filter === 'spicy' && !spicyUnlocked) {
            showPeer('Spicy · Duo Plus — остаёшься soft');
            void juice.miss();
          } else if (payload.filter !== sparkFilter) {
            setSparkFilter(payload.filter);
            const both = Date.now() - lastSparkAt.current < 2200;
            showPeer(
              both
                ? payload.filter === 'spicy'
                  ? 'Оба: spicy'
                  : 'Оба: soft'
                : payload.from
                  ? `${payload.from}: ${payload.filter}`
                  : `Колода ${payload.filter}`,
            );
            void (both ? juice.perfect() : juice.card());
          }
        }
        // Daily Spark is day-keyed — ignore free-browse idx from older clients.
      }
      if (msg.type === 'game' && msg.gameId === 'tiny-note') {
        const payload = msg.payload as TinyNote | undefined;
        if (payload?.id && payload.text) {
          receiveNote(payload);
          const snip =
            payload.text.length > 42 ? `${payload.text.slice(0, 40)}…` : payload.text;
          const chatty = Date.now() - lastNoteSentAt.current < 3200;
          const sameLen =
            lastNoteLen.current > 0 &&
            payload.text.trim().length === lastNoteLen.current &&
            Date.now() - lastNoteSentAt.current < 5000;
          showPeer(
            sameLen
              ? peerToastRef.current?.startsWith('Оба на буквах') ||
                peerToastRef.current?.startsWith('Оба в длине')
                ? `Оба в длине · ${snip}`
                : `Оба на буквах · ${snip}`
              : chatty
                ? peerToastRef.current?.startsWith('Переписка') ||
                  peerToastRef.current?.startsWith('Оба пишут')
                  ? `Оба пишут · ${payload.from ?? 'Партнёр'}: ${snip}`
                  : `Переписка · ${payload.from ?? 'Партнёр'}: ${snip}`
                : `${payload.from ?? 'Партнёр'}: ${snip}`,
          );
          void (sameLen || chatty ? juice.perfect() : juice.card());
        }
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'tiny-note-remove') {
        const payload = msg.payload as { id?: string; from?: string; fromId?: string } | undefined;
        if (!payload?.id || payload.fromId === user.id) return;
        removeNote(payload.id);
        showPeer(`${payload.from ?? 'Партнёр'} удалил заметку`);
        void juice.miss();
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'memory-add') {
        const payload = msg.payload as
          | (MemoryItem & { from?: string; fromId?: string })
          | undefined;
        if (!payload?.id || payload.fromId === user.id) return;
        receiveMemory({
          id: payload.id,
          kind: payload.kind,
          title: payload.title,
          detail: payload.detail,
          at: payload.at ?? Date.now(),
        });
        showPeer(`Memory: ${payload.title}`);
        void juice.card();
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'memory-remove') {
        const payload = msg.payload as { id?: string; from?: string; fromId?: string } | undefined;
        if (!payload?.id || payload.fromId === user.id) return;
        removeMemory(payload.id);
        showPeer(`${payload.from ?? 'Партнёр'} удалил memory`);
        void juice.miss();
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'memory-clear') {
        const payload = msg.payload as { from?: string; fromId?: string } | undefined;
        if (payload?.fromId === user.id) return;
        clearMemories();
        showPeer(`${payload?.from ?? 'Партнёр'} очистил memories`);
        void juice.miss();
      }
    });
    return () => {
      off();
    };
  }, [
    pair?.code,
    user?.id,
    receiveNote,
    removeNote,
    receiveMemory,
    removeMemory,
    clearMemories,
    pendingNotes,
    markNoteSynced,
    user,
    spicyUnlocked,
    sparkFilter,
  ]);

  useEffect(() => {
    if (!pair || !user) return;
    lastHelloAt.current = Date.now();
    sendGameIfPeerLive('together-hello', {
      from: user.displayName,
      fromId: user.id,
    });
  }, [pair?.code, user?.id, user?.displayName]);

  const startCandle = () => {
    candleLogged.current = false;
    setCandleLeft(CANDLE_SEC);
    const result = sendPairMetaOrQueue('candle', { start: true, left: CANDLE_SEC });
    showPeer(result === 'sent' ? 'Свеча зажжена · у обоих' : 'Свеча · sync ждёт online');
    void juice.warmth();
    track('warmth_sent', { ritual: 'candle' });
  };

  const blowCandle = () => {
    if (!lit) return;
    candleLogged.current = true;
    lastBlowAt.current = Date.now();
    setCandleLeft(0);
    const result = sendPairMetaOrQueue('candle', { blow: true, left: 0 });
    showPeer(result === 'sent' ? 'Свеча погашена · у обоих' : 'Погасили · sync ждёт online');
    void juice.miss();
  };

  const changeSparkFilter = (f: SparkFilter) => {
    if (f === 'spicy' && !spicyUnlocked) {
      showPeer('Spicy pack · Duo Plus (Profile → Plus / trial)');
      void juice.miss();
      return;
    }
    setSparkFilter(f);
    lastSparkAt.current = Date.now();
    const nextDeck = sparksRu.filter((s) => s.filter === f);
    const dayIdx = dailySparkIndex(pair?.code ?? 'solo', f, nextDeck.length || 1);
    const result = sendPairMetaOrQueue('spark', {
      idx: dayIdx,
      filter: f,
      from: user?.displayName,
    });
    showPeer(
      result === 'sent'
        ? f === 'spicy'
          ? 'Spicy · у обоих · сегодня'
          : 'Soft · у обоих · сегодня'
        : `${f} · sync ждёт online`,
    );
    void juice.card();
  };

  const sendNote = () => {
    const text = draft.trim();
    if (!text) return;
    const note = addNote(text);
    if (!note) return;
    lastNoteSentAt.current = Date.now();
    lastNoteLen.current = note.text.trim().length;
    const { pendingSync: _p, ...payload } = note;
    if (sendGameIfPeerLive('tiny-note', payload)) {
      markNoteSynced(note.id);
      showPeer('Записка ушла');
    } else {
      showPeer('Записка ждёт online');
    }
    setDraft('');
    void juice.card();
    track('note_sent');
  };

  const deleteNote = (note: TinyNote) => {
    void (async () => {
      const ok = await confirmDestructive('Удалить заметку?', note.text.slice(0, 120));
      if (!ok) return;
      removeNote(note.id);
      const result = sendNoteMutationOrQueue('tiny-note-remove', {
        id: note.id,
        from: user?.displayName,
        fromId: user?.id,
      });
      showPeer(result === 'sent' ? 'Заметку удалили' : 'Удаление · sync ждёт online');
      void juice.miss();
    })();
  };

  const performDeleteNote = (note: TinyNote) => {
    removeNote(note.id);
    const result = sendNoteMutationOrQueue('tiny-note-remove', {
      id: note.id,
      from: user?.displayName,
      fromId: user?.id,
    });
    showPeer(result === 'sent' ? 'Заметку удалили' : 'Удаление · sync ждёт online');
    void juice.miss();
  };

  const reportNote = (note: TinyNote) => {
    void (async () => {
      const ok = await confirmDestructive(
        'Пожаловаться на записку?',
        'Скроем её у вас. Облачной модерации пока нет — жалоба только локальный лог.',
        'Скрыть',
      );
      if (!ok) return;
      removeNote(note.id);
      track('ugc_report', { kind: 'note', noteId: note.id });
      showPeer('Скрыто локально · жалоба записана');
      void juice.miss();
    })();
  };

  const deleteMemory = (id: string, title: string, detail: string) => {
    void (async () => {
      const ok = await confirmDestructive(
        'Удалить memory?',
        `«${title}» — ${detail.slice(0, 100)}`,
      );
      if (!ok) return;
      removeMemory(id);
      const result = broadcastMemoryRemove(id, user);
      showPeer(
        result === 'sent' ? `Memory «${title}» удалена` : `Memory «${title}» · sync ждёт online`,
      );
      void juice.miss();
    })();
  };

  const performDeleteMemory = (id: string, title: string) => {
    removeMemory(id);
    const result = broadcastMemoryRemove(id, user);
    showPeer(
      result === 'sent' ? `Memory «${title}» удалена` : `Memory «${title}» · sync ждёт online`,
    );
    void juice.miss();
  };

  const mins = candleLeft != null ? Math.floor(candleLeft / 60) : 0;
  const secs = candleLeft != null ? candleLeft % 60 : 0;
  const candlePct =
    candleLeft == null ? 0 : Math.max(0, Math.min(100, (candleLeft / CANDLE_SEC) * 100));

  const memByKind = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of memories) {
      map[m.kind] = (map[m.kind] ?? 0) + 1;
    }
    return map;
  }, [memories]);

  const noteChars = useMemo(
    () => notes.reduce((n, x) => n + x.text.trim().length, 0),
    [notes],
  );

  /** Same rule as sendGameIfPeerLive — presence alone can lie when room is 1. */
  const peerInWsRoom =
    Boolean(pair) && typeof pair?.roomSize === 'number' && pair.roomSize >= 2;

  return (
    <LpdBackground mood="warm">
      <ScrollView
        contentContainerStyle={[
          styles.root,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 },
        ]}
      >
        <Text style={styles.kicker}>Together</Text>
        <Text style={typography.headline}>Ритуалы и искры</Text>
        <Text style={typography.body}>
          {notes.length} заметок · {memories.length} memory · Daily Spark · {sparkFilter}
          {lit ? ` · свеча ${mins}:${secs.toString().padStart(2, '0')}` : ''}
          {pair
            ? peerInWsRoom
              ? ' · партнёр online'
              : pair.partnerPresence === 'online'
                ? ' · presence ≠ room'
                : ' · партнёр offline'
            : ' · нет пары'}
          {isPlus ? ' · Plus' : ' · Free'}
          {(() => {
            void outboxTick;
            const pending =
              pendingWarmthCount() +
              pendingNoteMutationCount() +
              pendingMemoryMutationCount() +
              notes.filter((n) => n.pendingSync).length +
              memories.filter((m) => m.pendingSync).length;
            return pending > 0 ? ` · sync ${pending}` : '';
          })()}
        </Text>
        <View style={styles.statStrip}>
          {(
            [
              ['n', String(notes.length), 'notes'],
              ['ch', String(noteChars), 'букв'],
              ['m', String(memories.length), 'memory'],
              ['s', 'день', 'spark'],
              ['f', sparkFilter, 'колода'],
              ['c', lit ? `${mins}:${secs.toString().padStart(2, '0')}` : 'off', 'свеча'],
              ['w', String(warmthPulse), 'тепло'],
              [
                'o',
                typeof pair?.roomSize === 'number' ? String(pair.roomSize) : '—',
                'online',
              ],
              ['p', peerInWsRoom ? 'on' : pair?.partnerPresence === 'online' ? '≠' : 'off', 'партнёр'],
            ] as const
          ).map(([k, n, l]) => (
            <View key={k} style={styles.statPill}>
              <Text style={styles.statPillNum}>{n}</Text>
              <Text style={styles.statPillLabel}>{l}</Text>
            </View>
          ))}
        </View>
        {pair && !peerInWsRoom ? (
          <Text style={styles.offlineBanner}>
            В WS нет партнёра ({typeof pair.roomSize === 'number' ? `${pair.roomSize}/2` : '—'}) —
            записки и тепло уйдут, когда комната станет 2/2. Пара {pair.code} сохранена.
          </Text>
        ) : null}

        <SectionRule label="Daily Spark · сегодня" right={sparkFilter} />

        <View style={styles.filterRow}>
          {(['soft', 'spicy'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => changeSparkFilter(f)}
              style={[
                styles.filterChip,
                sparkFilter === f && styles.filterChipOn,
                f === 'spicy' && !spicyUnlocked && styles.filterChipLocked,
              ]}
            >
              <Text
                style={[styles.filterChipLabel, sparkFilter === f && styles.filterChipLabelOn]}
              >
                {f === 'spicy' && !spicyUnlocked ? 'spicy · plus' : f}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.kind}>{card.kind}</Text>
          <Text style={styles.text}>{card.text}</Text>
          <Text style={styles.draftMeta}>Одна на день · завтра другая</Text>
          {peerToast ? <Text style={styles.peerToast}>{peerToast}</Text> : null}
        </View>

        <SectionRule label="Свеча" right={lit ? `${Math.round(candlePct)}%` : 'готово'} />

        <View style={styles.candleBlock}>
          <Text style={styles.candleTitle}>Candle Timer</Text>
          <Text style={styles.candleTime}>
            {candleLeft == null
              ? '2:00'
              : candleLeft <= 0
                ? 'погасла · тепло осталось'
                : `${mins}:${secs.toString().padStart(2, '0')}`}
          </Text>
          <View style={styles.candleTrack}>
            <View style={[styles.candleFill, { width: `${candleLeft == null ? 100 : candlePct}%` }]} />
          </View>
          <View style={styles.flame}>
            <Animated.View
              style={[styles.flameCore, lit && styles.flameLit, flameStyle]}
            />
          </View>
        </View>

        <SectionRule
          label="Записки"
          right={`${notes.length} · ${noteChars} букв${
            notes.some((n) => n.pendingSync) ? ` · ${notes.filter((n) => n.pendingSync).length} ждут` : ''
          }`}
        />

        <View style={styles.noteBlock}>
          <Text style={styles.candleTitle}>Tiny Notes</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Короткая записка партнёру…"
            placeholderTextColor={colors.textMuted}
            style={styles.noteInput}
            maxLength={180}
          />
          <Text style={styles.draftMeta}>{draft.trim().length}/180</Text>
          <LpdButton
            label={peerInWsRoom ? 'Отправить заметку' : 'Отправить (дождётся online)'}
            onPress={sendNote}
          />
          {notes.length === 0 ? (
            <EmptyState
              title="Пока тихо"
              body={
                peerInWsRoom
                  ? 'Первая записка уйдёт партнёру по WS — и останется в ленте у обоих.'
                  : 'Записка сохранится локально и уйдёт по WS, когда комната станет 2/2.'
              }
              meta={`0 notes · 0 букв · ${
                peerInWsRoom
                  ? 'WS 2/2'
                  : pair?.partnerPresence === 'online'
                    ? 'presence ≠ room'
                    : 'партнёр offline'
              }`}
            />
          ) : (
            notes.slice(0, 10).map((n) => (
              <View key={n.id} style={styles.noteRow}>
                <Text style={styles.noteItem}>
                  {n.from}: {n.text}
                  {n.pendingSync ? ' · ждёт' : ''}
                </Text>
                <View style={styles.noteActions}>
                  {n.from !== user?.displayName ? (
                    <Pressable
                      onPress={() => reportNote(n)}
                      style={styles.noteDelete}
                      accessibilityLabel="Пожаловаться на заметку"
                      hitSlop={12}
                    >
                      <Text style={styles.noteDeleteLabel}>!</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => deleteNote(n)}
                    onLongPress={() => performDeleteNote(n)}
                    delayLongPress={380}
                    style={styles.noteDelete}
                    accessibilityLabel="Удалить заметку"
                    hitSlop={12}
                  >
                    <Text style={styles.noteDeleteLabel}>×</Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.actions}>
          <LpdButton
            label={lit ? 'Свеча горит…' : 'Зажечь свечу (2 мин)'}
            disabled={lit}
            onPress={startCandle}
          />
          {lit ? (
            <LpdButton label="Погасить свечу" variant="ghost" onPress={blowCandle} />
          ) : null}
          <LpdButton
            label="Отправить тепло"
            variant="ghost"
            onPress={() => {
              warmthSentAt.current = Date.now();
              const result = sendWarmthOrQueue();
              showPeer(result === 'sent' ? 'Тепло ушло' : 'Тепло ждёт online');
              void juice.warmth();
              track('warmth_sent');
            }}
          />
        </View>

        <SectionRule
          label="Скрапбук"
          right={`${memories.length}/${maxMemories}${isPlus ? ' · Plus' : ' · Free'}${
            memories.length >= maxMemories ? ' · лимит' : ''
          }${
            memories.some((m) => m.pendingSync)
              ? ` · ${memories.filter((m) => m.pendingSync).length} ждут`
              : ''
          }`}
        />

        <View style={styles.memories}>
          <Text style={styles.memTitle}>Memories</Text>
          {memories.length > 0 ? (
            <View style={styles.memKinds}>
              {(
                [
                  ['sky', 'Sky'],
                  ['heartbeat', 'Beat'],
                  ['spark', 'ToS'],
                  ['candle', 'Свеча'],
                  ['draw', 'Draw'],
                  ['orbit', 'Orbit'],
                  ['duel', 'Duel'],
                  ['veil', 'Veil'],
                ] as const
              ).map(([kind, label]) => (
                <View key={kind} style={styles.memKindPill}>
                  <Text style={styles.memKindNum}>{memByKind[kind] ?? 0}</Text>
                  <Text style={styles.memKindLabel}>{label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {memories.length === 0 ? (
            <EmptyState
              title="Скрапбук пуст"
              body="Финиш игры или догоревшая свеча появятся здесь у обоих."
              meta={`0/${maxMemories} memory · ${isPlus ? 'Plus' : 'Free'} · сыграйте раунд`}
            />
          ) : (
            <>
              {memories.slice(0, 12).map((m) => (
                <View key={m.id} style={styles.memRow}>
                  <Text style={styles.memKindTag}>{m.kind}</Text>
                  <Text style={styles.memItem}>
                    {m.title} — {m.detail}
                    {m.pendingSync ? ' · ждёт' : ''}
                  </Text>
                  <Pressable
                    onPress={() => deleteMemory(m.id, m.title, m.detail)}
                    onLongPress={() => performDeleteMemory(m.id, m.title)}
                    delayLongPress={380}
                    style={styles.noteDelete}
                    accessibilityLabel="Удалить memory"
                    hitSlop={12}
                  >
                    <Text style={styles.noteDeleteLabel}>×</Text>
                  </Pressable>
                </View>
              ))}
              <LpdButton
                label="Очистить memories"
                variant="ghost"
                onPress={() => {
                  void confirmDestructive(
                    'Очистить все memories?',
                    'История у тебя и у партнёра.',
                  ).then((ok) => {
                    if (!ok) return;
                    clearMemories();
                    const result = broadcastMemoryClear(user);
                    showPeer(
                      result === 'sent'
                        ? 'Memories очищены у обоих'
                        : 'Очистка · sync ждёт online',
                    );
                    void juice.miss();
                  });
                }}
              />
            </>
          )}
        </View>
      </ScrollView>
    </LpdBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  kicker: {
    fontFamily: fonts.uiMedium,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accentRose,
    fontSize: 12,
  },
  statStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statPill: {
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,214,186,0.14)',
    backgroundColor: 'rgba(255,214,186,0.04)',
    alignItems: 'center',
  },
  statPillNum: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.accentAmber,
  },
  statPillLabel: {
    fontFamily: fonts.ui,
    fontSize: 9,
    color: colors.textMuted,
  },
  offlineBanner: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 17,
    color: colors.accentRose,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(232,196,122,0.28)',
    backgroundColor: 'rgba(36,28,49,0.4)',
  },
  filterChipOn: {
    borderColor: colors.accentAmber,
    backgroundColor: 'rgba(232,196,122,0.12)',
  },
  filterChipLocked: {
    opacity: 0.55,
  },
  filterChipLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  filterChipLabelOn: {
    color: colors.accentAmber,
  },
  card: {
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.22)',
    backgroundColor: 'rgba(36,28,49,0.7)',
    padding: spacing.xl,
    gap: spacing.md,
    minHeight: 140,
  },
  kind: {
    fontFamily: fonts.uiMedium,
    color: colors.accentAmber,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    fontSize: 12,
  },
  text: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 32,
    color: colors.textPrimary,
  },
  peerToast: {
    fontFamily: fonts.uiMedium,
    color: colors.accentRose,
    fontSize: 13,
  },
  candleBlock: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(36,28,49,0.45)',
  },
  candleTitle: {
    fontFamily: fonts.uiMedium,
    color: colors.accentAmber,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  candleTime: {
    fontFamily: fonts.mono,
    fontSize: 28,
    color: colors.textPrimary,
  },
  candleTrack: {
    alignSelf: 'stretch',
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  candleFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accentAmber,
  },
  draftMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
    alignSelf: 'flex-end',
  },
  memKinds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  memKindPill: {
    minWidth: 40,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,214,186,0.14)',
    backgroundColor: 'rgba(255,214,186,0.04)',
    alignItems: 'center',
  },
  memKindNum: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.accentAmber,
  },
  memKindLabel: {
    fontFamily: fonts.ui,
    fontSize: 9,
    color: colors.textMuted,
  },
  memKindTag: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.accentMist,
    marginTop: 2,
    width: 52,
  },
  flame: {
    height: 36,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  flameCore: {
    width: 12,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textMuted,
    opacity: 0.35,
  },
  flameLit: {
    backgroundColor: colors.accentAmber,
    shadowColor: colors.accentAmber,
    shadowOpacity: 0.9,
    shadowRadius: 14,
  },
  noteBlock: {
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    padding: spacing.lg,
    backgroundColor: 'rgba(36,28,49,0.45)',
  },
  noteInput: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    fontFamily: fonts.ui,
  },
  noteItem: {
    flex: 1,
    fontFamily: fonts.ui,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  noteActions: {
    flexDirection: 'row',
    gap: 4,
  },
  noteDelete: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(196,92,110,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(196,92,110,0.12)',
  },
  noteDeleteLabel: {
    color: colors.accentRose,
    fontFamily: fonts.uiSemi,
    fontSize: 16,
    lineHeight: 18,
    marginTop: -1,
  },
  actions: {
    gap: spacing.sm,
  },
  memories: {
    gap: 6,
    marginTop: spacing.sm,
  },
  memTitle: {
    fontFamily: fonts.uiMedium,
    color: colors.accentAmber,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  memItem: {
    flex: 1,
    fontFamily: fonts.ui,
    color: colors.textSecondary,
    fontSize: 13,
  },
  memRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
});
