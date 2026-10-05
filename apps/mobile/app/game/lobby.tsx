import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { setMatchSession } from '../../src/realtime/matchSession';

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
  const [matchSeed, setMatchSeed] = useState<number | null>(null);
  const [startAtMs, setStartAtMs] = useState<number | null>(null);
  const startSent = useRef(false);

  const isHost = Boolean(
    user?.id && pair?.hostUserId && pair.hostUserId === user.id,
  );

  useEffect(() => {
    if (!pair || !user) return;
    pairRealtime.connect(pair.code, user.id, user.displayName);
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'game' && msg.gameId === gameId) {
        const payload = msg.payload as {
          ready?: boolean;
          userId?: string;
          start?: boolean;
          seed?: number;
          startAtMs?: number;
        } | undefined;
        if (payload?.ready && payload.userId !== user.id) {
          setReadyPeer(true);
        }
        if (payload?.start && typeof payload.seed === 'number') {
          const at = payload.startAtMs ?? Date.now() + 2500;
          setMatchSeed(payload.seed);
          setStartAtMs(at);
          setMatchSession({ gameId, seed: payload.seed, startAtMs: at });
          setCountdown(3);
        }
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id, gameId]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      const seed = matchSeed ?? Math.floor(Math.random() * 100000);
      const startAt = startAtMs ?? Date.now();
      router.replace({
        pathname: routes[gameId],
        params: {
          seed: String(seed),
          startAt: String(startAt),
        },
      });
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c == null ? c : c - 1)), 700);
    return () => clearTimeout(t);
  }, [countdown, gameId, router, matchSeed, startAtMs]);

  useEffect(() => {
    if (!readyMe || !readyPeer || countdown !== null || startSent.current) return;
    if (!isHost) return;
    startSent.current = true;
    const seed = Math.floor(Math.random() * 100000);
    const startAt = Date.now() + 2800;
    setMatchSeed(seed);
    setStartAtMs(startAt);
    setMatchSession({ gameId, seed, startAtMs: startAt });
    pairRealtime.sendGame(gameId, { start: true, seed, startAtMs: startAt });
    setCountdown(3);
  }, [readyMe, readyPeer, countdown, gameId, isHost]);

  const onReady = () => {
    if (!user) return;
    setReadyMe(true);
    pairRealtime.sendGame(gameId, { ready: true, userId: user.id });
  };

  const solo = () => {
    const seed = Math.floor(Math.random() * 100000);
    router.replace({
      pathname: routes[gameId],
      params: { seed: String(seed), solo: '1' },
    });
  };

  return (
    <LpdBackground mood="warm">
      <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
        <Text style={styles.kicker}>Lobby</Text>
        <Text style={typography.headline}>Готовы жечь?</Text>
        <Text style={typography.body}>
          Оба жмут Ready — общий seed и countdown. Solo — если партнёр оффлайн. Код пары: {pair?.code}
        </Text>
        <Text style={styles.hostHint}>
          {isHost ? 'Ты host — стартуешь раунд для обоих.' : 'Жди host (кто создал пару).'}
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
  hostHint: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.accentRose,
  },
  status: {
    marginTop: spacing.lg,
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
