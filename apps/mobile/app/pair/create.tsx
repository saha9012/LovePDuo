import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
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

export default function CreatePairScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createPair, signIn, user, pair } = useApp();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (pair?.code) {
      void juice.sync();
      router.replace('/(tabs)/home');
    }
  }, [pair?.code, router]);

  const onCreate = async () => {
    setLoading(true);
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
      <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
        <BrandMark size="compact" />
        <View style={styles.block}>
          <Text style={typography.headline}>Собери пару</Text>
          <Text style={typography.body}>
            Создай код пары. Второй телефон входит по нему — и вы на связи вдвоём.
          </Text>
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
  actions: {
    gap: spacing.sm,
  },
});
