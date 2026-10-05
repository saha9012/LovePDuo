import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

type Props = {
  size?: 'hero' | 'nav' | 'compact';
  showTagline?: boolean;
};

export function BrandMark({ size = 'nav', showTagline = false }: Props) {
  const isHero = size === 'hero';
  const isCompact = size === 'compact';

  return (
    <View style={styles.wrap}>
      <Text
        style={[
          isHero ? typography.brandHero : typography.brandMark,
          isCompact && styles.compact,
        ]}
      >
        LovePDuo
      </Text>
      {showTagline ? (
        <Text style={styles.tagline}>Love Play Duo</Text>
      ) : null}
      {isHero ? (
        <View style={styles.emberRow}>
          <View style={[styles.ember, styles.emberRose]} />
          <View style={[styles.ember, styles.emberAmber]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
  },
  compact: {
    fontSize: 22,
    lineHeight: 26,
  },
  tagline: {
    marginTop: spacing.sm,
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.accentAmber,
  },
  emberRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.lg,
  },
  ember: {
    width: 28,
    height: 3,
    borderRadius: 2,
  },
  emberRose: {
    backgroundColor: colors.accentRose,
  },
  emberAmber: {
    backgroundColor: colors.accentAmber,
    width: 48,
  },
});
