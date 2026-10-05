import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { BrandMark } from '../../src/components/BrandMark';
import { LpdButton } from '../../src/components/LpdButton';
import { CodeInput } from '../../src/components/CodeInput';
import { colors, fonts, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';
import { juice } from '../../src/audio/juice';
import { track } from '../../src/analytics/track';

export default function JoinPairScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { joinPair, user, signIn } = useApp();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onJoin = async () => {
    setLoading(true);
    setError('');
    try {
      if (!user) await signIn('Партнёр');
      await joinPair(code);
      track('pair_joined');
      router.replace('/pair/success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вышло войти');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LpdBackground mood="rain">
      <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
        <BrandMark size="compact" />
        <View style={styles.block}>
          <Text style={typography.headline}>Код пары</Text>
          <Text style={typography.body}>Шесть символов — и вы в одной комнате LovePDuo.</Text>
          <CodeInput value={code} onChange={setCode} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
        <View style={styles.actions}>
          <LpdButton
            label="Войти"
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
    gap: spacing.lg,
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
