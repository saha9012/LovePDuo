import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { BrandMark } from '../../src/components/BrandMark';
import { PairAvatar } from '../../src/components/PairAvatar';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { juice } from '../../src/audio/juice';
import { useMemories } from '../../src/store/MemoriesStore';
import { copyText, pairInviteMessage } from '../../src/utils/copyText';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, pair, warmthPulse, setMood } = useApp();
  const { items: memories } = useMemories();
  const pulse = useSharedValue(1);
  const [wsOnline, setWsOnline] = useState(false);
  const [copied, setCopied] = useState(false);
  const [warmthToast, setWarmthToast] = useState<string | null>(null);
  const [roomToast, setRoomToast] = useState<string | null>(null);
  const [peerLobby, setPeerLobby] = useState<{ game: string; title: string } | null>(null);
  const lastMemory = memories[0];
  const warmthSeen = React.useRef(0);
  const warmthSentAt = React.useRef(0);
  const nameSeen = React.useRef(pair?.name ?? '');
  const presenceSeen = React.useRef(pair?.partnerPresence ?? 'offline');
  const partnerNameSeen = React.useRef(pair?.partnerName ?? '');
  const memorySeen = React.useRef(lastMemory?.id ?? '');
  const roomSizeSeen = React.useRef(pair?.roomSize ?? 0);
  const lastMoodMatchAt = React.useRef(0);
  const lastMoodMatch = React.useRef<string | null>(null);

  useEffect(() => {
    const off = pairRealtime.onStatus(setWsOnline);
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    const id = lastMemory?.id ?? '';
    if (!id || id === memorySeen.current) return;
    if (memorySeen.current) {
      setRoomToast(`Memory: ${lastMemory?.title}`);
      void juice.card();
      const t = setTimeout(() => setRoomToast(null), 1800);
      memorySeen.current = id;
      return () => clearTimeout(t);
    }
    memorySeen.current = id;
  }, [lastMemory?.id, lastMemory?.title]);

  useEffect(() => {
    const name = pair?.partnerName ?? '';
    if (!name || name === partnerNameSeen.current) return;
    if (
      partnerNameSeen.current &&
      partnerNameSeen.current !== 'Ожидание партнёра' &&
      partnerNameSeen.current !== 'Партнёр' &&
      name !== 'Партнёр' &&
      name !== 'Ожидание партнёра'
    ) {
      setRoomToast(`Партнёр теперь: ${name}`);
      void juice.card();
      const t = setTimeout(() => setRoomToast(null), 1800);
      partnerNameSeen.current = name;
      return () => clearTimeout(t);
    }
    partnerNameSeen.current = name;
  }, [pair?.partnerName]);

  useEffect(() => {
    const cur = pair?.partnerPresence ?? 'offline';
    const prev = presenceSeen.current;
    if (prev !== cur) {
      if (prev === 'offline' && cur === 'online') {
        setRoomToast('Партнёр online');
        void juice.sync();
        const t = setTimeout(() => setRoomToast(null), 1600);
        presenceSeen.current = cur;
        return () => clearTimeout(t);
      }
      if (prev === 'online' && (cur === 'away' || cur === 'offline')) {
        setRoomToast(cur === 'away' ? 'Партнёр away' : 'Партнёр offline');
        void juice.miss();
        const t = setTimeout(() => setRoomToast(null), 1600);
        presenceSeen.current = cur;
        return () => clearTimeout(t);
      }
      if ((prev === 'away' || prev === 'offline') && cur === 'online') {
        setRoomToast('Партнёр снова рядом');
        void juice.hit();
        const t = setTimeout(() => setRoomToast(null), 1600);
        presenceSeen.current = cur;
        return () => clearTimeout(t);
      }
      presenceSeen.current = cur;
    }
  }, [pair?.partnerPresence]);

  useEffect(() => {
    const name = pair?.name ?? '';
    if (!name || name === nameSeen.current) return;
    if (nameSeen.current) {
      setRoomToast(`Комната: ${name}`);
      void juice.card();
      const t = setTimeout(() => setRoomToast(null), 1800);
      nameSeen.current = name;
      return () => clearTimeout(t);
    }
    nameSeen.current = name;
  }, [pair?.name]);

  useEffect(() => {
    const size = typeof pair?.roomSize === 'number' ? pair.roomSize : 0;
    const prev = roomSizeSeen.current;
    if (prev > 0 && prev < 2 && size >= 2) {
      setRoomToast('Оба в комнате');
      void juice.perfect();
      const t = setTimeout(() => setRoomToast(null), 1800);
      roomSizeSeen.current = size;
      return () => clearTimeout(t);
    }
    if (prev >= 2 && size === 1) {
      setRoomToast('Партнёр вышел из комнаты');
      void juice.miss();
      const t = setTimeout(() => setRoomToast(null), 1800);
      roomSizeSeen.current = size;
      return () => clearTimeout(t);
    }
    roomSizeSeen.current = size;
  }, [pair?.roomSize]);

  useEffect(() => {
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'peer_joined') {
        const name = typeof msg.name === 'string' && msg.name ? msg.name : 'Партнёр';
        setRoomToast(`${name} вошёл`);
        void juice.sync();
        setTimeout(() => setRoomToast(null), 1800);
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'play-peek') {
        const payload = msg.payload as {
          game?: string;
          title?: string;
          fromId?: string;
          leave?: boolean;
        } | undefined;
        if (!payload || payload.fromId === user?.id) return;
        if (payload.leave) {
          setPeerLobby(null);
          setRoomToast('Партнёр ушёл из лобби');
          void juice.miss();
          setTimeout(() => setRoomToast(null), 1600);
          return;
        }
        if (payload.game && payload.title) {
          setPeerLobby({ game: payload.game, title: payload.title });
          setRoomToast(`Партнёр в лобби: ${payload.title}`);
          void juice.hit();
          setTimeout(() => setRoomToast(null), 1800);
        }
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'mood') {
        const payload = msg.payload as { mood?: 'night' | 'warm' | 'rain' } | undefined;
        if (payload?.mood === 'night' || payload?.mood === 'warm' || payload?.mood === 'rain') {
          const same = pair?.mood === payload.mood;
          setMood(payload.mood);
          const again =
            same &&
            lastMoodMatch.current === payload.mood &&
            Date.now() - lastMoodMatchAt.current < 3200;
          if (same) {
            lastMoodMatchAt.current = Date.now();
            lastMoodMatch.current = payload.mood;
          }
          setRoomToast(
            again
              ? 'Оба в настроении'
              : same
                ? payload.mood === 'night'
                  ? 'Оба: Ночь'
                  : payload.mood === 'warm'
                    ? 'Оба: Тёплый свет'
                    : 'Оба: Дождь'
                : payload.mood === 'night'
                  ? 'Партнёр: Ночь'
                  : payload.mood === 'warm'
                    ? 'Партнёр: Тёплый свет'
                    : 'Партнёр: Дождь',
          );
          void (again || same ? juice.perfect() : juice.card());
          setTimeout(() => setRoomToast(null), 1600);
        }
      }
    });
    return () => {
      off();
    };
  }, [setMood, user?.id, pair?.mood]);

  useEffect(() => {
    if (!warmthPulse) return;
    pulse.value = withSequence(
      withTiming(1.08, { duration: 180 }),
      withTiming(1, { duration: 280 }),
    );
    if (warmthPulse > warmthSeen.current) {
      warmthSeen.current = warmthPulse;
      const meet = Date.now() - warmthSentAt.current < 2800;
      setWarmthToast(meet ? 'Тепло встречное' : 'Тепло в комнате');
      void (meet ? juice.perfect() : juice.warmth());
      const t = setTimeout(() => setWarmthToast(null), 1600);
      return () => clearTimeout(t);
    }
  }, [warmthPulse, pulse]);

  const warmthStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const pickMood = (m: 'night' | 'warm' | 'rain') => {
    const same = pair?.mood === m;
    const again =
      same && lastMoodMatch.current === m && Date.now() - lastMoodMatchAt.current < 3200;
    setMood(m);
    pairRealtime.sendGame('mood', { mood: m });
    if (same) {
      lastMoodMatchAt.current = Date.now();
      lastMoodMatch.current = m;
    }
    setRoomToast(
      again
        ? 'Оба в настроении'
        : same
          ? m === 'night'
            ? 'Оба: Ночь'
            : m === 'warm'
              ? 'Оба: Тёплый свет'
              : 'Оба: Дождь'
          : m === 'night'
            ? 'Настроение: Ночь'
            : m === 'warm'
              ? 'Настроение: Тёплый свет'
              : 'Настроение: Дождь',
    );
    void (again || same ? juice.perfect() : juice.hit());
    setTimeout(() => setRoomToast(null), 1400);
  };

  return (
    <LpdBackground mood={pair?.mood ?? 'night'}>
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <BrandMark size="nav" />
        <View style={styles.room}>
          <Text style={styles.roomName}>{pair?.name ?? 'Комната'}</Text>
          <View style={styles.pairRow}>
            <View style={styles.person}>
              <PairAvatar name={user?.displayName ?? 'Ты'} presence="online" />
              <Text style={styles.personName}>{user?.displayName ?? 'Ты'}</Text>
            </View>
            <View style={styles.linkLine} />
            <View style={styles.person}>
              <PairAvatar
                name={pair?.partnerName ?? 'Партнёр'}
                presence={pair?.partnerPresence ?? 'offline'}
              />
              <Text style={styles.personName}>{pair?.partnerName ?? 'Партнёр'}</Text>
            </View>
          </View>
          <Text style={typography.body}>
            {pair?.partnerPresence === 'online'
              ? 'Партнёр рядом. LPD online. Ваш ход.'
              : 'Ждём пульс партнёра. Можно греть комнату заранее.'}
          </Text>
          <Text style={styles.meta}>
            Код пары: {pair?.code ?? '—'} · Realtime:{' '}
            {wsOnline ? 'online' : 'переподключение…'}
            {typeof pair?.roomSize === 'number' ? ` · в комнате ${pair.roomSize}` : ''}
          </Text>
          {Platform.OS === 'web' ? (
            <Text style={styles.hint}>
              Тест вдвоём: окно 1 создаёт пару, окно 2 (инкognito) → «есть код». Один backend :8787.
            </Text>
          ) : (
            <Text style={styles.hint}>
              Два телефона: Profile → Realtime URL = ws://IP_ПК:8787 (одна Wi‑Fi).
            </Text>
          )}
          {lastMemory ? (
            <Text style={styles.memory}>
              Последнее: {lastMemory.title} — {lastMemory.detail}
            </Text>
          ) : null}
          {warmthToast ? <Text style={styles.warmthToast}>{warmthToast}</Text> : null}
          {roomToast ? <Text style={styles.roomToast}>{roomToast}</Text> : null}
          {peerLobby ? (
            <Text
              style={styles.peerLobby}
              onPress={() =>
                router.push({ pathname: '/game/lobby', params: { game: peerLobby.game } })
              }
            >
              Партнёр ждёт в {peerLobby.title} — тапни
            </Text>
          ) : null}
        </View>

        <Animated.View style={[styles.ctaBlock, warmthStyle]}>
          <LpdButton
            label={peerLobby ? `К партнёру · ${peerLobby.title}` : 'Играть вдвоём'}
            onPress={() =>
              peerLobby
                ? router.push({ pathname: '/game/lobby', params: { game: peerLobby.game } })
                : router.push('/(tabs)/play')
            }
          />
          <LpdButton
            label="Отправить тепло"
            variant="ghost"
            onPress={() => {
              warmthSentAt.current = Date.now();
              pairRealtime.sendWarmth();
              setWarmthToast('Тепло ушло');
              void juice.warmth();
              setTimeout(() => setWarmthToast(null), 1400);
            }}
          />
          <LpdButton
            label={copied ? 'Код скопирован' : 'Скопировать / поделиться кодом'}
            variant="ghost"
            onPress={() => {
              const code = pair?.code ?? '';
              void copyText(pairInviteMessage(code)).then((ok) => {
                if (ok) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                }
              });
              void juice.hit();
            }}
          />
          <View style={styles.moodRow}>
            {(['night', 'warm', 'rain'] as const).map((m) => (
              <Text
                key={m}
                onPress={() => pickMood(m)}
                style={[styles.moodChip, pair?.mood === m && styles.moodActive]}
              >
                {m === 'night' ? 'Ночь' : m === 'warm' ? 'Тёплый свет' : 'Дождь'}
              </Text>
            ))}
          </View>
        </Animated.View>
      </View>
    </LpdBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  room: {
    gap: spacing.lg,
    marginTop: spacing.xxl,
  },
  roomName: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.textPrimary,
  },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  person: {
    alignItems: 'center',
    gap: 6,
  },
  personName: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    color: colors.textSecondary,
    maxWidth: 88,
    textAlign: 'center',
  },
  linkLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(226,176,122,0.35)',
  },
  ctaBlock: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  moodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  moodChip: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    color: colors.textMuted,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  moodActive: {
    color: colors.accentAmber,
    borderColor: 'rgba(226,176,122,0.45)',
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.accentAmber,
    letterSpacing: 1,
  },
  hint: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  memory: {
    marginTop: 4,
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 18,
    color: colors.accentMist,
  },
  warmthToast: {
    marginTop: 8,
    fontFamily: fonts.uiSemi,
    fontSize: 14,
    color: colors.accentRose,
  },
  roomToast: {
    marginTop: 4,
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: colors.accentAmber,
  },
  peerLobby: {
    marginTop: 10,
    fontFamily: fonts.uiSemi,
    fontSize: 14,
    color: colors.accentAmber,
    textDecorationLine: 'underline',
  },
});
