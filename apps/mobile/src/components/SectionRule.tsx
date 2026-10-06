import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../theme/tokens';

type Props = {
  label?: string;
  right?: string;
};

/** Thin ornamental divider — fills empty vertical gaps without card chrome. */
export function SectionRule({ label, right }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {right ? <Text style={styles.right}>{right}</Text> : null}
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: 2,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,214,186,0.22)',
  },
  label: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  right: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.accentAmber,
  },
});
