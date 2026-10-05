import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { PairAvatar } from '../../src/components/PairAvatar';
import { colors, fonts, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, pair, unlinkPair, signOut } = useApp();

  return (
    <LpdBackground mood="night">
      <View style={[styles.root, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.kicker}>Profile</Text>
        <Text style={typography.headline}>Пара и настройки</Text>

        <View style={styles.row}>
          <PairAvatar name={user?.displayName ?? 'Ты'} presence="online" size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.name}>{user?.displayName ?? 'Ты'}</Text>
            <Text style={typography.caption}>Код: {pair?.code ?? '—'}</Text>
            <Text style={typography.caption}>{pair?.name}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <LpdButton
            label="Отвязать пару"
            variant="ghost"
            onPress={async () => {
              await unlinkPair();
              router.replace('/pair/create');
            }}
          />
          <LpdButton
            label="Выйти"
            variant="danger"
            onPress={async () => {
              await signOut();
              router.replace('/welcome');
            }}
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
    gap: spacing.lg,
  },
  kicker: {
    fontFamily: fonts.uiMedium,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accentMist,
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  name: {
    fontFamily: fonts.uiSemi,
    fontSize: 20,
    color: colors.textPrimary,
  },
  actions: {
    marginTop: 'auto',
    gap: spacing.sm,
  },
});
