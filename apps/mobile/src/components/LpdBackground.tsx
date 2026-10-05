import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../theme/tokens';

type Mood = 'night' | 'warm' | 'rain';

type Props = {
  children?: React.ReactNode;
  mood?: Mood;
  style?: ViewStyle;
  intensity?: number;
};

const moodGlows: Record<Mood, [string, string, string]> = {
  night: ['rgba(226,176,122,0.18)', 'rgba(227,154,160,0.12)', 'rgba(122,140,163,0.08)'],
  warm: ['rgba(226,176,122,0.28)', 'rgba(142,59,74,0.18)', 'rgba(227,154,160,0.10)'],
  rain: ['rgba(122,140,163,0.22)', 'rgba(227,154,160,0.08)', 'rgba(226,176,122,0.06)'],
};

export function LpdBackground({
  children,
  mood = 'night',
  style,
  intensity = 1,
}: Props) {
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breath]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + breath.value * 0.35 * intensity,
    transform: [{ scale: 1 + breath.value * 0.08 * intensity }],
  }));

  const [g0, g1, g2] = moodGlows[mood];

  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={[colors.bg0, colors.bg1, colors.bg2]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.glowWrap, glowStyle]}>
        <LinearGradient
          colors={[g0, 'transparent']}
          style={[styles.glow, styles.glowTop]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
        />
        <LinearGradient
          colors={[g1, 'transparent']}
          style={[styles.glow, styles.glowMid]}
          start={{ x: 1, y: 0.2 }}
          end={{ x: 0, y: 1 }}
        />
        <LinearGradient
          colors={[g2, 'transparent']}
          style={[styles.glow, styles.glowBottom]}
          start={{ x: 0.5, y: 1 }}
          end={{ x: 0.5, y: 0 }}
        />
      </Animated.View>
      <View pointerEvents="none" style={styles.vignette} />
      <View pointerEvents="none" style={styles.grain} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
    overflow: 'hidden',
  },
  glowWrap: {
    ...StyleSheet.absoluteFill,
  },
  glow: {
    position: 'absolute',
    width: '90%',
    height: '55%',
    borderRadius: 999,
  },
  glowTop: {
    top: -40,
    left: -20,
  },
  glowMid: {
    top: '28%',
    right: -60,
    width: '70%',
    height: '45%',
  },
  glowBottom: {
    bottom: -30,
    left: '10%',
    width: '80%',
    height: '40%',
  },
  vignette: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowColor: '#000',
    shadowOpacity: 0.85,
    shadowRadius: 40,
  },
  grain: {
    ...StyleSheet.absoluteFill,
    opacity: 0.045,
    backgroundColor: 'transparent',
    // soft noise substitute via dense diagonal stroke feel
    borderColor: 'rgba(255,214,186,0.04)',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
