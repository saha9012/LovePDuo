import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';
import { juice } from '../audio/juice';
import { track } from '../analytics/track';

type Props = {
  title: string;
  line: string;
  winnerLabel?: string;
  gameId?: string;
  /** When true, rematch CTA admits Solo demo (no live duo). */
  soloDemo?: boolean;
  onRematch?: () => void;
  onHome?: () => void;
};

export function PostMatchCard({
  title,
  line,
  winnerLabel,
  gameId,
  soloDemo,
  onRematch,
  onHome,
}: Props) {
  useEffect(() => {
    track('game_finished', { game: gameId ?? title });
  }, [gameId, title]);

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>{winnerLabel ?? 'Раунд закрыт'}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={typography.tease}>{line}</Text>
      <View style={styles.actions}>
        {onRematch ? (
          <Pressable
            onPress={() => {
              track('game_started', {
                game: gameId ?? title,
                rematch: true,
                solo: soloDemo ? true : undefined,
              });
              void juice.sync();
              onRematch();
            }}
            style={styles.primary}
          >
            <Text style={styles.primaryLabel}>
              {soloDemo ? 'Ещё раунд · Solo demo' : 'Ещё раунд'}
            </Text>
          </Pressable>
        ) : null}
        {onHome ? (
          <Pressable onPress={onHome} style={styles.ghost}>
            <Text style={styles.ghostLabel}>
              {soloDemo ? 'В лобби · Solo/Demo' : 'В лобби'}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.22)',
    backgroundColor: 'rgba(36,28,49,0.82)',
    padding: spacing.xl,
    gap: spacing.md,
  },
  kicker: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.accentAmber,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 36,
    color: colors.textPrimary,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  primary: {
    minHeight: 50,
    borderRadius: radii.md,
    backgroundColor: colors.accentWine,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.3)',
  },
  primaryLabel: {
    fontFamily: fonts.uiSemi,
    color: colors.textPrimary,
    fontSize: 16,
  },
  ghost: {
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostLabel: {
    fontFamily: fonts.uiMedium,
    color: colors.accentAmber,
    fontSize: 15,
  },
});
