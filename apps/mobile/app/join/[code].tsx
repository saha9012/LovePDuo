import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';
import { juice } from '../../src/audio/juice';
import { track } from '../../src/analytics/track';
import { loadPlayStats, type PlayStats } from '../../src/stats/playStats';
import { getWsUrl } from '../../src/realtime/wsConfig';

const AGE_OK_KEY = 'lovepduo.age_ok_16';

export default function DeepJoinScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hydrated, user, pair, signIn, joinPair } = useApp();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [ageOk, setAgeOk] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Проверь имя и войди');
  const [playStats, setPlayStats] = useState<PlayStats | null>(null);
  const clean = String(code ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
  const wsHint = getWsUrl().replace(/^wss?:\/\//, '').slice(0, 28);

  useEffect(() => {
    void loadPlayStats().then(setPlayStats);
    void AsyncStorage.getItem(AGE_OK_KEY).then((v) => {
      if (v === '1') setAgeOk(true);
    });
  }, []);

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
  }, [user?.displayName]);

  useEffect(() => {
    if (!hydrated) return;
    if (pair?.code === clean && clean.length === 6) {
      void juice.sync();
      setStatus('Уже в этой паре');
      router.replace('/(tabs)/home');
      return;
    }
    if (clean.length === 6) {
      setStatus('Код из ссылки готов — укажи имя');
      void juice.hit();
    } else {
      setStatus('Код битый — войди вручную');
      void juice.miss();
    }
  }, [hydrated, clean, pair?.code, router]);

  const toggleAgeOk = () => {
    setAgeOk((prev) => {
      const next = !prev;
      void AsyncStorage.setItem(AGE_OK_KEY, next ? '1' : '');
      if (next) void juice.hit();
      return next;
    });
  };

  const go = async () => {
    if (!ageOk) {
      setError('Нужно подтвердить 16+');
      setStatus('Подтверди возраст');
      void juice.miss();
      return;
    }
    if (clean.length !== 6) {
      setError('В ссылке нет кода из 6 символов');
      return;
    }
    const name = displayName.trim() || user?.displayName?.trim();
    if (!name) {
      setError('Как тебя зовут?');
      void juice.miss();
      return;
    }
    setLoading(true);
    setError('');
    setStatus('Входим в пару…');
    try {
      await signIn(name);
      await joinPair(clean);
      track('pair_joined', { via: 'deep_link' });
      void juice.postMatch();
      router.replace('/pair/success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вышло войти');
      setStatus('Не вышло');
      void juice.miss();
    } finally {
      setLoading(false);
    }
  };

  return (
    <LpdBackground mood="rain">
      <ScrollView
        contentContainerStyle={[
          styles.root,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.kicker}>Deep link</Text>
        <Text style={typography.headline}>Вход по коду</Text>
        <Text style={typography.code}>{clean || '------'}</Text>
        <View style={styles.statStrip}>
          {(
            [
              ['c', `${clean.length}/6`, 'код'],
              ['p', String(playStats?.totalStarts ?? 0), 'plays'],
              ['k', String(playStats?.streakDays ?? 0), 'streak'],
              ['w', wsHint || '—', 'ws'],
            ] as const
          ).map(([k, n, l]) => (
            <View key={k} style={styles.statCell}>
              <Text style={styles.statNum} numberOfLines={1}>
                {n}
              </Text>
              <Text style={styles.statLabel}>{l}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.status}>{status}</Text>
        <Text style={styles.label}>Твоё имя</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Как тебя зовут"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          editable={!loading}
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
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.foot}>
          Не входим молча как «Партнёр» — имя и 16+ нужны до join. Пара = код; live dual — когда WS
          комната станет 2/2, не от одного deep link.
        </Text>
        <View style={styles.actions}>
          <LpdButton
            label={loading ? 'Входим…' : 'Войти в пару'}
            loading={loading}
            disabled={clean.length < 6}
            onPress={() => void go()}
          />
          <LpdButton label="Вручную" variant="ghost" onPress={() => router.replace('/pair/join')} />
        </View>
      </ScrollView>
    </LpdBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  kicker: {
    fontFamily: fonts.uiMedium,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accentAmber,
    fontSize: 12,
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
  status: {
    fontFamily: fonts.ui,
    color: colors.textSecondary,
    fontSize: 14,
  },
  label: {
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
  error: {
    fontFamily: fonts.ui,
    color: colors.danger,
  },
  foot: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  actions: {
    marginTop: 'auto',
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
});
