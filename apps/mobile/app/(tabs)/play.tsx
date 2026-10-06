import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { GameTile } from '../../src/components/GameTile';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { juice } from '../../src/audio/juice';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { useApp } from '../../src/store/AppStore';
import { useMemories } from '../../src/store/MemoriesStore';
import { usePremium } from '../../src/store/PremiumStore';
import { loadPlayStats, type PlayStats } from '../../src/stats/playStats';

type GameTag = 'mvp' | 'new';
type Filter = 'all' | GameTag;
type Cover = 'sky' | 'heartbeat' | 'spark' | 'draw' | 'orbit' | 'duel' | 'veil';

const FILTER_KEY = 'lovepduo.play_filter';
const LAST_GAME_KEY = 'lovepduo.last_game';

type CatalogItem = {
  id: string;
  title: string;
  subtitle: string;
  accent: 'rose' | 'amber' | 'mist';
  cover: Cover;
  badge: string;
  tag: GameTag;
  game: string;
};

const CATALOG: CatalogItem[] = [
  {
    id: 'sky',
    title: 'Sky Claim',
    subtitle: 'Лови огни с неба на своём поле. Комбо, обманки, реванш.',
    accent: 'amber',
    cover: 'sky',
    badge: 'MVP',
    tag: 'mvp',
    game: 'sky-claim',
  },
  {
    id: 'hb',
    title: 'Heartbeat Tap',
    subtitle: 'Общий бит. Личная точность + sync bonus.',
    accent: 'rose',
    cover: 'heartbeat',
    badge: 'MVP',
    tag: 'mvp',
    game: 'heartbeat',
  },
  {
    id: 'tos',
    title: 'Truth Or Spark',
    subtitle: 'Вопросы, задания и искры. Soft / spicy, без ваты.',
    accent: 'mist',
    cover: 'spark',
    badge: 'MVP',
    tag: 'mvp',
    game: 'truth-or-spark',
  },
  {
    id: 'draw',
    title: 'Signal Draw',
    subtitle: 'Общий холст. Янтарь и роза рисуют сигнал вместе.',
    accent: 'amber',
    cover: 'draw',
    badge: 'NEW',
    tag: 'new',
    game: 'signal-draw',
  },
  {
    id: 'orbit',
    title: 'Orbit Catch',
    subtitle: 'Co-op орбита. Ловите совпадение маркера и орба.',
    accent: 'mist',
    cover: 'orbit',
    badge: 'NEW',
    tag: 'new',
    game: 'orbit-catch',
  },
  {
    id: 'duel',
    title: 'Soft Duel',
    subtitle: 'Реакция на вспышку слова. Perfect / рано / реванш.',
    accent: 'rose',
    cover: 'duel',
    badge: 'NEW',
    tag: 'new',
    game: 'soft-duel',
  },
  {
    id: 'veil',
    title: 'Word Veil',
    subtitle: 'Ассоциации на одно слово. Сравниваем совпадение.',
    accent: 'mist',
    cover: 'veil',
    badge: 'NEW',
    tag: 'new',
    game: 'word-veil',
  },
];

export default function PlayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { pair, user } = useApp();
  const { items: memories } = useMemories();
  const premium = usePremium();
  const [startStats, setStartStats] = useState<PlayStats | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [lastGame, setLastGame] = useState<string | null>(null);
  const [peerLobby, setPeerLobby] = useState<{ game: string; title: string } | null>(null);
  const [peekToast, setPeekToast] = useState<string | null>(null);
  const filterRef = useRef<Filter>('all');
  const lastFilterMatch = useRef<Filter | null>(null);
  const lastFilterMatchAt = useRef(0);
  const lastGameRef = useRef<string | null>(null);
  const peekToastRef = useRef<string | null>(null);

  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  useEffect(() => {
    lastGameRef.current = lastGame;
  }, [lastGame]);

  const showPeek = (text: string, ms = 1600) => {
    peekToastRef.current = text;
    setPeekToast(text);
    setTimeout(() => {
      peekToastRef.current = null;
      setPeekToast(null);
    }, ms);
  };

  useEffect(() => {
    void loadPlayStats().then(setStartStats);
    const t = setInterval(() => {
      void loadPlayStats().then(setStartStats);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(FILTER_KEY).then((raw) => {
      if (raw === 'all' || raw === 'mvp' || raw === 'new') setFilter(raw);
    });
    void AsyncStorage.getItem(LAST_GAME_KEY).then((raw) => {
      if (raw) setLastGame(raw);
    });
  }, []);

  useEffect(() => {
    void AsyncStorage.setItem(FILTER_KEY, filter);
  }, [filter]);

  useEffect(() => {
    if (!pair || !user) return;
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'game' && msg.gameId === 'play-filter') {
        const payload = msg.payload as {
          filter?: Filter;
          fromId?: string;
          from?: string;
        } | undefined;
        if (!payload?.filter || payload.fromId === user.id) return;
        const both = filterRef.current === payload.filter;
        const again =
          both &&
          lastFilterMatch.current === payload.filter &&
          Date.now() - lastFilterMatchAt.current < 2800;
        if (both) {
          lastFilterMatch.current = payload.filter;
          lastFilterMatchAt.current = Date.now();
        }
        const label =
          payload.filter === 'all'
            ? 'Все'
            : payload.filter === 'mvp'
              ? 'MVP'
              : 'New';
        setPeekToast(
          again
            ? peekToastRef.current === 'Оба в каталоге' ||
              peekToastRef.current === 'Оба листают каталог'
              ? 'Оба листают каталог'
              : 'Оба в каталоге'
            : both
              ? `Оба: фильтр ${label}`
              : `${payload.from ?? 'Партнёр'}: фильтр ${label}`,
        );
        void (again || both ? juice.perfect() : juice.hit());
        setTimeout(() => setPeekToast(null), 1400);
        return;
      }
      if (msg.type !== 'game' || msg.gameId !== 'play-peek') return;
      const payload = msg.payload as {
        game?: string;
        title?: string;
        fromId?: string;
        leave?: boolean;
      } | undefined;
      if (!payload || payload.fromId === user.id) return;
      if (payload.leave) {
        setPeerLobby(null);
        showPeek('Партнёр ушёл из лобби');
        void juice.miss();
        return;
      }
      if (payload.game && payload.title) {
        setPeerLobby({ game: payload.game, title: payload.title });
        const afterLeave =
          peekToastRef.current === 'Партнёр ушёл из лобби' ||
          peekToastRef.current === 'Оба снова в лобби';
        const both = lastGameRef.current === payload.game;
        const racing =
          both &&
          (peekToastRef.current?.startsWith('Оба в «') ||
            peekToastRef.current === 'Оба ждут игру');
        showPeek(
          afterLeave
            ? 'Оба снова в лобби'
            : racing
              ? 'Оба ждут игру'
              : both
                ? `Оба в «${payload.title}»`
                : `Партнёр в лобби: ${payload.title}`,
        );
        void (afterLeave || racing || both ? juice.perfect() : juice.hit());
      }
    });
    return () => {
      off();
    };
  }, [pair?.code, user?.id]);

  const recent = useMemo(
    () => (lastGame ? CATALOG.find((g) => g.game === lastGame) ?? null : null),
    [lastGame],
  );

  const playStats = useMemo(() => {
    const byKind: Record<string, number> = {};
    for (const m of memories) {
      byKind[m.kind] = (byKind[m.kind] ?? 0) + 1;
    }
    const played = memories.filter((m) =>
      ['sky', 'heartbeat', 'spark', 'draw', 'orbit', 'duel', 'veil'].includes(m.kind),
    ).length;
    const mvp = CATALOG.filter((g) => g.tag === 'mvp').length;
    const neu = CATALOG.filter((g) => g.tag === 'new').length;
    return { played, catalog: CATALOG.length, mvp, neu, byKind };
  }, [memories]);

  const games = useMemo(() => {
    const query = q.trim().toLowerCase();
    return CATALOG.filter((g) => {
      if (filter !== 'all' && g.tag !== filter) return false;
      if (!query) return true;
      return (
        g.title.toLowerCase().includes(query) ||
        g.subtitle.toLowerCase().includes(query)
      );
    });
  }, [filter, q]);

  const openGame = (game: string) => {
    setLastGame(game);
    void AsyncStorage.setItem(LAST_GAME_KEY, game);
    void juice.hit();
    const title = CATALOG.find((g) => g.game === game)?.title ?? game;
    pairRealtime.sendGame('play-peek', {
      game,
      title,
      fromId: user?.id,
    });
    router.push({ pathname: '/game/lobby', params: { game } });
  };

  return (
    <LpdBackground mood="night">
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.kicker}>Play</Text>
        <Text style={typography.headline}>Миниигры для двоих</Text>
        <Text style={[typography.body, styles.sub]}>
          {playStats.catalog} в каталоге · memory-игр {playStats.played} · стартов{' '}
          {startStats?.totalStarts ?? 0} · streak {startStats?.streakDays ?? 0}д
          {premium.isPlus ? ' · Plus' : ' · Free'}
        </Text>
        <View style={styles.statStrip}>
          {(
            [
              ['sky-claim', 'sky', 'Sky'],
              ['heartbeat', 'heartbeat', 'Beat'],
              ['truth-or-spark', 'spark', 'ToS'],
              ['signal-draw', 'draw', 'Draw'],
              ['orbit-catch', 'orbit', 'Orbit'],
              ['soft-duel', 'duel', 'Duel'],
              ['word-veil', 'veil', 'Veil'],
            ] as const
          ).map(([gameId, kind, label]) => (
            <View key={kind} style={styles.statPill}>
              <Text style={styles.statPillNum}>
                {startStats?.byGame[gameId] ?? playStats.byKind[kind] ?? 0}
              </Text>
              <Text style={styles.statPillLabel}>{label}</Text>
            </View>
          ))}
        </View>
        {peekToast ? <Text style={styles.peekToast}>{peekToast}</Text> : null}

        {peerLobby ? (
          <Pressable onPress={() => openGame(peerLobby.game)} style={styles.peerLobby}>
            <Text style={styles.peerLobbyKicker}>Партнёр ждёт</Text>
            <Text style={styles.peerLobbyTitle}>{peerLobby.title}</Text>
            <Text style={styles.peerLobbySub}>Тапни — в лобби к партнёру</Text>
          </Pressable>
        ) : null}

        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Найти игру…"
          placeholderTextColor={colors.textMuted}
          style={styles.search}
        />

        <View style={styles.filters}>
          {([
            ['all', 'Все'],
            ['mvp', 'MVP'],
            ['new', 'New'],
          ] as const).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => {
                setFilter(id);
                setPeekToast(
                  id === 'all' ? 'Все игры' : id === 'mvp' ? 'Фильтр: MVP' : 'Фильтр: New',
                );
                void juice.hit();
                setTimeout(() => setPeekToast(null), 1200);
                pairRealtime.sendGame('play-filter', {
                  filter: id,
                  fromId: user?.id,
                  from: user?.displayName,
                });
              }}
              style={[styles.chip, filter === id && styles.chipOn]}
            >
              <Text style={[styles.chipLabel, filter === id && styles.chipLabelOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {recent ? (
          <Pressable onPress={() => openGame(recent.game)} style={styles.recent}>
            <Text style={styles.recentKicker}>Снова</Text>
            <Text style={styles.recentTitle}>{recent.title}</Text>
            <Text style={styles.recentSub}>{recent.subtitle}</Text>
          </Pressable>
        ) : null}

        <View style={styles.list}>
          {games.length === 0 ? (
            <Text style={styles.empty}>Ничего не нашлось. Сбрось фильтр.</Text>
          ) : (
            games.map((g) => (
              <GameTile
                key={g.id}
                title={g.title}
                subtitle={g.subtitle}
                accent={g.accent}
                cover={g.cover}
                badge={g.badge}
                plays={startStats?.byGame[g.game] ?? 0}
                onPress={() => openGame(g.game)}
              />
            ))
          )}
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
    marginBottom: spacing.xs,
  },
  statStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statPill: {
    minWidth: 44,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,214,186,0.14)',
    backgroundColor: 'rgba(255,214,186,0.04)',
    alignItems: 'center',
  },
  statPillNum: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.accentAmber,
  },
  statPillLabel: {
    fontFamily: fonts.ui,
    fontSize: 9,
    color: colors.textMuted,
  },
  peekToast: {
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: colors.accentAmber,
  },
  peerLobby: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.45)',
    backgroundColor: 'rgba(196,92,110,0.16)',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: 4,
  },
  peerLobbyKicker: {
    fontFamily: fonts.uiMedium,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.accentAmber,
    fontSize: 11,
  },
  peerLobbyTitle: {
    fontFamily: fonts.uiSemi,
    color: colors.textPrimary,
    fontSize: 18,
  },
  peerLobbySub: {
    fontFamily: fonts.ui,
    color: colors.textMuted,
    fontSize: 13,
  },
  search: {
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.stroke,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontFamily: fonts.ui,
    fontSize: 15,
    backgroundColor: 'rgba(36,28,49,0.55)',
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radii.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: {
    borderColor: 'rgba(226,176,122,0.5)',
    backgroundColor: 'rgba(226,176,122,0.12)',
  },
  chipLabel: {
    fontFamily: fonts.uiMedium,
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 0.6,
  },
  chipLabelOn: {
    color: colors.accentAmber,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  recent: {
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.35)',
    borderRadius: radii.md,
    padding: spacing.lg,
    gap: 4,
    backgroundColor: 'rgba(196,92,110,0.12)',
  },
  recentKicker: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.accentRose,
  },
  recentTitle: {
    fontFamily: fonts.uiSemi,
    fontSize: 18,
    color: colors.textPrimary,
  },
  recentSub: {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  empty: {
    fontFamily: fonts.ui,
    color: colors.textMuted,
    fontSize: 14,
  },
});
