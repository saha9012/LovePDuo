import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../src/components/LpdBackground';
import { BrandMark } from '../src/components/BrandMark';
import { LpdButton } from '../src/components/LpdButton';
import { colors, fonts, spacing } from '../src/theme/tokens';
import { typography } from '../src/theme/typography';
import { useApp } from '../src/store/AppStore';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, pair, signIn } = useApp();
  const veil = useSharedValue(0);
  const rise = useSharedValue(24);

  useEffect(() => {
    veil.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    rise.value = withDelay(
      120,
      withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) }),
    );
  }, [veil, rise]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: veil.value,
    transform: [{ translateY: rise.value }],
  }));

  const enter = async () => {
    if (!user) {
      await signIn('Ты');
    }
    if (pair) {
      router.replace('/(tabs)/home');
    } else {
      router.push('/pair/create');
    }
  };

  return (
    <LpdBackground mood="night">
      <View style={[styles.root, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}>
        <Animated.View style={[styles.hero, contentStyle]}>
          <Text style={styles.kicker}>LPD online</Text>
          <BrandMark size="hero" showTagline />
          <Text style={[typography.body, styles.sub]}>
            Тёмная игровая зона для двоих. Янтарь, пыльная роза и раунды с двух телефонов.
          </Text>
        </Animated.View>

        <Animated.View style={[styles.cta, contentStyle]}>
          <LpdButton label="Войти в комнату" onPress={() => void enter()} />
          <LpdButton
            label="У меня есть код пары"
            variant="ghost"
            onPress={async () => {
              if (!user) await signIn('Ты');
              router.push('/pair/join');
            }}
          />
          <Text style={styles.foot}>Пара в сборе. Можно жечь.</Text>
        </Animated.View>
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
  hero: {
    gap: spacing.lg,
    paddingTop: spacing.xxxl,
  },
  kicker: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accentRose,
  },
  sub: {
    maxWidth: 340,
    marginTop: spacing.md,
  },
  cta: {
    gap: spacing.md,
  },
  foot: {
    marginTop: spacing.sm,
    textAlign: 'center',
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.textMuted,
  },
});
