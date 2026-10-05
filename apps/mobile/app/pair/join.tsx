import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
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

export default function JoinPairScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { joinPair, user, signIn, pair } = useApp();
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const autoTried = useRef('');

  useEffect(() => {
    setDisplayName(user?.displayName ?? '');
  }, [user?.displayName]);

  const onJoin = async (nextCode = code) => {
    if (loading) return;
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
    if (code.length === 6 && autoTried.current !== code && !loading) {
      autoTried.current = code;
      void onJoin(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <LpdBackground mood="rain">
      <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
        <BrandMark size="compact" />
        <View style={styles.block}>
          <Text style={typography.headline}>Код пары</Text>
          <Text style={typography.body}>Шесть символов — и вы в одной комнате LovePDuo.</Text>
          {pair?.code ? (
            <Text style={styles.linked}>
              Уже в паре {pair.code}. Можно сменить код или вернуться в комнату.
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
          {loading ? <Text style={styles.hint}>Входим…</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
        <View style={styles.actions}>
          {pair?.code ? (
            <LpdButton label="В комнату" onPress={() => router.replace('/(tabs)/home')} />
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
  block: {
    gap: spacing.md,
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
  actions: {
    gap: spacing.sm,
  },
});
