import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { sparksRu } from '../../src/content/sparks';
import { juice } from '../../src/audio/juice';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { useApp } from '../../src/store/AppStore';

const CANDLE_SEC = 120;

export default function TogetherScreen() {
  const insets = useSafeAreaInsets();
  const { user, pair, sendWarmth } = useApp();
  const [idx, setIdx] = useState(0);
  const [candleLeft, setCandleLeft] = useState<number | null>(null);
  const soft = useMemo(() => sparksRu.filter((s) => s.filter === 'soft'), []);
  const card = soft[idx % soft.length];

  useEffect(() => {
    if (candleLeft == null || candleLeft <= 0) return;
    const t = setTimeout(() => setCandleLeft((v) => (v == null ? v : v - 1)), 1000);
    return () => clearTimeout(t);
  }, [candleLeft]);

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'game' && msg.gameId === 'candle') {
        const payload = msg.payload as { left?: number; start?: boolean } | undefined;
        if (payload?.start) setCandleLeft(CANDLE_SEC);
        if (typeof payload?.left === 'number') setCandleLeft(payload.left);
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id]);

  const startCandle = () => {
    setCandleLeft(CANDLE_SEC);
    pairRealtime.sendGame('candle', { start: true, left: CANDLE_SEC });
    void juice.warmth();
  };

  const nextSpark = () => {
    setIdx((v) => v + 1);
    void juice.card();
  };

  const mins = candleLeft != null ? Math.floor(candleLeft / 60) : 0;
  const secs = candleLeft != null ? candleLeft % 60 : 0;

  return (
    <LpdBackground mood="warm">
      <View style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.kicker}>Together</Text>
        <Text style={typography.headline}>Ритуалы и искры</Text>
        <Text style={typography.body}>Daily Spark, свеча и тепло — маленькие якоря вечера.</Text>

        <View style={styles.card}>
          <Text style={styles.kind}>{card.kind}</Text>
          <Text style={styles.text}>{card.text}</Text>
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
            <View
              style={[
                styles.flameCore,
                candleLeft != null && candleLeft > 0 && styles.flameLit,
              ]}
            />
          </View>
        </View>

        <View style={styles.actions}>
          <LpdButton label="Следующая искра" onPress={nextSpark} />
          <LpdButton
            label={candleLeft != null && candleLeft > 0 ? 'Свеча горит…' : 'Зажечь свечу (2 мин)'}
            variant="ghost"
            disabled={candleLeft != null && candleLeft > 0}
            onPress={startCandle}
          />
          <LpdButton
            label="Отправить тепло"
            variant="ghost"
            onPress={() => {
              sendWarmth();
              pairRealtime.sendWarmth();
              void juice.warmth();
            }}
          />
        </View>
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
  kicker: {
    fontFamily: fonts.uiMedium,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accentRose,
    fontSize: 12,
  },
  card: {
    marginTop: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.22)',
    backgroundColor: 'rgba(36,28,49,0.7)',
    padding: spacing.xl,
    gap: spacing.md,
    minHeight: 160,
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
    height: 28,
    justifyContent: 'center',
  },
  flameCore: {
    width: 10,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.textMuted,
    opacity: 0.35,
  },
  flameLit: {
    backgroundColor: colors.accentAmber,
    opacity: 1,
    shadowColor: colors.accentAmber,
    shadowOpacity: 0.9,
    shadowRadius: 12,
  },
  actions: {
    marginTop: 'auto',
    gap: spacing.sm,
  },
});
