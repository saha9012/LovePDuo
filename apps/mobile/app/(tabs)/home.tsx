import React, { useEffect, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { BrandMark } from '../../src/components/BrandMark';
import { PairAvatar } from '../../src/components/PairAvatar';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { juice } from '../../src/audio/juice';
import { useMemories } from '../../src/store/MemoriesStore';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, pair, sendWarmth, warmthPulse, setMood } = useApp();
  const { items: memories } = useMemories();
  const pulse = useSharedValue(1);
  const [wsOnline, setWsOnline] = useState(false);
  const lastMemory = memories[0];

  useEffect(() => {
    const off = pairRealtime.onStatus(setWsOnline);
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    if (!warmthPulse) return;
    pulse.value = withSequence(
      withTiming(1.08, { duration: 180 }),
      withTiming(1, { duration: 280 }),
    );
  }, [warmthPulse, pulse]);

  const warmthStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  return (
    <LpdBackground mood={pair?.mood ?? 'night'}>
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <BrandMark size="nav" />
        <View style={styles.room}>
          <Text style={styles.roomName}>{pair?.name ?? 'Комната'}</Text>
          <View style={styles.pairRow}>
            <View style={styles.person}>
              <PairAvatar name={user?.displayName ?? 'Ты'} presence="online" />
              <Text style={styles.personName}>{user?.displayName ?? 'Ты'}</Text>
            </View>
            <View style={styles.linkLine} />
            <View style={styles.person}>
              <PairAvatar
                name={pair?.partnerName ?? 'Партнёр'}
                presence={pair?.partnerPresence ?? 'offline'}
              />
              <Text style={styles.personName}>{pair?.partnerName ?? 'Партнёр'}</Text>
            </View>
          </View>
          <Text style={typography.body}>
            {pair?.partnerPresence === 'online'
              ? 'Партнёр рядом. LPD online. Ваш ход.'
              : 'Ждём пульс партнёра. Можно греть комнату заранее.'}
          </Text>
          <Text style={styles.meta}>
            Код пары: {pair?.code ?? '—'} · Realtime: {wsOnline ? 'online' : 'offline'}
          </Text>
          {Platform.OS === 'web' ? (
            <Text style={styles.hint}>
              Тест вдвоём: окно 1 создаёт пару, окно 2 (инкognito) → «есть код». Один backend :8787.
            </Text>
          ) : (
            <Text style={styles.hint}>
              Два телефона: Profile → Realtime URL = ws://IP_ПК:8787 (одна Wi‑Fi).
            </Text>
          )}
          {lastMemory ? (
            <Text style={styles.memory}>
              Последнее: {lastMemory.title} — {lastMemory.detail}
            </Text>
          ) : null}
        </View>

        <Animated.View style={[styles.ctaBlock, warmthStyle]}>
          <LpdButton label="Играть вдвоём" onPress={() => router.push('/(tabs)/play')} />
          <LpdButton
            label="Отправить тепло"
            variant="ghost"
            onPress={() => {
              sendWarmth();
              pairRealtime.sendWarmth();
              void juice.warmth();
            }}
          />
          <LpdButton
            label="Поделиться кодом пары"
            variant="ghost"
            onPress={() => {
              const code = pair?.code ?? '';
              void Share.share({
                message: `LovePDuo код: ${code}\nlovepduo://join/${code}`,
              });
              void juice.hit();
            }}
          />
          <View style={styles.moodRow}>
            {(['night', 'warm', 'rain'] as const).map((m) => (
              <Text
                key={m}
                onPress={() => setMood(m)}
                style={[styles.moodChip, pair?.mood === m && styles.moodActive]}
              >
                {m === 'night' ? 'Ночь' : m === 'warm' ? 'Тёплый свет' : 'Дождь'}
              </Text>
            ))}
          </View>
        </Animated.View>
      </View>
    </LpdBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  room: {
    gap: spacing.lg,
    marginTop: spacing.xxl,
  },
  roomName: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.textPrimary,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  person: {
    alignItems: 'center',
    gap: 6,
  },
  personName: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    color: colors.textSecondary,
    maxWidth: 88,
    textAlign: 'center',
  },
  linkLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(226,176,122,0.35)',
  },
  ctaBlock: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  moodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  moodChip: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    color: colors.textMuted,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  moodActive: {
    color: colors.accentAmber,
    borderColor: 'rgba(226,176,122,0.45)',
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.accentAmber,
    letterSpacing: 1,
  },
  hint: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  memory: {
    marginTop: 4,
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 18,
    color: colors.accentMist,
  },
});
