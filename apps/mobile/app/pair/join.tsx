import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { BrandMark } from '../../src/components/BrandMark';
import { LpdButton } from '../../src/components/LpdButton';
import { CodeInput } from '../../src/components/CodeInput';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';
import { juice } from '../../src/audio/juice';
import { track } from '../../src/analytics/track';
import { loadPlayStats, type PlayStats } from '../../src/stats/playStats';
import { getWsUrl } from '../../src/realtime/wsConfig';

const AGE_OK_KEY = 'lovepduo.age_ok_16';

export default function JoinPairScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { joinPair, user, signIn, pair } = useApp();
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [ageOk, setAgeOk] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [playStats, setPlayStats] = useState<PlayStats | null>(null);
  const autoTried = useRef('');
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
    if (pair?.code) void juice.sync();
  }, [pair?.code]);

  const toggleAgeOk = () => {
    setAgeOk((prev) => {
      const next = !prev;
      void AsyncStorage.setItem(AGE_OK_KEY, next ? '1' : '');
      if (next) void juice.hit();
      return next;
    });
  };

  const onJoin = async (nextCode = code) => {
    if (loading) return;
    if (!ageOk) {
      setError('Нужно подтвердить 16+');
      void juice.miss();
      return;
    }
    setLoading(true);
    setError('');
    try {
      await signIn(displayName || 'Партнёр');
      await joinPair(nextCode);
      track('pair_joined');
      void juice.postMatch();
      router.replace('/pair/success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вышло войти');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pair?.code && !code) return;
    if (!ageOk) return;
    if (code.length === 6 && autoTried.current !== code && !loading) {
      autoTried.current = code;
      void onJoin(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, ageOk]);

  return (
    <LpdBackground mood="rain">
      <ScrollView
        contentContainerStyle={[
          styles.root,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <BrandMark size="compact" />
        <View style={styles.block}>
          <Text style={typography.headline}>Код пары</Text>
          <Text style={typography.body}>
            Шесть символов — и вы в одной паре LovePDuo. Код = identity пары; realtime-канал
            подключается отдельно.
          </Text>
          <View style={styles.statStrip}>
            {(
              [
                ['1', 'имя', 'шаг'],
                ['2', 'код', 'шаг'],
                ['3', 'связь', 'шаг'],
                ['p', String(playStats?.totalStarts ?? 0), 'plays'],
                ['k', String(playStats?.streakDays ?? 0), 'streak'],
                ['c', `${code.length}/6`, 'симв'],
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
          {pair?.code ? (
            <Text style={styles.linked}>
              Уже в паре {pair.code}. Можно сменить код или вернуться в Home.
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
          <Text style={styles.label}>Код</Text>
          <CodeInput value={code} onChange={setCode} />
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
          {loading ? <Text style={styles.hint}>Входим…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.foot}>
            Auto-join на 6 символах — только после 16+. Deep link lovepduo://join/CODE тоже спросит
            возраст. Код связывает пару; live dual — когда WS комната станет 2/2.
          </Text>
        </View>
        <View style={styles.actions}>
          {pair?.code ? (
            <LpdButton
              label="В пару"
              onPress={() => {
                void juice.warmth();
                router.replace('/(tabs)/home');
              }}
            />
          ) : null}
          <LpdButton
            label={pair?.code ? 'Сменить пару по коду' : 'Войти'}
            loading={loading}
            disabled={code.length < 6}
            onPress={() => void onJoin()}
          />
          <LpdButton
            label="Создать свою пару"
            variant="ghost"
            onPress={() => router.replace('/pair/create')}
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
  hint: {
    fontFamily: fonts.ui,
    color: colors.accentMist,
    fontSize: 13,
  },
  error: {
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
