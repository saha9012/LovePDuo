import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii } from '../theme/tokens';

type Props = {
  game: 'sky' | 'heartbeat' | 'spark' | 'draw' | 'orbit';
};

const gradients: Record<Props['game'], [string, string, string]> = {
  sky: ['rgba(226,176,122,0.55)', 'rgba(142,59,74,0.35)', 'rgba(7,6,10,0.2)'],
  heartbeat: ['rgba(227,154,160,0.55)', 'rgba(122,140,163,0.25)', 'rgba(7,6,10,0.25)'],
  spark: ['rgba(122,140,163,0.45)', 'rgba(226,176,122,0.28)', 'rgba(7,6,10,0.3)'],
  draw: ['rgba(226,176,122,0.4)', 'rgba(227,154,160,0.35)', 'rgba(7,6,10,0.25)'],
  orbit: ['rgba(122,140,163,0.5)', 'rgba(226,176,122,0.3)', 'rgba(7,6,10,0.3)'],
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
      {game === 'draw' ? (
        <>
          <View style={styles.strokeA} />
          <View style={styles.strokeB} />
        </>
      ) : null}
      {game === 'orbit' ? (
        <>
          <View style={styles.orbitRing} />
          <View style={[styles.orb, { top: 18, left: 14, backgroundColor: colors.accentAmber, width: 8, height: 8 }]} />
          <View style={[styles.orb, { bottom: 16, right: 14, backgroundColor: colors.accentRose, width: 11, height: 11 }]} />
        </>
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
  strokeA: {
    position: 'absolute',
    top: 22,
    left: 10,
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accentAmber,
    transform: [{ rotate: '-18deg' }],
  },
  strokeB: {
    position: 'absolute',
    top: 36,
    left: 16,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.accentRose,
    transform: [{ rotate: '22deg' }],
  },
  orbitRing: {
    position: 'absolute',
    alignSelf: 'center',
    top: 12,
    left: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(226,176,122,0.55)',
  },
});
