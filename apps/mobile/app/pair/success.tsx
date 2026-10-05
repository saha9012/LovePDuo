import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';

export default function PairSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pair } = useApp();
  const scale = useSharedValue(0.86);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 700 });
    scale.value = withSequence(
      withTiming(1.04, { duration: 520, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 280 }),
    );
  }, [opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <LpdBackground mood="warm">
      <View style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <Animated.View style={[styles.center, style]}>
          <Text style={styles.kicker}>Pair link</Text>
          <Text style={styles.title}>Вы связаны</Text>
          <Text style={typography.tease}>Два телефона. Одна комната. Можно жечь.</Text>
          <View style={styles.codeBlock}>
            <Text style={styles.codeLabel}>Код пары</Text>
            <Text style={typography.code}>{pair?.code ?? '------'}</Text>
          </View>
          <Text style={styles.hint}>Покажи код партнёру или оставь для deep link lovepduo://join/{pair?.code}</Text>
        </Animated.View>
        <LpdButton label="В комнату пары" onPress={() => router.replace('/(tabs)/home')} />
      </View>
    </LpdBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  kicker: {
    fontFamily: fonts.uiMedium,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accentAmber,
    fontSize: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 48,
    color: colors.textPrimary,
  },
  codeBlock: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  codeLabel: {
    fontFamily: fonts.ui,
    color: colors.textMuted,
    fontSize: 13,
  },
  hint: {
    marginTop: spacing.lg,
    fontFamily: fonts.ui,
    color: colors.textSecondary,
    lineHeight: 20,
    fontSize: 14,
  },
});
