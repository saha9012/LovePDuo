import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { googleConfigured, googleStatusLabel, signInWithGoogle } from '../src/auth/googleAuth';
import { loadPlayStats, type PlayStats } from '../src/stats/playStats';
import {
  hydrateMatchSession,
  peekPairMatchSession,
  type MatchSession,
} from '../src/realtime/matchSession';

const AGE_OK_KEY = 'lovepduo.age_ok_16';

const GAME_TITLES: Record<string, string> = {
  'soft-duel': 'Soft Duel',
  heartbeat: 'Heartbeat',
  'sky-claim': 'Sky Claim',
  'orbit-catch': 'Orbit Catch',
  'signal-draw': 'Signal Draw',
  'word-veil': 'Word Veil',
  'truth-or-spark': 'Truth or Spark',
};

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, pair, signIn } = useApp();
  const [name, setName] = useState(user?.displayName ?? '');
  const [ageOk, setAgeOk] = useState(false);
  const [roomToast, setRoomToast] = useState<string | null>(null);
  const [playStats, setPlayStats] = useState<PlayStats | null>(null);
  const [resumeMatch, setResumeMatch] = useState<MatchSession | null>(null);
  const roomSizeSeen = useRef(pair?.roomSize ?? 0);
  const roomToastRef = useRef<string | null>(null);
  const veil = useSharedValue(0);
  const rise = useSharedValue(28);
  const orbit = useSharedValue(0);

  useEffect(() => {
    roomToastRef.current = roomToast;
  }, [roomToast]);

  useEffect(() => {
    const size = typeof pair?.roomSize === 'number' ? pair.roomSize : 0;
    const prev = roomSizeSeen.current;
    if (prev > 0 && prev < 2 && size >= 2) {
      const afterLeave =
        roomToastRef.current === 'Партнёр вышел' ||
        roomToastRef.current === 'Оба снова дома';
      const racing =
        roomToastRef.current === 'Оба в комнате' ||
        roomToastRef.current === 'Оба дома';
      setRoomToast(afterLeave ? 'Оба снова дома' : racing ? 'Оба дома' : 'Оба в комнате');
      void juice.perfect();
      const t = setTimeout(() => setRoomToast(null), 1800);
      roomSizeSeen.current = size;
      return () => clearTimeout(t);
    }
    if (prev >= 2 && size === 1) {
      setRoomToast('Партнёр вышел');
      void juice.miss();
      const t = setTimeout(() => setRoomToast(null), 1800);
      roomSizeSeen.current = size;
      return () => clearTimeout(t);
    }
    roomSizeSeen.current = size;
  }, [pair?.roomSize]);

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

  useEffect(() => {
    void AsyncStorage.getItem(AGE_OK_KEY).then((v) => {
      if (v === '1') setAgeOk(true);
    });
  }, []);

  useEffect(() => {
    void loadPlayStats().then(setPlayStats);
  }, []);

  useEffect(() => {
    let alive = true;
    if (!pair?.code) {
      setResumeMatch(null);
      return;
    }
    void hydrateMatchSession().then(() => {
      if (!alive) return;
      setResumeMatch(peekPairMatchSession(pair.code));
    });
    const t = setInterval(() => {
      setResumeMatch(peekPairMatchSession(pair.code));
    }, 2500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pair?.code]);

  const daysTogether = pair?.pairedAt
    ? Math.max(1, Math.floor((Date.now() - pair.pairedAt) / 86_400_000) + 1)
    : 0;

  const contentStyle = useAnimatedStyle(() => ({
    opacity: veil.value,
    transform: [{ translateY: rise.value }],
  }));

  const orbitStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + veil.value * 0.45,
    transform: [{ rotate: `${orbit.value * 360}deg` }, { scale: 0.92 + veil.value * 0.08 }],
  }));

  const requireAgeOk = () => {
    if (ageOk) return true;
    setRoomToast('Нужно подтвердить 16+');
    setTimeout(() => setRoomToast(null), 2200);
    void juice.miss();
    return false;
  };

  const toggleAgeOk = () => {
    setAgeOk((prev) => {
      const next = !prev;
      void AsyncStorage.setItem(AGE_OK_KEY, next ? '1' : '');
      if (next) void juice.hit();
      return next;
    });
  };

  const ensureUser = async () => {
    if (!user || (name.trim() && name.trim() !== user.displayName)) {
      await signIn(name.trim() || 'Ты');
    }
  };

  const enter = async () => {
    if (!requireAgeOk()) return;
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
    if (!requireAgeOk()) return;
    void juice.hit();
    await ensureUser();
    if (pair) void juice.sync();
    router.replace('/(tabs)/play');
  };

  const goJoin = async () => {
    if (!requireAgeOk()) return;
    void juice.card();
    await ensureUser();
    router.push('/pair/join');
  };

  const tryGoogle = async () => {
    if (!requireAgeOk()) return;
    void juice.hit();
    if (!googleConfigured()) {
      setRoomToast(googleStatusLabel());
      setTimeout(() => setRoomToast(null), 2400);
      void juice.miss();
      return;
    }
    const profile = await signInWithGoogle();
    if (!profile) {
      setRoomToast('Google OAuth ещё не подключён — войди локальным именем');
      setTimeout(() => setRoomToast(null), 2400);
      void juice.miss();
      return;
    }
    setName(profile.displayName);
    await signIn(profile.displayName, {
      authProvider: 'google',
      email: profile.email,
    });
    setRoomToast(`Google · ${profile.displayName}`);
    setTimeout(() => setRoomToast(null), 1800);
    void juice.perfect();
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
          <Text style={styles.kicker}>
            {pair
              ? typeof pair.roomSize === 'number' && pair.roomSize >= 2
                ? 'Пара в комнате'
                : 'Пара · ждём WS'
              : 'LPD online'}
          </Text>
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
          {pair ? (
            <View style={styles.pairStrip}>
              {(
                [
                  ['d', String(daysTogether), 'дней'],
                  ['g', String(pair.gamesStarted ?? 0), 'стартов'],
                  ['s', String(playStats?.totalStarts ?? 0), 'plays'],
                  ['k', String(playStats?.streakDays ?? 0), 'streak'],
                  [
                    'o',
                    typeof pair.roomSize === 'number' ? `${pair.roomSize}/2` : '—',
                    'WS',
                  ],
                  ['c', pair.code.slice(0, 4), 'код'],
                ] as const
              ).map(([k, n, l]) => (
                <View key={k} style={styles.pairCell}>
                  <Text style={styles.pairNum}>{n}</Text>
                  <Text style={styles.pairLabel}>{l}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {pair && resumeMatch ? (
            <Text style={styles.resumeLine}>
              {(pair.roomSize ?? 0) >= 2 ? 'Сессия · WS 2/2' : 'Сессия · ждём WS 2/2'} ·{' '}
              {GAME_TITLES[resumeMatch.gameId] ?? resumeMatch.gameId} · seed {resumeMatch.seed} ·{' '}
              {Math.max(0, Math.round((Date.now() - resumeMatch.startAtMs) / 1000))}с
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View style={[styles.cta, contentStyle]}>
          <Pressable onPress={toggleAgeOk} style={styles.ageRow} accessibilityRole="checkbox" accessibilityState={{ checked: ageOk }}>
            <View style={[styles.ageBox, ageOk && styles.ageBoxOn]}>
              {ageOk ? <Text style={styles.ageCheck}>✓</Text> : null}
            </View>
            <Text style={styles.ageLabel}>Мне есть 16+</Text>
          </Pressable>
          <LpdButton
            label={pair ? `В пару «${pair.name}»` : 'Создать пару'}
            onPress={() => void enter()}
          />
          {pair ? (
            <>
              <LpdButton
                label={
                  typeof pair.roomSize === 'number' && pair.roomSize >= 2
                    ? 'Играть вдвоём'
                    : 'Играть · Solo/Demo, dual после WS 2/2'
                }
                variant="ghost"
                onPress={() => void goPlay()}
              />
              <LpdButton
                label="Войти по другому коду"
                variant="ghost"
                onPress={() => void goJoin()}
              />
            </>
          ) : (
            <LpdButton label="У меня есть код пары" variant="ghost" onPress={() => void goJoin()} />
          )}
          <LpdButton
            label={googleConfigured() ? 'Google Sign-In' : 'Google · скоро (.env)'}
            variant="ghost"
            onPress={() => void tryGoogle()}
          />
          {roomToast ? <Text style={styles.authToast}>{roomToast}</Text> : null}
          <Text style={styles.foot}>
            {pair
              ? `Код пары ${pair.code} сохранён на устройстве${
                  typeof pair.roomSize === 'number' ? ` · WS ${pair.roomSize}/2` : ''
                } · ${
                  typeof pair.roomSize === 'number' && pair.roomSize >= 2
                    ? 'партнёр в комнате'
                    : pair.partnerPresence === 'online'
                      ? 'presence ≠ room'
                      : 'партнёр offline'
                } · ${
                  user?.authProvider === 'google'
                    ? `Google${user.email ? ` · ${user.email}` : ''}`
                    : 'локальный профиль (не облако)'
                }.`
              : 'Пара = код на двух телефонах, не аккаунт. Локальное имя хранится здесь; Google — опционально, когда .env готов.'}
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
  pairStrip: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pairCell: {
    minWidth: 52,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(232,196,122,0.28)',
    backgroundColor: 'rgba(36,28,49,0.45)',
    alignItems: 'center',
  },
  pairNum: {
    fontFamily: fonts.uiSemi,
    fontSize: 14,
    color: colors.accentAmber,
  },
  pairLabel: {
    fontFamily: fonts.ui,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  resumeLine: {
    marginTop: spacing.sm,
    fontFamily: fonts.ui,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  cta: {
    gap: spacing.md,
  },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  ageBox: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(36,28,49,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageBoxOn: {
    borderColor: colors.accentAmber,
    backgroundColor: 'rgba(232,196,122,0.18)',
  },
  ageCheck: {
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    color: colors.accentAmber,
  },
  ageLabel: {
    fontFamily: fonts.uiMedium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  foot: {
    marginTop: spacing.sm,
    textAlign: 'center',
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.textMuted,
  },
  authToast: {
    textAlign: 'center',
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    color: colors.accentAmber,
    lineHeight: 18,
  },
});
