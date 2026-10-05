import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { sparksRu } from '../../src/content/sparks';
import { juice } from '../../src/audio/juice';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { TinyNote, useApp } from '../../src/store/AppStore';
import { useMemories } from '../../src/store/MemoriesStore';
import { track } from '../../src/analytics/track';

const CANDLE_SEC = 120;

export default function TogetherScreen() {
  const insets = useSafeAreaInsets();
  const { user, pair, notes, addNote, receiveNote, warmthPulse } = useApp();
  const { items: memories, clearMemories, addMemory } = useMemories();
  const [idx, setIdx] = useState(0);
  const [candleLeft, setCandleLeft] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [peerToast, setPeerToast] = useState<string | null>(null);
  const soft = useMemo(() => sparksRu.filter((s) => s.filter === 'soft'), []);
  const card = soft[idx % soft.length];
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

  useEffect(() => {
    candleLitRef.current = lit;
  }, [lit]);

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
  }, [warmthPulse]);

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
      pairRealtime.sendGame('candle', { left: candleLeft });
    }
  }, [candleLeft]);

  useEffect(() => {
    if (candleLeft !== 0 || candleLogged.current) return;
    candleLogged.current = true;
    lastCandleEndAt.current = Date.now();
    void juice.postMatch();
    pairRealtime.sendGame('candle', { end: true, left: 0 });
    showPeer('Свеча догорела');
    addMemory({
      kind: 'candle',
      title: 'Candle',
      detail: 'Две минуты огня. Тепло осталось.',
    });
  }, [candleLeft, addMemory]);

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'peer_left') {
        showPeer('Партнёр ушёл с Together');
        void juice.miss();
        return;
      }
      if (msg.type === 'peer_joined') {
        showPeer('Партнёр снова рядом');
        void juice.warmth();
        lastHelloAt.current = Date.now();
        pairRealtime.sendGame('together-hello', {
          from: user.displayName,
          fromId: user.id,
        });
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
        const payload = msg.payload as { idx?: number; from?: string } | undefined;
        if (typeof payload?.idx === 'number') {
          setIdx(payload.idx);
          const both = Date.now() - lastSparkAt.current < 2200;
          const racing =
            both &&
            (peerToastRef.current === 'Оба: новая искра' ||
              peerToastRef.current === 'Оба в искрах');
          showPeer(
            racing
              ? 'Оба в искрах'
              : both
                ? 'Оба: новая искра'
                : payload.from
                  ? `${payload.from}: новая искра`
                  : 'Новая искра от партнёра',
          );
          void (both ? juice.perfect() : juice.card());
        }
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
              ? `Оба на буквах · ${snip}`
              : chatty
                ? `Переписка · ${payload.from ?? 'Партнёр'}: ${snip}`
                : `${payload.from ?? 'Партнёр'}: ${snip}`,
          );
          void (sameLen || chatty ? juice.perfect() : juice.card());
        }
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id, receiveNote]);

  useEffect(() => {
    if (!pair || !user) return;
    lastHelloAt.current = Date.now();
    pairRealtime.sendGame('together-hello', {
      from: user.displayName,
      fromId: user.id,
    });
  }, [pair?.code, user?.id, user?.displayName]);

  const startCandle = () => {
    candleLogged.current = false;
    setCandleLeft(CANDLE_SEC);
    pairRealtime.sendGame('candle', { start: true, left: CANDLE_SEC });
    void juice.warmth();
    track('warmth_sent', { ritual: 'candle' });
  };

  const blowCandle = () => {
    if (!lit) return;
    candleLogged.current = true;
    lastBlowAt.current = Date.now();
    setCandleLeft(0);
    pairRealtime.sendGame('candle', { blow: true, left: 0 });
    void juice.miss();
  };

  const nextSpark = () => {
    setIdx((v) => {
      const next = v + 1;
      lastSparkAt.current = Date.now();
      pairRealtime.sendGame('spark', {
        idx: next,
        from: user?.displayName,
      });
      return next;
    });
    void juice.card();
  };

  const sendNote = () => {
    const text = draft.trim();
    if (!text) return;
    addNote(text);
    const note: TinyNote = {
      id: `note_${Date.now().toString(36)}`,
      text: text.slice(0, 180),
      from: user?.displayName ?? 'Ты',
      at: Date.now(),
    };
    lastNoteSentAt.current = Date.now();
    lastNoteLen.current = note.text.trim().length;
    pairRealtime.sendGame('tiny-note', note);
    setDraft('');
    void juice.card();
    track('note_sent');
  };

  const mins = candleLeft != null ? Math.floor(candleLeft / 60) : 0;
  const secs = candleLeft != null ? candleLeft % 60 : 0;

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
        <Text style={typography.body}>Daily Spark, свеча, заметки и тепло.</Text>

        <View style={styles.card}>
          <Text style={styles.kind}>{card.kind}</Text>
          <Text style={styles.text}>{card.text}</Text>
          {peerToast ? <Text style={styles.peerToast}>{peerToast}</Text> : null}
        </View>

        <View style={styles.candleBlock}>
          <Text style={styles.candleTitle}>Candle Timer</Text>
          <Text style={styles.candleTime}>
            {candleLeft == null
              ? '2:00'
              : candleLeft <= 0
                ? 'погасла · тепло осталось'
                : `${mins}:${secs.toString().padStart(2, '0')}`}
          </Text>
          <View style={styles.flame}>
            <Animated.View
              style={[styles.flameCore, lit && styles.flameLit, flameStyle]}
            />
          </View>
        </View>

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
          <LpdButton label="Отправить заметку" onPress={sendNote} />
          {notes.slice(0, 6).map((n) => (
            <Text key={n.id} style={styles.noteItem}>
              {n.from}: {n.text}
            </Text>
          ))}
        </View>

        <View style={styles.actions}>
          <LpdButton label="Следующая искра" onPress={nextSpark} />
          <LpdButton
            label={lit ? 'Свеча горит…' : 'Зажечь свечу (2 мин)'}
            variant="ghost"
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
              pairRealtime.sendWarmth();
              showPeer('Тепло ушло');
              void juice.warmth();
              track('warmth_sent');
            }}
          />
        </View>

        {memories.length > 0 ? (
          <View style={styles.memories}>
            <Text style={styles.memTitle}>Memories</Text>
            {memories.slice(0, 5).map((m) => (
              <Text key={m.id} style={styles.memItem}>
                {m.title} — {m.detail}
              </Text>
            ))}
            <LpdButton
              label="Очистить memories"
              variant="ghost"
              onPress={() => {
                clearMemories();
                void juice.miss();
              }}
            />
          </View>
        ) : null}
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
    fontFamily: fonts.ui,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
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
    fontFamily: fonts.ui,
    color: colors.textSecondary,
    fontSize: 13,
  },
});
