import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii } from '../theme/tokens';

type Props = {
  game: 'sky' | 'heartbeat' | 'spark';
};

const gradients: Record<Props['game'], [string, string, string]> = {
  sky: ['rgba(226,176,122,0.55)', 'rgba(142,59,74,0.35)', 'rgba(7,6,10,0.2)'],
  heartbeat: ['rgba(227,154,160,0.55)', 'rgba(122,140,163,0.25)', 'rgba(7,6,10,0.25)'],
  spark: ['rgba(122,140,163,0.45)', 'rgba(226,176,122,0.28)', 'rgba(7,6,10,0.3)'],
};

export function GameCover({ game }: Props) {
  return (
    <View style={styles.wrap}>
      <LinearGradient colors={gradients[game]} style={StyleSheet.absoluteFill} />
      {game === 'sky' ? (
        <>
          <View style={[styles.orb, { top: 10, left: 18, backgroundColor: colors.accentAmber }]} />
          <View style={[styles.orb, { top: 28, right: 22, backgroundColor: colors.accentRose, width: 10, height: 10 }]} />
          <View style={[styles.orb, { bottom: 14, left: 36, backgroundColor: colors.accentWine, width: 8, height: 8 }]} />
        </>
      ) : null}
      {game === 'heartbeat' ? <View style={styles.ring} /> : null}
      {game === 'spark' ? (
        <View style={styles.sparkMark}>
          <View style={styles.sparkBar} />
          <View style={[styles.sparkBar, styles.sparkBarCross]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 64,
    height: 64,
    borderRadius: radii.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  orb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 999,
    shadowColor: colors.accentAmber,
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  ring: {
    position: 'absolute',
    alignSelf: 'center',
    top: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: colors.accentRose,
  },
  sparkMark: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkBar: {
    width: 22,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accentAmber,
  },
  sparkBarCross: {
    position: 'absolute',
    transform: [{ rotate: '90deg' }],
    backgroundColor: colors.accentRose,
  },
});
