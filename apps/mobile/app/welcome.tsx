import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../src/components/LpdBackground';
import { BrandMark } from '../src/components/BrandMark';
import { LpdButton } from '../src/components/LpdButton';
import { colors, fonts, radii, spacing } from '../src/theme/tokens';
import { typography } from '../src/theme/typography';
import { useApp } from '../src/store/AppStore';
import { juice } from '../src/audio/juice';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, pair, signIn } = useApp();
  const [name, setName] = useState(user?.displayName ?? '');
  const veil = useSharedValue(0);
  const rise = useSharedValue(28);
  const orbit = useSharedValue(0);

  useEffect(() => {
    veil.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) });
    rise.value = withDelay(
      100,
      withTiming(0, { duration: 900, easing: Easing.out(Easing.cubic) }),
    );
    orbit.value = withRepeat(
      withTiming(1, { duration: 6800, easing: Easing.linear }),
      -1,
      false,
    );
  }, [veil, rise, orbit]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: veil.value,
    transform: [{ translateY: rise.value }],
  }));

  const orbitStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + veil.value * 0.45,
    transform: [{ rotate: `${orbit.value * 360}deg` }, { scale: 0.92 + veil.value * 0.08 }],
  }));

  const ensureUser = async () => {
    if (!user || (name.trim() && name.trim() !== user.displayName)) {
      await signIn(name.trim() || 'Ты');
    }
  };

  const enter = async () => {
    void juice.warmth();
    await ensureUser();
    if (pair) {
      void juice.sync();
      router.replace('/(tabs)/home');
    } else {
      router.push('/pair/create');
    }
  };

  const goPlay = async () => {
    void juice.hit();
    await ensureUser();
    if (pair) void juice.sync();
    router.replace('/(tabs)/play');
  };

  const goJoin = async () => {
    void juice.card();
    await ensureUser();
    router.push('/pair/join');
  };

  return (
    <LpdBackground mood="night">
      <View style={[styles.root, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24 }]}>
        <Animated.View style={[styles.orbitWrap, orbitStyle]} pointerEvents="none">
          <Animated.Image
            source={require('../assets/welcome_orbit.png')}
            style={styles.orbit}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={[styles.hero, contentStyle]}>
          <Text style={styles.kicker}>{pair ? 'Пара на связи' : 'LPD online'}</Text>
          <BrandMark size="hero" showTagline />
          <Text style={[typography.body, styles.sub]}>
            Тёмная игровая зона для двоих. Янтарь, пыльная роза и раунды с двух телефонов.
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Как тебя зовут"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </Animated.View>

        <Animated.View style={[styles.cta, contentStyle]}>
          <LpdButton
            label={pair ? `В комнату «${pair.name}»` : 'Войти в комнату'}
            onPress={() => void enter()}
          />
          {pair ? (
            <>
              <LpdButton label="Играть вдвоём" variant="ghost" onPress={() => void goPlay()} />
              <LpdButton
                label="Войти по другому коду"
                variant="ghost"
                onPress={() => void goJoin()}
              />
            </>
          ) : (
            <LpdButton label="У меня есть код пары" variant="ghost" onPress={() => void goJoin()} />
          )}
          <Text style={styles.foot}>
            {pair
              ? `Код ${pair.code} сохранён${
                  typeof pair.roomSize === 'number' ? ` · в комнате ${pair.roomSize}` : ''
                }. Можно жечь дальше.`
              : 'Создай пару или войди по коду — два телефона, одна комната.'}
          </Text>
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
  orbitWrap: {
    position: 'absolute',
    top: '8%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  orbit: {
    width: 340,
    height: 220,
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
  input: {
    marginTop: spacing.sm,
    minHeight: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(36,28,49,0.65)',
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontFamily: fonts.ui,
    fontSize: 16,
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
