import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';
import { juice } from '../../src/audio/juice';

export default function DeepJoinScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signIn, joinPair } = useApp();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const clean = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

  const go = async () => {
    setLoading(true);
    setError('');
    try {
      if (!user) await signIn('Партнёр');
      await joinPair(clean);
      void juice.postMatch();
      router.replace('/pair/success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вышло войти');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clean.length === 6) {
      void go();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LpdBackground mood="rain">
      <View style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.kicker}>Deep link</Text>
        <Text style={typography.headline}>Вход по коду</Text>
        <Text style={typography.code}>{clean || '------'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <LpdButton label="Войти" loading={loading} disabled={clean.length < 6} onPress={() => void go()} />
          <LpdButton label="Вручную" variant="ghost" onPress={() => router.replace('/pair/join')} />
        </View>
      </View>
    </LpdBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
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
  error: {
    fontFamily: fonts.ui,
    color: colors.danger,
  },
  actions: {
    marginTop: 'auto',
    gap: spacing.sm,
  },
});
