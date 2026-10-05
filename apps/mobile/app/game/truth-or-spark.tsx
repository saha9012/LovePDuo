import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { SparkFilter, sparksRu } from '../../src/content/sparks';

const SKIP_LIMIT = 3;

export default function TruthOrSparkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<SparkFilter>('soft');
  const [index, setIndex] = useState(0);
  const [skips, setSkips] = useState(SKIP_LIMIT);

  const deck = useMemo(
    () => sparksRu.filter((c) => c.filter === filter),
    [filter],
  );
  const card = deck[index % deck.length];

  const next = () => setIndex((v) => v + 1);
  const skip = () => {
    if (skips <= 0) return;
    setSkips((s) => s - 1);
    next();
  };

  return (
    <LpdBackground mood={filter === 'spicy' ? 'warm' : 'night'}>
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.top}>
          <Text style={styles.title}>Truth Or Spark</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>Закрыть</Text>
          </Pressable>
        </View>

        <View style={styles.filters}>
          {(['soft', 'spicy'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => {
                setFilter(f);
                setIndex(0);
                setSkips(SKIP_LIMIT);
              }}
              style={[styles.chip, filter === f && styles.chipActive]}
            >
              <Text style={[styles.chipLabel, filter === f && styles.chipLabelActive]}>
                {f}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.kind}>{card.kind}</Text>
          <Text style={styles.text}>{card.text}</Text>
          <Text style={styles.meta}>
            Карточка {(index % deck.length) + 1}/{deck.length} · skip осталось {skips}
          </Text>
        </View>

        <View style={styles.actions}>
          <LpdButton label="Дальше" onPress={next} />
          <LpdButton
            label="Skip"
            variant="ghost"
            disabled={skips <= 0}
            onPress={skip}
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
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.uiSemi,
    color: colors.textPrimary,
    fontSize: 18,
  },
  back: {
    fontFamily: fonts.uiMedium,
    color: colors.accentAmber,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    borderColor: 'rgba(226,176,122,0.5)',
    backgroundColor: 'rgba(226,176,122,0.12)',
  },
  chipLabel: {
    fontFamily: fonts.uiMedium,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontSize: 12,
  },
  chipLabelActive: {
    color: colors.accentAmber,
  },
  card: {
    flex: 1,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(227,154,160,0.25)',
    backgroundColor: 'rgba(36,28,49,0.72)',
    padding: spacing.xl,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  kind: {
    fontFamily: fonts.uiMedium,
    color: colors.accentRose,
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontSize: 12,
  },
  text: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 36,
    color: colors.textPrimary,
  },
  meta: {
    fontFamily: fonts.ui,
    color: colors.textMuted,
    fontSize: 13,
  },
  actions: {
    gap: spacing.sm,
  },
});
