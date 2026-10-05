import React, { useState } from 'react';
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

export default function CreatePairScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createPair, user, signIn } = useApp();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [loading, setLoading] = useState(false);

  const onCreate = async () => {
    setLoading(true);
    try {
      const profile = await signIn(displayName || 'Ты');
      await createPair(name, profile.id);
      track('pair_created');
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
            Создай код. Второй телефон входит по нему — и комната загорается.
          </Text>
          <Text style={styles.label}>Твоё имя</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Как тебя зовут"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>Имя комнаты</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Наша ночь"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </View>
        <View style={styles.actions}>
          <LpdButton label="Создать код" loading={loading} onPress={() => void onCreate()} />
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
