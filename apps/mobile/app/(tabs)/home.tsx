import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import {
  clearMatchSession,
  hydrateMatchSession,
  peekPairMatchSession,
  type MatchSession,
} from '../../src/realtime/matchSession';
import { sendWarmthOrQueue, pendingWarmthCount } from '../../src/realtime/warmthOutbox';
import { pendingMusicCount } from '../../src/realtime/musicOutbox';
import { pendingMemoryMutationCount } from '../../src/realtime/memoryMutationOutbox';
import { pendingNoteMutationCount } from '../../src/realtime/noteMutationOutbox';
import { pendingPairMetaCount } from '../../src/realtime/pairMetaOutbox';
import { sendGameIfPeerLive } from '../../src/realtime/sendGameIfPeerLive';
import { SectionRule } from '../../src/components/SectionRule';

const GAME_TITLES: Record<string, string> = {
  'sky-claim': 'Sky Claim',
  heartbeat: 'Heartbeat',
  'truth-or-spark': 'Truth Or Spark',
  'signal-draw': 'Signal Draw',
  'orbit-catch': 'Orbit Catch',
  'soft-duel': 'Soft Duel',
  'word-veil': 'Word Veil',
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, pair, warmthPulse, setMood, notes, tracks, playlists } = useApp();
  const { items: memories } = useMemories();
  const pulse = useSharedValue(1);
  const [wsOnline, setWsOnline] = useState(false);
  const [copied, setCopied] = useState(false);
  const [warmthToast, setWarmthToast] = useState<string | null>(null);
  const [roomToast, setRoomToast] = useState<string | null>(null);
  const [peerLobby, setPeerLobby] = useState<{ game: string; title: string } | null>(null);
  const [resumeMatch, setResumeMatch] = useState<MatchSession | null>(null);
  const [outboxTick, setOutboxTick] = useState(0);
  const lastMemory = memories[0];
  const lastNote = notes[0];
  const warmthSeen = React.useRef(0);
  const warmthSentAt = React.useRef(0);
  const warmthToastRef = React.useRef<string | null>(null);
  const roomToastRef = React.useRef<string | null>(null);
  const nameSeen = React.useRef(pair?.name ?? '');
  const presenceSeen = React.useRef(pair?.partnerPresence ?? 'offline');
  const partnerNameSeen = React.useRef(pair?.partnerName ?? '');
  const memorySeen = React.useRef(lastMemory?.id ?? '');
  const noteSeen = React.useRef(lastNote?.id ?? '');
  const roomSizeSeen = React.useRef(pair?.roomSize ?? 0);
  const lastMoodMatchAt = React.useRef(0);
  const lastMoodMatch = React.useRef<string | null>(null);

  useEffect(() => {
    if (!pair) return;
    const id = setInterval(() => setOutboxTick((n) => n + 1), 2000);
    return () => clearInterval(id);
  }, [pair?.code]);

  useEffect(() => {
    roomToastRef.current = roomToast;
  }, [roomToast]);

  useEffect(() => {
    const off = pairRealtime.onStatus(setWsOnline);
    return () => {
      off();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void hydrateMatchSession().then(() => {
      if (!alive || !pair?.code) return;
      setResumeMatch(peekPairMatchSession(pair.code));
    });
    const t = setInterval(() => {
      if (!pair?.code) {
        setResumeMatch(null);
        return;
      }
      setResumeMatch(peekPairMatchSession(pair.code));
    }, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pair?.code]);

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
    const id = lastNote?.id ?? '';
    if (!id || id === noteSeen.current) return;
    if (noteSeen.current) {
      const snip =
        (lastNote?.text.length ?? 0) > 36
          ? `${lastNote!.text.slice(0, 34)}…`
          : lastNote?.text ?? '';
      setRoomToast(`Note · ${lastNote?.from ?? 'Партнёр'}: ${snip}`);
      void juice.card();
      const t = setTimeout(() => setRoomToast(null), 2000);
      noteSeen.current = id;
      return () => clearTimeout(t);
    }
    noteSeen.current = id;
  }, [lastNote?.id, lastNote?.text, lastNote?.from]);

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
        const duoLive = (pair?.roomSize ?? 0) >= 2;
        setRoomToast(
          duoLive ? 'Партнёр online' : 'Партнёр presence · ждём WS 2/2',
        );
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
        const duoLive = (pair?.roomSize ?? 0) >= 2;
        const racing =
          duoLive &&
          (roomToastRef.current === 'Партнёр offline' ||
            roomToastRef.current === 'Партнёр away' ||
            roomToastRef.current === 'Партнёр снова рядом' ||
            roomToastRef.current === 'Оба на связи');
        setRoomToast(
          racing
            ? 'Оба на связи'
            : duoLive
              ? 'Партнёр снова рядом'
              : 'Партнёр presence · ждём WS 2/2',
        );
        void juice.hit();
        const t = setTimeout(() => setRoomToast(null), 1600);
        presenceSeen.current = cur;
        return () => clearTimeout(t);
      }
      presenceSeen.current = cur;
    }
  }, [pair?.partnerPresence, pair?.roomSize]);

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
      const afterLeave =
        roomToastRef.current === 'Партнёр вышел' ||
        roomToastRef.current === 'Партнёр вышел из комнаты' ||
        roomToastRef.current === 'Оба снова online';
      const racing =
        roomToastRef.current === 'Оба в паре' ||
        roomToastRef.current === 'Оба в комнате' ||
        roomToastRef.current === 'Оба online';
      setRoomToast(afterLeave ? 'Оба снова online' : racing ? 'Оба online' : 'Оба в паре');
      void juice.perfect();
      const t = setTimeout(() => setRoomToast(null), 1800);
      roomSizeSeen.current = size;
      return () => clearTimeout(t);
    }
    if (prev >= 2 && size === 1) {
      setRoomToast('Партнёр вышел');
      void juice.miss();
      const t = setTimeout(() => setRoomToast(null), 1800);
      roomSizeSeen.current = size;
      return () => clearTimeout(t);
    }
    roomSizeSeen.current = size;
  }, [pair?.roomSize]);

  useEffect(() => {
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'peer_left') {
        setPeerLobby(null);
        return;
      }
      if (msg.type === 'peer_joined') {
        const name = typeof msg.name === 'string' && msg.name ? msg.name : 'Партнёр';
        const racing =
          roomToastRef.current === 'Партнёр вышел' ||
          roomToastRef.current === 'Партнёр вышел из комнаты' ||
          roomToastRef.current === 'Оба снова online' ||
          roomToastRef.current?.endsWith(' вошёл');
        setRoomToast(racing ? 'Оба снова online' : `${name} вошёл`);
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
      if (msg.type === 'game' && msg.gameId === 'room-name') {
        const payload = msg.payload as { name?: string } | undefined;
        if (typeof payload?.name === 'string' && payload.name.trim()) {
          const next = payload.name.trim();
          const both = pair?.name === next;
          const racing =
            both &&
            (roomToastRef.current === 'Оба назвали пару' ||
              roomToastRef.current === 'Оба назвали комнату' ||
              roomToastRef.current?.startsWith('Пара:') ||
              roomToastRef.current?.startsWith('Комната:'));
          setRoomToast(
            racing
              ? 'Оба в одной паре'
              : both
                ? 'Оба назвали пару'
                : `Пара: ${next}`,
          );
          void (both ? juice.perfect() : juice.card());
          setTimeout(() => setRoomToast(null), 1800);
        }
        return;
      }
      if (msg.type === 'game' && msg.gameId === 'display-name') {
        const payload = msg.payload as { name?: string; fromId?: string } | undefined;
        if (
          payload?.fromId &&
          payload.fromId !== user?.id &&
          typeof payload.name === 'string' &&
          payload.name.trim()
        ) {
          const racing =
            roomToastRef.current?.startsWith('Партнёр теперь:') ||
            roomToastRef.current === 'Оба обновили имена' ||
            roomToastRef.current === 'Оба назвались';
          setRoomToast(
            roomToastRef.current === 'Оба обновили имена' ||
              roomToastRef.current === 'Оба назвались'
              ? 'Оба назвались'
              : racing
                ? 'Оба обновили имена'
                : `Партнёр теперь: ${payload.name.trim()}`,
          );
          void (racing ? juice.perfect() : juice.card());
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
      const racing =
        meet &&
        (warmthToastRef.current === 'Тепло встречное' ||
          warmthToastRef.current === 'Оба в тепле');
      const next = racing ? 'Оба в тепле' : meet ? 'Тепло встречное' : 'Тепло паре';
      warmthToastRef.current = next;
      setWarmthToast(next);
      void (meet ? juice.perfect() : juice.warmth());
      const t = setTimeout(() => {
        warmthToastRef.current = null;
        setWarmthToast(null);
      }, 1600);
      return () => clearTimeout(t);
    }
  }, [warmthPulse, pulse]);

  const warmthStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const stats = useMemo(() => {
    const pairedAt = pair?.pairedAt;
    const daysTogether = pairedAt
      ? Math.max(1, Math.floor((Date.now() - pairedAt) / 86_400_000) + 1)
      : 0;
    const gameMems = memories.filter((m) =>
      ['sky', 'heartbeat', 'spark', 'draw', 'orbit', 'duel', 'veil'].includes(m.kind),
    );
    const shelfTracks = playlists.reduce((n, pl) => n + pl.trackIds.length, 0);
    const reactions = tracks.filter((t) => t.reaction).length;
    return {
      daysTogether,
      games: gameMems.length,
      memories: memories.length,
      notes: notes.length,
      tracks: tracks.length,
      shelfTracks,
      warmth: warmthPulse,
      reactions,
      online: pair?.partnerPresence === 'online' ? 1 : 0,
      room: typeof pair?.roomSize === 'number' ? pair.roomSize : wsOnline ? 1 : 0,
    };
  }, [
    pair?.pairedAt,
    pair?.partnerPresence,
    pair?.roomSize,
    pair?.gamesStarted,
    memories,
    notes.length,
    tracks,
    playlists,
    warmthPulse,
    wsOnline,
  ]);

  const recentFeed = useMemo(() => {
    const memRows = memories.slice(0, 8).map((m) => ({
      id: `m_${m.id}`,
      kind: 'memory' as const,
      title: m.title,
      detail: m.detail,
      at: m.at,
      pending: Boolean(m.pendingSync),
    }));
    const noteRows = notes.slice(0, 6).map((n) => ({
      id: `n_${n.id}`,
      kind: 'note' as const,
      title: n.from,
      detail: n.text,
      at: n.at,
      pending: Boolean(n.pendingSync),
    }));
    return [...memRows, ...noteRows].sort((a, b) => b.at - a.at).slice(0, 10);
  }, [memories, notes]);
  const feedPending = recentFeed.filter((r) => r.pending).length;
  const outboxPending = useMemo(() => {
    void outboxTick;
    return (
      pendingWarmthCount() +
      pendingMusicCount() +
      pendingMemoryMutationCount() +
      pendingNoteMutationCount() +
      pendingPairMetaCount()
    );
  }, [outboxTick, pair?.code, wsOnline]);
  const syncWaiting = feedPending + outboxPending;

  const pickMood = (m: 'night' | 'warm' | 'rain') => {
    const same = pair?.mood === m;
    const again =
      same && lastMoodMatch.current === m && Date.now() - lastMoodMatchAt.current < 3200;
    setMood(m);
    // Ephemeral room vibe — never spray mood into an empty WS room.
    sendGameIfPeerLive('mood', { mood: m });
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.root,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <BrandMark size="nav" />
          <Text style={styles.liveDot}>
            {stats.room >= 2
              ? `· live · ${stats.room}`
              : wsOnline
                ? '· WS solo'
                : '· …'}
          </Text>
        </View>

        <View style={styles.room}>
          <Text style={styles.roomName}>{pair?.name ?? 'Пара'}</Text>
          <View style={styles.pairRow}>
            <View style={styles.person}>
              <PairAvatar name={user?.displayName ?? 'Ты'} presence="online" />
              <Text style={styles.personName}>{user?.displayName ?? 'Ты'}</Text>
            </View>
            <View style={styles.linkLine}>
              <View style={styles.linkDash} />
              <Text style={styles.linkNum}>{stats.daysTogether || '—'}</Text>
              <View style={styles.linkDash} />
            </View>
            <View style={styles.person}>
              <PairAvatar
                name={pair?.partnerName ?? 'Партнёр'}
                presence={
                  typeof pair?.roomSize === 'number' && pair.roomSize >= 2
                    ? (pair?.partnerPresence ?? 'offline')
                    : pair?.partnerPresence === 'online'
                      ? 'away'
                      : (pair?.partnerPresence ?? 'offline')
                }
              />
              <Text style={styles.personName}>{pair?.partnerName ?? 'Партнёр'}</Text>
            </View>
          </View>
          <Text style={typography.body}>
            {typeof pair?.roomSize === 'number' && pair.roomSize >= 2
              ? 'Партнёр в комнате. LPD live. Ваш ход.'
              : pair?.partnerPresence === 'online'
                ? 'Presence ≠ room — ждём WS 2/2. Можно греть пару.'
                : 'Ждём пульс партнёра. Можно греть пару заранее.'}
          </Text>
          <Text style={styles.meta}>
            Пара {pair?.code ?? '—'} · {wsOnline ? 'WS online' : 'WS…'}
            {typeof pair?.roomSize === 'number' ? ` · WS ${pair.roomSize}/2` : ''}
            {syncWaiting > 0 ? ` · sync ${syncWaiting}` : ''}
          </Text>
        </View>

        <SectionRule label="Пара" right={pair?.code ?? '—'} />

        <View style={styles.statGrid}>
          {(
            [
              { n: stats.daysTogether, l: 'дней' },
              { n: stats.games, l: 'memory-игр' },
              { n: pair?.gamesStarted ?? 0, l: 'стартов' },
              { n: stats.warmth, l: 'тепла' },
              { n: stats.tracks, l: 'треков' },
              { n: stats.notes, l: 'заметок' },
              { n: stats.memories, l: 'memory' },
              { n: stats.shelfTracks, l: 'на полках' },
              { n: stats.reactions, l: 'реакций' },
            ] as const
          ).map((s) => (
            <View key={s.l} style={styles.statCell}>
              <Text style={styles.statNum}>{s.n}</Text>
              <Text style={styles.statLabel}>{s.l}</Text>
            </View>
          ))}
        </View>

        {resumeMatch ? (
          <View style={styles.resumeCard}>
            <Pressable
              onPress={() => {
                const age = Math.max(
                  0,
                  Math.round((Date.now() - resumeMatch.startAtMs) / 1000),
                );
                void juice.hit();
                router.push({
                  pathname: '/game/lobby',
                  params: { game: resumeMatch.gameId },
                });
                setRoomToast(
                  `Сессия · ${GAME_TITLES[resumeMatch.gameId] ?? resumeMatch.gameId} · ${age}с`,
                );
                setTimeout(() => setRoomToast(null), 1600);
              }}
            >
              <Text style={styles.resumeKicker}>Сессия пары</Text>
              <Text style={styles.resumeTitle}>
                {GAME_TITLES[resumeMatch.gameId] ?? resumeMatch.gameId}
              </Text>
              <Text style={styles.resumeMeta}>
                seed {resumeMatch.seed} ·{' '}
                {Math.max(0, Math.round((Date.now() - resumeMatch.startAtMs) / 1000))}с назад · тап
                —{' '}
                {Date.now() - resumeMatch.startAtMs > 8_000
                  ? 'в матч'
                  : 'в лобби'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                clearMatchSession(pair?.code);
                setResumeMatch(null);
                void juice.miss();
              }}
              hitSlop={8}
            >
              <Text style={styles.resumeDismiss}>сбросить</Text>
            </Pressable>
          </View>
        ) : null}

        {(warmthToast || roomToast || peerLobby) && (
          <View style={styles.toastBlock}>
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
        )}

        <Animated.View style={[styles.ctaBlock, warmthStyle]}>
          <View style={styles.ctaRow}>
            <View style={styles.ctaGrow}>
              <LpdButton
                label={peerLobby ? `К партнёру` : 'Играть'}
                onPress={() =>
                  peerLobby
                    ? router.push({ pathname: '/game/lobby', params: { game: peerLobby.game } })
                    : router.push('/(tabs)/play')
                }
              />
            </View>
            <View style={styles.ctaGrow}>
              <LpdButton
                label={`Тепло · ${stats.warmth}`}
                variant="ghost"
                onPress={() => {
                  warmthSentAt.current = Date.now();
                  const result = sendWarmthOrQueue();
                  setWarmthToast(result === 'sent' ? 'Тепло ушло' : 'Тепло ждёт online');
                  void juice.warmth();
                  setTimeout(() => setWarmthToast(null), 1400);
                }}
              />
            </View>
          </View>
          <View style={styles.quickRow}>
            <Pressable
              style={styles.quickChip}
              onPress={() => router.push('/(tabs)/music')}
            >
              <Text style={styles.quickNum}>{stats.tracks}</Text>
              <Text style={styles.quickLabel}>музыка</Text>
            </Pressable>
            <Pressable
              style={styles.quickChip}
              onPress={() => router.push('/(tabs)/together')}
            >
              <Text style={styles.quickNum}>{stats.notes}</Text>
              <Text style={styles.quickLabel}>together</Text>
            </Pressable>
            <Pressable
              style={styles.quickChip}
              onPress={() => router.push('/(tabs)/play')}
            >
              <Text style={styles.quickNum}>{stats.games}</Text>
              <Text style={styles.quickLabel}>каталог</Text>
            </Pressable>
            <Pressable
              style={styles.quickChip}
              onPress={() => {
                void copyText(pairInviteMessage(pair?.code ?? '')).then((ok) => {
                  if (ok) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1600);
                  }
                });
                void juice.hit();
              }}
            >
              <Text style={styles.quickNum}>{copied ? 'ok' : pair?.code?.slice(0, 3) ?? '—'}</Text>
              <Text style={styles.quickLabel}>{copied ? 'скопировано' : 'код'}</Text>
            </Pressable>
          </View>
          <View style={styles.moodRow}>
            {(['night', 'warm', 'rain'] as const).map((m) => (
              <Text
                key={m}
                onPress={() => pickMood(m)}
                style={[styles.moodChip, pair?.mood === m && styles.moodActive]}
              >
                {m === 'night' ? 'Ночь' : m === 'warm' ? 'Тёплый' : 'Дождь'}
              </Text>
            ))}
          </View>
        </Animated.View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Лента пары</Text>
            <Text style={styles.sectionMeta}>
              {recentFeed.length} событий
              {feedPending > 0 ? ` · ${feedPending} note/mem ждут` : ''}
              {outboxPending > 0 ? ` · ${outboxPending} outbox` : ''}
            </Text>
          </View>
          {recentFeed.length === 0 ? (
            <Text style={styles.emptyFeed}>
              Пока пусто — сыграйте раунд, киньте заметку или трек. Цифры сверху оживут.
            </Text>
          ) : (
            recentFeed.map((row) => (
              <View key={row.id} style={styles.feedRow}>
                <Text style={styles.feedKind}>{row.kind === 'note' ? 'note' : 'mem'}</Text>
                <View style={styles.feedBody}>
                  <Text style={styles.feedTitle} numberOfLines={1}>
                    {row.title}
                    {row.pending ? ' · ждёт' : ''}
                  </Text>
                  <Text style={styles.feedDetail} numberOfLines={2}>
                    {row.detail}
                  </Text>
                </View>
                <Text style={styles.feedWhen}>
                  {row.pending
                    ? 'sync'
                    : new Date(row.at).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                </Text>
              </View>
            ))
          )}
        </View>

        {Platform.OS === 'web' ? (
          <Text style={styles.hint}>
            Тест вдвоём: окно 1 создаёт пару, окно 2 (incognito) → «есть код». Backend :8787.
          </Text>
        ) : (
          <Text style={styles.hint}>
            Два телефона: Profile → Realtime URL = ws://IP_ПК:8787 (одна Wi‑Fi).
          </Text>
        )}
      </ScrollView>
    </LpdBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  root: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveDot: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.accentMist,
    letterSpacing: 0.5,
  },
  room: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  roomName: {
    fontFamily: fonts.display,
    fontSize: 32,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkDash: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(226,176,122,0.35)',
  },
  linkNum: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.accentAmber,
    minWidth: 18,
    textAlign: 'center',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  statCell: {
    width: '23%',
    flexGrow: 1,
    minWidth: 72,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,214,186,0.14)',
    backgroundColor: 'rgba(255,214,186,0.04)',
    alignItems: 'center',
    gap: 2,
  },
  statNum: {
    fontFamily: fonts.mono,
    fontSize: 20,
    color: colors.accentAmber,
  },
  statLabel: {
    fontFamily: fonts.ui,
    fontSize: 10,
    color: colors.textMuted,
    textTransform: 'lowercase',
  },
  resumeCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.4)',
    backgroundColor: 'rgba(142,59,74,0.22)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 4,
  },
  resumeKicker: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.accentAmber,
  },
  resumeTitle: {
    fontFamily: fonts.uiSemi,
    fontSize: 17,
    color: colors.textPrimary,
  },
  resumeMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
  },
  resumeDismiss: {
    marginTop: 4,
    alignSelf: 'flex-start',
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    color: colors.danger,
  },
  toastBlock: { gap: 4 },
  ctaBlock: {
    gap: spacing.sm,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ctaGrow: { flex: 1 },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickChip: {
    flexGrow: 1,
    minWidth: '22%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,214,186,0.18)',
    backgroundColor: 'rgba(255,214,186,0.05)',
    alignItems: 'center',
    gap: 2,
  },
  quickNum: {
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.textPrimary,
  },
  quickLabel: {
    fontFamily: fonts.ui,
    fontSize: 10,
    color: colors.textMuted,
  },
  moodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  moodChip: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    color: colors.textMuted,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(255,214,186,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  moodActive: {
    color: colors.accentAmber,
    borderColor: 'rgba(226,176,122,0.45)',
    backgroundColor: 'rgba(226,176,122,0.1)',
  },
  meta: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.accentAmber,
    letterSpacing: 0.8,
  },
  hint: {
    fontFamily: fonts.ui,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textMuted,
    marginTop: 4,
  },
  warmthToast: {
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    color: colors.accentRose,
  },
  roomToast: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: colors.accentAmber,
  },
  peerLobby: {
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    color: colors.accentAmber,
    textDecorationLine: 'underline',
  },
  section: {
    gap: 8,
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,214,186,0.1)',
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionTitle: {
    fontFamily: fonts.uiSemi,
    fontSize: 15,
    color: colors.textPrimary,
  },
  sectionMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  emptyFeed: {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,214,186,0.1)',
    backgroundColor: 'rgba(18,16,24,0.45)',
  },
  feedKind: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.accentMist,
    marginTop: 3,
    width: 28,
  },
  feedBody: { flex: 1, gap: 2 },
  feedTitle: {
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    color: colors.textPrimary,
  },
  feedDetail: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  feedWhen: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 3,
  },
});
