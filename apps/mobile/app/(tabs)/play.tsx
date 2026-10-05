import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { GameTile } from '../../src/components/GameTile';
import { colors, fonts, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';

export default function PlayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <LpdBackground mood="night">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text style={styles.kicker}>Play</Text>
        <Text style={typography.headline}>Миниигры для двоих</Text>
        <Text style={[typography.body, styles.sub]}>
          Три проработанных раунда. Два телефона. Живой post-match.
        </Text>
        <View style={styles.list}>
          <GameTile
            title="Sky Claim"
            subtitle="Лови огни с неба на своём поле. Комбо, обманки, реванш."
            accent="amber"
            cover="sky"
            badge="MVP"
            onPress={() => router.push({ pathname: '/game/lobby', params: { game: 'sky-claim' } })}
          />
          <GameTile
            title="Heartbeat Tap"
            subtitle="Общий бит. Личная точность + sync bonus."
            accent="rose"
            cover="heartbeat"
            badge="MVP"
            onPress={() => router.push({ pathname: '/game/lobby', params: { game: 'heartbeat' } })}
          />
          <GameTile
            title="Truth Or Spark"
            subtitle="Вопросы, задания и искры. Soft / spicy, без ваты."
            accent="mist"
            cover="spark"
            badge="MVP"
            onPress={() => router.push({ pathname: '/game/lobby', params: { game: 'truth-or-spark' } })}
          />
          <GameTile
            title="Soft Duel"
            subtitle="Реакция на вспышку слова. Perfect / рано / реванш."
            accent="rose"
            cover="heartbeat"
            badge="NEW"
            onPress={() => router.push({ pathname: '/game/lobby', params: { game: 'soft-duel' } })}
          />
          <GameTile
            title="Word Veil"
            subtitle="Ассоциации на одно слово. Сравниваем совпадение."
            accent="mist"
            cover="spark"
            badge="NEW"
            onPress={() => router.push({ pathname: '/game/lobby', params: { game: 'word-veil' } })}
          />
        </View>
      </ScrollView>
    </LpdBackground>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  kicker: {
    fontFamily: fonts.uiMedium,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accentRose,
    fontSize: 12,
  },
  sub: {
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
});
