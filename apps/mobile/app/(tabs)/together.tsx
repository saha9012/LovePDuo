import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { sparksRu } from '../../src/content/sparks';

export default function TogetherScreen() {
  const insets = useSafeAreaInsets();
  const [idx, setIdx] = useState(0);
  const soft = useMemo(() => sparksRu.filter((s) => s.filter === 'soft'), []);
  const card = soft[idx % soft.length];

  return (
    <LpdBackground mood="warm">
      <View style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.kicker}>Together</Text>
        <Text style={typography.headline}>Ритуалы и искры</Text>
        <Text style={typography.body}>Daily Spark, тепло и маленькие заметки вечера.</Text>

        <View style={styles.card}>
          <Text style={styles.kind}>{card.kind}</Text>
          <Text style={styles.text}>{card.text}</Text>
        </View>

        <View style={styles.actions}>
          <LpdButton label="Следующая искра" onPress={() => setIdx((v) => v + 1)} />
          <View style={styles.rituals}>
            <Text style={styles.ritual}>🕯 Candle Timer — скоро</Text>
            <Text style={styles.ritual}>✉️ Tiny Notes — скоро</Text>
            <Text style={styles.ritual}>✦ Memories лучших раундов — скоро</Text>
          </View>
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
    marginTop: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.22)',
    backgroundColor: 'rgba(36,28,49,0.7)',
    padding: spacing.xl,
    gap: spacing.md,
    minHeight: 180,
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
    fontSize: 26,
    lineHeight: 34,
    color: colors.textPrimary,
  },
  actions: {
    marginTop: 'auto',
    gap: spacing.md,
  },
  rituals: {
    gap: 8,
  },
  ritual: {
    fontFamily: fonts.ui,
    color: colors.textMuted,
    fontSize: 14,
  },
});
