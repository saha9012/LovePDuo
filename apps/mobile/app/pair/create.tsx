import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { BrandMark } from '../../src/components/BrandMark';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';
import { track } from '../../src/analytics/track';
import { juice } from '../../src/audio/juice';
import { loadPlayStats, type PlayStats } from '../../src/stats/playStats';
import { getWsUrl } from '../../src/realtime/wsConfig';

const AGE_OK_KEY = 'lovepduo.age_ok_16';

export default function CreatePairScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createPair, signIn, user, pair } = useApp();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [ageOk, setAgeOk] = useState(false);
  const [ageError, setAgeError] = useState('');
  const [loading, setLoading] = useState(false);
  const [playStats, setPlayStats] = useState<PlayStats | null>(null);
  const wsHint = getWsUrl().replace(/^wss?:\/\//, '').slice(0, 28);

  useEffect(() => {
    void loadPlayStats().then(setPlayStats);
    void AsyncStorage.getItem(AGE_OK_KEY).then((v) => {
      if (v === '1') setAgeOk(true);
    });
  }, []);

  useEffect(() => {
    if (pair?.code) {
      void juice.sync();
      router.replace('/(tabs)/home');
    }
  }, [pair?.code, router]);

  const toggleAgeOk = () => {
    setAgeOk((prev) => {
      const next = !prev;
      void AsyncStorage.setItem(AGE_OK_KEY, next ? '1' : '');
      if (next) {
        setAgeError('');
        void juice.hit();
      }
      return next;
    });
  };

  const onCreate = async () => {
    if (!ageOk) {
      setAgeError('Нужно подтвердить 16+');
      void juice.miss();
      return;
    }
    setLoading(true);
    setAgeError('');
    try {
      const profile = await signIn(displayName || 'Ты');
      await createPair(name, profile.id);
      track('pair_created');
      void juice.postMatch();
      router.replace('/pair/success');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LpdBackground mood="warm">
      <ScrollView
        contentContainerStyle={[
          styles.root,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <BrandMark size="compact" />
        <View style={styles.block}>
          <Text style={typography.headline}>Собери пару</Text>
          <Text style={typography.body}>
            Создай код пары. Второй телефон входит по нему — и вы на связи вдвоём. Пара ≠ комната:
            код — ваша связка, realtime только живой канал.
          </Text>
          <View style={styles.statStrip}>
            {(
              [
                ['1', 'имя', 'шаг'],
                ['2', 'код', 'шаг'],
                ['3', 'invite', 'шаг'],
                ['p', String(playStats?.totalStarts ?? 0), 'plays'],
                ['k', String(playStats?.streakDays ?? 0), 'streak'],
                ['w', wsHint || '—', 'ws'],
              ] as const
            ).map(([k, n, l]) => (
              <View key={`${k}-${l}`} style={styles.statCell}>
                <Text style={styles.statNum} numberOfLines={1}>
                  {n}
                </Text>
                <Text style={styles.statLabel}>{l}</Text>
              </View>
            ))}
          </View>
          {pair ? (
            <Text style={styles.linked}>
              Уже есть пара {pair.code}. Открой Home или отвяжи в Profile.
            </Text>
          ) : null}
          <Text style={styles.label}>Твоё имя</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Как тебя зовут"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>Имя пары</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Наша ночь"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Pressable
            onPress={toggleAgeOk}
            style={styles.ageRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ageOk }}
          >
            <View style={[styles.ageBox, ageOk && styles.ageBoxOn]}>
              {ageOk ? <Text style={styles.ageCheck}>✓</Text> : null}
            </View>
            <Text style={styles.ageLabel}>Мне есть 16+</Text>
          </Pressable>
          {ageError ? <Text style={styles.ageError}>{ageError}</Text> : null}
          <Text style={styles.foot}>
            После создания — код из 6 символов и deep link. 16+ до create. Код = identity пары; WS
            2/2 — отдельно, когда оба в комнате. Auth пока локальный (Google — на Welcome).
          </Text>
        </View>
        <View style={styles.actions}>
          {pair ? (
            <LpdButton
              label="В пару"
              onPress={() => {
                void juice.warmth();
                router.replace('/(tabs)/home');
              }}
            />
          ) : (
            <LpdButton label="Создать код пары" loading={loading} onPress={() => void onCreate()} />
          )}
          <LpdButton
            label="У меня уже есть код"
            variant="ghost"
            onPress={() => router.push('/pair/join')}
          />
        </View>
      </ScrollView>
    </LpdBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'space-between',
    gap: spacing.xl,
  },
  block: {
    gap: spacing.md,
  },
  statStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statCell: {
    minWidth: 52,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(232,196,122,0.28)',
    backgroundColor: 'rgba(36,28,49,0.45)',
    alignItems: 'center',
  },
  statNum: {
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    color: colors.accentAmber,
    maxWidth: 72,
  },
  statLabel: {
    fontFamily: fonts.ui,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  linked: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.accentRose,
  },
  label: {
    marginTop: spacing.sm,
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: colors.accentAmber,
  },
  input: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(36,28,49,0.7)',
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontFamily: fonts.ui,
    fontSize: 16,
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
  ageError: {
    fontFamily: fonts.ui,
    color: colors.danger,
    fontSize: 14,
  },
  foot: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.sm,
  },
});
