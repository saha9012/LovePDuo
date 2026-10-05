import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { setMatchSession } from '../../src/realtime/matchSession';
import { track } from '../../src/analytics/track';
import { juice } from '../../src/audio/juice';

const routes = {
  'sky-claim': '/game/sky-claim',
  heartbeat: '/game/heartbeat',
  'truth-or-spark': '/game/truth-or-spark',
  'soft-duel': '/game/soft-duel',
  'word-veil': '/game/word-veil',
  'signal-draw': '/game/signal-draw',
  'orbit-catch': '/game/orbit-catch',
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
  const [wsOnline, setWsOnline] = useState(pairRealtime.connected);
  const [cancelToast, setCancelToast] = useState<string | null>(null);
  const startSent = useRef(false);
  const bothReadyNoted = useRef(false);
  const countdownRef = useRef<number | null>(null);
  const readyMeRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasWsOnline = useRef(pairRealtime.connected);
  const countScale = useSharedValue(1);
  const countOpacity = useSharedValue(1);

  const isHost = Boolean(
    user?.id && pair?.hostUserId && pair.hostUserId === user.id,
  );

  const peerReadyScale = useSharedValue(1);

  const showCancelToast = (text: string) => {
    setCancelToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setCancelToast(null), 1800);
  };

  useEffect(() => {
    countdownRef.current = countdown;
  }, [countdown]);

  useEffect(() => {
    readyMeRef.current = readyMe;
  }, [readyMe]);

  useEffect(() => {
    return pairRealtime.onStatus((online) => {
      setWsOnline(online);
      if (online && !wasWsOnline.current) {
        showCancelToast('WS online');
        void juice.sync();
        if (readyMeRef.current && user?.id) {
          pairRealtime.sendGame(gameId, { ready: true, userId: user.id });
        }
      } else if (!online && wasWsOnline.current) {
        showCancelToast('WS offline…');
        void juice.miss();
      }
      wasWsOnline.current = online;
    });
  }, [gameId, user?.id]);

  useEffect(() => {
    if (!readyPeer) return;
    peerReadyScale.value = withSequence(
      withSpring(1.06, { damping: 10 }),
      withTiming(1, { duration: 220 }),
    );
  }, [readyPeer, peerReadyScale]);

  useEffect(() => {
    if (!pair || !user) return;
    const titles: Record<string, string> = {
      'sky-claim': 'Sky Claim',
      heartbeat: 'Heartbeat Tap',
      'truth-or-spark': 'Truth Or Spark',
      'soft-duel': 'Soft Duel',
      'word-veil': 'Word Veil',
      'signal-draw': 'Signal Draw',
      'orbit-catch': 'Orbit Catch',
    };
    pairRealtime.connect(pair.code, user.id, user.displayName);
    pairRealtime.sendGame('play-peek', {
      game: gameId,
      title: titles[gameId] ?? gameId,
      fromId: user.id,
    });
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'peer_left') {
        const wasCounting = countdownRef.current != null;
        setReadyPeer(false);
        setCountdown(null);
        setMatchSeed(null);
        setStartAtMs(null);
        startSent.current = false;
        void juice.miss();
        showCancelToast(
          wasCounting ? 'Партнёр вышел — старт отменён' : 'Партнёр вышел из лобби',
        );
        return;
      }
      if (msg.type === 'peer_joined') {
        showCancelToast('Партнёр снова в лобби');
        void juice.sync();
        if (readyMeRef.current && user.id) {
          pairRealtime.sendGame(gameId, { ready: true, userId: user.id });
        }
        pairRealtime.sendGame('play-peek', {
          game: gameId,
          title: titles[gameId] ?? gameId,
          fromId: user.id,
        });
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'play-peek') {
        const peek = msg.payload as { game?: string; fromId?: string; leave?: boolean } | undefined;
        if (peek?.fromId === user.id) return;
        if (peek?.leave) return;
        if (peek?.game === gameId) {
          showCancelToast('Оба в этом лобби');
          void juice.perfect();
        }
        return;
      }
      if (msg.type === 'game' && msg.gameId === gameId) {
        const payload = msg.payload as {
          ready?: boolean;
          userId?: string;
          start?: boolean;
          seed?: number;
          startAtMs?: number;
          reset?: boolean;
        } | undefined;
        if (payload?.reset) {
          setReadyMe(false);
          setReadyPeer(false);
          startSent.current = false;
          setCountdown(null);
          return;
        }
        if (typeof payload?.ready === 'boolean' && payload.userId !== user.id) {
          setReadyPeer(payload.ready);
          if (payload.ready) {
            const both = readyMeRef.current;
            void (both ? juice.perfect() : juice.sync());
            showCancelToast(both ? 'Оба READY' : 'Партнёр READY');
          } else {
            const wasCounting = countdownRef.current != null;
            const both = !readyMeRef.current;
            void (both ? juice.sync() : juice.miss());
            setCountdown(null);
            setMatchSeed(null);
            setStartAtMs(null);
            startSent.current = false;
            showCancelToast(
              both
                ? 'Оба сняли Ready'
                : wasCounting
                  ? 'Партнёр снял Ready — старт отменён'
                  : 'Партнёр снял Ready',
            );
          }
        }
        if (payload?.start && typeof payload.seed === 'number') {
          const at = payload.startAtMs ?? Date.now() + 2500;
          const drift = at - Date.now();
          setMatchSeed(payload.seed);
          setStartAtMs(at);
          setMatchSession({ gameId, seed: payload.seed, startAtMs: at });
          setCountdown(3);
          if (drift < 500) {
            showCancelToast('Оба догоняют');
            void juice.perfect();
          } else {
            showCancelToast('Старт!');
          }
        }
      }
    });
    return () => {
      pairRealtime.sendGame('play-peek', { leave: true, fromId: user.id });
      off();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [pair?.code, user?.id, gameId, user?.displayName, pair]);

  // Entering a different game lobby clears local ready state
  useEffect(() => {
    setReadyMe(false);
    setReadyPeer(false);
    startSent.current = false;
    setCountdown(null);
    setMatchSeed(null);
    setStartAtMs(null);
  }, [gameId]);

  useEffect(() => {
    if (countdown === null) return;
    countScale.value = 0.55;
    countOpacity.value = 0.4;
    countScale.value = withSpring(1.08, { damping: 9, stiffness: 180 });
    countOpacity.value = withTiming(1, { duration: 180 });
    juice.hit();
    if (countdown <= 0) {
      juice.sync();
      const seed = matchSeed ?? Math.floor(Math.random() * 100000);
      const startAt = startAtMs ?? Date.now();
      const t = setTimeout(() => {
        router.replace({
          pathname: routes[gameId],
          params: {
            seed: String(seed),
            startAt: String(startAt),
          },
        });
      }, 280);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown((c) => (c == null ? c : c - 1)), 720);
    return () => clearTimeout(t);
  }, [countdown, gameId, router, matchSeed, startAtMs, countScale, countOpacity]);

  useEffect(() => {
    if (!readyMe || !readyPeer || countdown !== null || startSent.current) {
      if (!readyMe || !readyPeer) bothReadyNoted.current = false;
      return;
    }
    if (!isHost) {
      if (!bothReadyNoted.current) {
        bothReadyNoted.current = true;
        showCancelToast('Оба READY — ждём старт');
        void juice.perfect();
      }
      return;
    }
    startSent.current = true;
    bothReadyNoted.current = true;
    const seed = Math.floor(Math.random() * 100000);
    const startAt = Date.now() + 2800;
    setMatchSeed(seed);
    setStartAtMs(startAt);
    setMatchSession({ gameId, seed, startAtMs: startAt });
    pairRealtime.sendGame(gameId, { start: true, seed, startAtMs: startAt });
    setCountdown(3);
    showCancelToast('Старт для обоих');
    void juice.perfect();
    track('game_started', { game: gameId });
  }, [readyMe, readyPeer, countdown, gameId, isHost]);

  const countStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countScale.value }],
    opacity: countOpacity.value,
  }));
  const peerReadyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: peerReadyScale.value }],
  }));

  const onReady = () => {
    if (!user || countdown != null) return;
    setReadyMe(true);
    juice.hit();
    pairRealtime.sendGame(gameId, { ready: true, userId: user.id });
    if (readyPeer) {
      showCancelToast('Оба READY');
      void juice.perfect();
    }
  };

  const onUnready = () => {
    if (!user) return;
    setReadyMe(false);
    setCountdown(null);
    setMatchSeed(null);
    setStartAtMs(null);
    startSent.current = false;
    juice.miss();
    pairRealtime.sendGame(gameId, { ready: false, userId: user.id });
  };

  const solo = () => {
    const seed = Math.floor(Math.random() * 100000);
    track('game_started', { game: gameId, solo: true });
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
          {' · '}WS {wsOnline ? 'online' : 'переподключение…'}
          {typeof pair?.roomSize === 'number' ? ` · в комнате ${pair.roomSize}` : ''}
        </Text>

        <View style={styles.status}>
          <Text style={[styles.pill, readyMe && styles.pillReady]}>
            {readyMe ? 'Ты: READY' : 'Ты: …'}
          </Text>
          <Animated.Text style={[styles.pill, readyPeer && styles.pillReady, peerReadyStyle]}>
            {readyPeer ? 'Партнёр: READY' : 'Партнёр: …'}
          </Animated.Text>
        </View>

        {countdown != null ? (
          <Animated.Text style={[styles.count, countStyle]}>
            {countdown === 0 ? 'GO' : countdown}
          </Animated.Text>
        ) : null}

        {cancelToast ? <Text style={styles.cancelToast}>{cancelToast}</Text> : null}

        <View style={styles.actions}>
          {!readyMe ? (
            <LpdButton label="Ready" onPress={onReady} disabled={countdown != null} />
          ) : (
            <LpdButton
              label={countdown != null ? 'Отменить старт' : 'Снять Ready'}
              variant="ghost"
              onPress={onUnready}
            />
          )}
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
  pillReady: {
    borderColor: 'rgba(226,176,122,0.55)',
    backgroundColor: 'rgba(196,92,110,0.18)',
  },
  count: {
    marginTop: spacing.xxl,
    fontFamily: fonts.display,
    fontSize: 84,
    color: colors.accentRose,
    textAlign: 'center',
  },
  cancelToast: {
    fontFamily: fonts.uiMedium,
    fontSize: 14,
    color: colors.accentAmber,
    textAlign: 'center',
  },
  actions: {
    marginTop: 'auto',
    gap: spacing.sm,
  },
});
