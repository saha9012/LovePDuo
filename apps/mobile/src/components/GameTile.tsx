import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, spacing } from '../theme/tokens';
import { GameCover } from './GameCover';

type Props = {
  title: string;
  subtitle: string;
  accent?: 'rose' | 'amber' | 'mist';
  cover?: 'sky' | 'heartbeat' | 'spark' | 'draw' | 'orbit' | 'duel' | 'veil';
  onPress?: () => void;
  badge?: string;
  /** Lifetime starts on this device */
  plays?: number;
};

const accents = {
  rose: colors.accentRose,
  amber: colors.accentAmber,
  mist: colors.accentMist,
};

export function GameTile({
  title,
  subtitle,
  accent = 'amber',
  cover,
  onPress,
  badge,
  plays,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={[styles.bar, { backgroundColor: accents[accent] }]} />
      {cover ? (
        <View style={styles.coverWrap}>
          <GameCover game={cover} />
        </View>
      ) : null}
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.badges}>
            {typeof plays === 'number' ? (
              <Text style={styles.plays}>{plays}×</Text>
            ) : null}
            {badge ? <Text style={styles.badge}>{badge}</Text> : null}
          </View>
        </View>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(36,28,49,0.55)',
    minHeight: 96,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  bar: {
    width: 5,
    alignSelf: 'stretch',
  },
  coverWrap: {
    paddingLeft: spacing.md,
  },
  body: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: fonts.uiSemi,
    fontSize: 18,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  subtitle: {
    fontFamily: fonts.ui,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  plays: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.accentMist,
  },
  badge: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    color: colors.accentAmber,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});
