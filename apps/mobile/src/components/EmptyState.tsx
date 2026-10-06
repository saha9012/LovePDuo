import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

type Props = {
  title: string;
  body: string;
  /** Optional numbers / meta line under body */
  meta?: string;
};

export function EmptyState({ title, body, meta }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.emberRow}>
        <View style={[styles.ember, { backgroundColor: colors.accentRose }]} />
        <View style={[styles.ember, { backgroundColor: colors.accentAmber, width: 36 }]} />
        <View style={[styles.ember, { backgroundColor: colors.accentMist, width: 10 }]} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={typography.body}>{body}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(36,28,49,0.5)',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emberRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  ember: {
    height: 3,
    width: 18,
    borderRadius: 2,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.textPrimary,
  },
  meta: {
    marginTop: 4,
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.accentAmber,
    letterSpacing: 0.4,
  },
});
