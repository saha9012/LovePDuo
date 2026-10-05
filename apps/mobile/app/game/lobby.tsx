import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';

const routes = {
  'sky-claim': '/game/sky-claim',
  heartbeat: '/game/heartbeat',
  'truth-or-spark': '/game/truth-or-spark',
} as const;

export default function GameLobbyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { game } = useLocalSearchParams<{ game?: string }>();
  const gameId = (game as keyof typeof routes) || 'sky-claim';
  const { user, pair } = useApp();
  const [readyMe, setReadyMe] = useState(false);
  const [readyPeer, setReadyPeer] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!pair || !user) return;
    pairRealtime.connect(pair.code, user.id, user.displayName);
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'game' && msg.gameId === gameId) {
        const payload = msg.payload as { ready?: boolean; start?: boolean } | undefined;
        if (payload?.ready) setReadyPeer(true);
        if (payload?.start) setCountdown(3);
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id, gameId]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      router.replace(routes[gameId]);
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c == null ? c : c - 1)), 700);
    return () => clearTimeout(t);
  }, [countdown, gameId, router]);

  useEffect(() => {
    if (readyMe && readyPeer && countdown === null) {
      pairRealtime.sendGame(gameId, { start: true });
      setCountdown(3);
    }
  }, [readyMe, readyPeer, countdown, gameId]);

  const onReady = () => {
    setReadyMe(true);
    pairRealtime.sendGame(gameId, { ready: true });
  };

  const solo = () => {
    router.replace(routes[gameId]);
  };

  return (
    <LpdBackground mood="warm">
      <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.kicker}>Lobby</Text>
        <Text style={typography.headline}>Готовы жечь?</Text>
        <Text style={typography.body}>
          Оба жмут Ready — короткий countdown — и раунд. Или Solo, если партнёр ещё оффлайн.
        </Text>

        <View style={styles.status}>
          <Text style={styles.pill}>{readyMe ? 'Ты: READY' : 'Ты: …'}</Text>
          <Text style={styles.pill}>{readyPeer ? 'Партнёр: READY' : 'Партнёр: …'}</Text>
        </View>

        {countdown != null ? (
          <Text style={styles.count}>{countdown === 0 ? 'GO' : countdown}</Text>
        ) : null}

        <View style={styles.actions}>
          <LpdButton label="Ready" onPress={onReady} disabled={readyMe || countdown != null} />
          <LpdButton label="Solo / Demo" variant="ghost" onPress={solo} />
          <LpdButton label="Назад" variant="ghost" onPress={() => router.back()} />
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
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  pill: {
    fontFamily: fonts.uiSemi,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
  },
  count: {
    marginTop: spacing.xxl,
    fontFamily: fonts.display,
    fontSize: 72,
    color: colors.accentRose,
    textAlign: 'center',
  },
  actions: {
    marginTop: 'auto',
    gap: spacing.sm,
  },
});
