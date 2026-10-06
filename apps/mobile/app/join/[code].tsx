import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';
import { juice } from '../../src/audio/juice';
import { track } from '../../src/analytics/track';

export default function DeepJoinScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hydrated, user, pair, signIn, joinPair } = useApp();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Готовим вход…');
  const tried = useRef(false);
  const clean = String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

  const go = async () => {
    if (clean.length !== 6) {
      setError('В ссылке нет кода из 6 символов');
      return;
    }
    setLoading(true);
    setError('');
    setStatus('Входим в пару…');
    try {
      if (!user) await signIn('Партнёр');
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

  useEffect(() => {
    if (!hydrated || tried.current) return;
    if (pair?.code === clean && clean.length === 6) {
      void juice.sync();
      setStatus('Уже в этой паре');
      router.replace('/(tabs)/home');
      return;
    }
    if (clean.length === 6) {
      tried.current = true;
      void juice.hit();
      void go();
    } else {
      setStatus('Код битый — войди вручную');
      void juice.miss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, clean, pair?.code]);

  return (
    <LpdBackground mood="rain">
      <View style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.kicker}>Deep link</Text>
        <Text style={typography.headline}>Вход по коду</Text>
        <Text style={typography.code}>{clean || '------'}</Text>
        <Text style={styles.status}>{status}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <LpdButton
            label={loading ? 'Входим…' : 'Войти снова'}
            loading={loading}
            disabled={clean.length < 6}
            onPress={() => {
              tried.current = true;
              void go();
            }}
          />
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
  status: {
    fontFamily: fonts.ui,
    color: colors.textSecondary,
    fontSize: 14,
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
