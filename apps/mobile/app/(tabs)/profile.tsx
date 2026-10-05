import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { PairAvatar } from '../../src/components/PairAvatar';
import { colors, fonts, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';
import { juice } from '../../src/audio/juice';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, pair, unlinkPair, signOut } = useApp();
  const [sfxMuted, setSfxMuted] = useState(false);

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
            <Text style={styles.lan}>
              Android / 2 телефона: backend `npm start`, в apps/mobile задай
              EXPO_PUBLIC_LPD_WS_URL=ws://IP_ПК:8787 и npm start.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <LpdButton
            label={sfxMuted ? 'SFX: выкл (включить)' : 'SFX: вкл (выключить)'}
            variant="ghost"
            onPress={() => {
              const next = !sfxMuted;
              setSfxMuted(next);
              juice.setMuted(next);
            }}
          />
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
  lan: {
    marginTop: 8,
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  actions: {
    marginTop: 'auto',
    gap: spacing.sm,
  },
});
