import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { PairAvatar } from '../../src/components/PairAvatar';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';
import { juice } from '../../src/audio/juice';
import { getWsUrl, hydrateWsUrl, resetWsUrl, setWsUrl } from '../../src/realtime/wsConfig';
import { pairRealtime } from '../../src/realtime/PairRealtime';
import { sendPairMetaOrQueue, pendingPairMetaCount } from '../../src/realtime/pairMetaOutbox';
import { useMemories } from '../../src/store/MemoriesStore';
import { copyText, pairInviteMessage } from '../../src/utils/copyText';
import { confirmDestructive } from '../../src/utils/confirmDestructive';
import { usePremium } from '../../src/store/PremiumStore';
import { loadPlayStats, type PlayStats } from '../../src/stats/playStats';

const AGE_OK_KEY = 'lovepduo.age_ok_16';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, pair, unlinkPair, signOut, updateDisplayName, setPairName, tracks, notes, warmthPulse } =
    useApp();
  const { clearMemories, items: memories } = useMemories();
  const premium = usePremium();
  const [playStats, setPlayStats] = useState<PlayStats | null>(null);
  const [ageOk16, setAgeOk16] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.displayName ?? '');
  const [roomDraft, setRoomDraft] = useState(pair?.name ?? '');
  const [wsDraft, setWsDraft] = useState(getWsUrl());
  const [wsSaved, setWsSaved] = useState(getWsUrl());
  const [wsOnline, setWsOnline] = useState(pairRealtime.connected);
  const [nameSaved, setNameSaved] = useState(false);
  const [roomSaved, setRoomSaved] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [wsToast, setWsToast] = useState<string | null>(null);
  const [outboxTick, setOutboxTick] = useState(0);
  const wasOnline = useRef(pairRealtime.connected);
  const wsToastRef = useRef<string | null>(null);

  useEffect(() => {
    wsToastRef.current = wsToast;
  }, [wsToast]);

  useEffect(() => {
    setNameDraft(user?.displayName ?? '');
  }, [user?.displayName]);

  useEffect(() => {
    setRoomDraft(pair?.name ?? '');
  }, [pair?.name]);

  useEffect(() => {
    if (!pair) return;
    const id = setInterval(() => setOutboxTick((n) => n + 1), 2000);
    return () => clearInterval(id);
  }, [pair?.code]);

  useEffect(() => {
    void loadPlayStats().then(setPlayStats);
    void juice.hydrateMuted().then(setSfxMuted);
    hydrateWsUrl().then((url) => {
      setWsDraft(url);
      setWsSaved(url);
    });
    return pairRealtime.onStatus((online) => {
      setWsOnline(online);
      if (online && !wasOnline.current) {
        const toast =
          wsToastRef.current === 'Realtime offline — переподключение…' ||
          wsToastRef.current === 'Realtime online' ||
          wsToastRef.current === 'Оба на realtime'
            ? 'Оба на realtime'
            : 'Realtime online';
        wsToastRef.current = toast;
        setWsToast(toast);
        void juice.sync();
        setTimeout(() => setWsToast(null), 1600);
      } else if (!online && wasOnline.current) {
        wsToastRef.current = 'Realtime offline — переподключение…';
        setWsToast('Realtime offline — переподключение…');
        void juice.miss();
        setTimeout(() => setWsToast(null), 1800);
      }
      wasOnline.current = online;
    });
  }, []);

  return (
    <LpdBackground mood="night">
      <ScrollView
        contentContainerStyle={[
          styles.root,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.kicker}>Profile</Text>
        <Text style={typography.headline}>Пара и настройки</Text>
        <Text style={typography.body}>
          {user?.authProvider === 'google'
            ? `Google${user.email ? ` · ${user.email}` : ''}`
            : 'Локальный профиль · только на этом устройстве'}
          {pair?.code ? ` · код ${pair.code}` : ' · нет пары'}
          {premium.isPlus ? ' · Plus' : ' · Free'}
          {(() => {
            void outboxTick;
            const pending = pendingPairMetaCount();
            return pending > 0 ? ` · sync ${pending}` : '';
          })()}
        </Text>
        <Text style={typography.caption}>
          {ageOk16 ? '16+ подтверждён' : '16+ не подтверждён'} · пара живёт по коду и WS-комнате.
          Локальный вход — не облачный аккаунт; Duo Plus entitlement синкается по WS, не через магазин
          (пока).
        </Text>
        <View style={styles.statStrip}>
          {(
            [
              [
                'd',
                pair?.pairedAt
                  ? String(Math.max(1, Math.floor((Date.now() - pair.pairedAt) / 86_400_000) + 1))
                  : '0',
                'дней',
              ],
              ['g', String(pair?.gamesStarted ?? 0), 'стартов'],
              ['t', String(tracks.length), 'треков'],
              ['n', String(notes.length), 'заметок'],
              ['m', String(memories.length), 'память'],
              ['w', String(warmthPulse), 'тепла'],
              ['r', pair?.code ?? '—', 'код'],
            ] as const
          ).map(([k, n, l]) => (
            <View key={k} style={styles.statPill}>
              <Text style={styles.statPillNum}>{n}</Text>
              <Text style={styles.statPillLabel}>{l}</Text>
            </View>
          ))}
        </View>

        <View style={styles.row}>
          <PairAvatar name={user?.displayName ?? 'Ты'} presence="online" size={64} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.name}>{user?.displayName ?? 'Ты'}</Text>
            <Text style={typography.caption}>Код: {pair?.code ?? '—'}</Text>
            <Text style={typography.caption}>{pair?.name}</Text>
            <Text style={[styles.wsBadge, wsOnline ? styles.wsOn : styles.wsOff]}>
              WS {wsOnline ? 'online' : 'переподключение…'}
            </Text>
            {wsToast ? <Text style={styles.wsToast}>{wsToast}</Text> : null}
          </View>
        </View>

        <View style={styles.wsBox}>
          <Text style={styles.wsLabel}>Имя в паре</Text>
          <TextInput
            value={nameDraft}
            onChangeText={(t) => {
              setNameDraft(t);
              setNameSaved(false);
            }}
            placeholder="Как тебя зовут"
            placeholderTextColor={colors.textMuted}
            style={styles.nameInput}
          />
          <LpdButton
            label={nameSaved ? 'Имя сохранено' : 'Сохранить имя'}
            variant="ghost"
            onPress={async () => {
              const next = await updateDisplayName(nameDraft);
              setNameDraft(next.displayName);
              setNameSaved(true);
              const racing =
                wsToastRef.current === 'Имя сохранено' ||
                wsToastRef.current === 'Оба назвались' ||
                wsToastRef.current === 'Оба обновили имена';
              const toast = racing ? 'Оба назвались' : 'Имя сохранено';
              wsToastRef.current = toast;
              setWsToast(toast);
              setTimeout(() => setWsToast(null), 1600);
              void juice.hit();
              if (pair) {
                pairRealtime.connect(pair.code, next.id, next.displayName);
                pairRealtime.send({
                  type: 'presence',
                  status: 'online',
                  name: next.displayName,
                });
                const result = sendPairMetaOrQueue('display-name', {
                  name: next.displayName,
                  fromId: next.id,
                });
                if (result === 'queued') {
                  wsToastRef.current = 'Имя · sync ждёт online';
                  setWsToast('Имя · sync ждёт online');
                  setTimeout(() => setWsToast(null), 1600);
                }
              }
            }}
          />
          <Text style={styles.wsLabel}>Имя пары</Text>
          <TextInput
            value={roomDraft}
            onChangeText={(t) => {
              setRoomDraft(t);
              setRoomSaved(false);
            }}
            placeholder="Наша пара"
            placeholderTextColor={colors.textMuted}
            style={styles.nameInput}
          />
          <LpdButton
            label={roomSaved ? 'Пара сохранена' : 'Сохранить имя пары'}
            variant="ghost"
            onPress={() => {
              const next = roomDraft.trim() || 'Наша пара';
              const both = pair?.name === next;
              const racing =
                both &&
                (wsToastRef.current === 'Оба назвали пару' ||
                  wsToastRef.current === 'Оба в одной паре');
              setPairName(next);
              setRoomSaved(true);
              const result = sendPairMetaOrQueue('room-name', { name: next });
              const toast = racing
                ? 'Оба в одной паре'
                : both
                  ? 'Оба назвали пару'
                  : result === 'sent'
                    ? 'Имя пары сохранено'
                    : 'Имя пары · sync ждёт online';
              wsToastRef.current = toast;
              setWsToast(toast);
              setTimeout(() => setWsToast(null), 1600);
              void (both ? juice.perfect() : juice.card());
            }}
          />
          {pair?.code ? (
            <LpdButton
              label={inviteCopied ? 'Invite скопирован' : 'Скопировать invite + deep link'}
              variant="ghost"
              onPress={() => {
                void copyText(pairInviteMessage(pair.code)).then((ok) => {
                  if (ok) {
                    setInviteCopied(true);
                    setTimeout(() => setInviteCopied(false), 1600);
                    void juice.warmth();
                  }
                });
              }}
            />
          ) : null}
        </View>

        <View style={styles.wsBox}>
          <Text style={styles.wsLabel}>Realtime URL (LAN для Android)</Text>
          <TextInput
            value={wsDraft}
            onChangeText={setWsDraft}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ws://192.168.0.120:8787"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Text style={styles.lan}>
            На ПК: backend `npm start`. На телефоне укажи IP ПК, например
            ws://192.168.0.120:8787 — оба устройства в одной Wi‑Fi.
            Production позже: wss://realtime.lovepduo.app (TLS + auth).
          </Text>
          {wsDraft.startsWith('wss://') ? (
            <Text style={styles.wssHint}>
              wss:// — ок для prod. Пока backend stub слушает только ws://:8787.
            </Text>
          ) : null}
          <View style={styles.wsActions}>
            <LpdButton
              label="Сохранить URL"
              onPress={async () => {
                await setWsUrl(wsDraft);
                setWsSaved(getWsUrl());
                void juice.hit();
                setWsToast('URL сохранён — reconnect…');
                setTimeout(() => setWsToast(null), 1600);
                if (user && pair) {
                  pairRealtime.connect(pair.code, user.id, user.displayName);
                }
              }}
            />
            <LpdButton
              label="Пресет LAN 192.168.0.120"
              variant="ghost"
              onPress={() => {
                setWsDraft('ws://192.168.0.120:8787');
                setWsToast('LAN пресет — сохрани URL на обоих');
                setTimeout(() => setWsToast(null), 2000);
                void juice.card();
              }}
            />
            <LpdButton
              label="Пресет Tunnel wss://…"
              variant="ghost"
              onPress={() => {
                setWsDraft('wss://REPLACE.trycloudflare.com');
                setWsToast('Tunnel пресет — вставь URL из cloudflared');
                setTimeout(() => setWsToast(null), 2200);
                void juice.card();
              }}
            />
            <LpdButton
              label="Проверить соединение"
              variant="ghost"
              onPress={() => {
                void (async () => {
                  if (!pair || !user) {
                    wsToastRef.current = 'Сначала войди в пару';
                    setWsToast('Сначала войди в пару');
                    setTimeout(() => setWsToast(null), 1800);
                    void juice.miss();
                    return;
                  }
                  if (!pairRealtime.connected) {
                    pairRealtime.connect(pair.code, user.id, user.displayName);
                    wsToastRef.current = 'Offline — reconnect…';
                    setWsToast('Offline — reconnect…');
                    setTimeout(() => setWsToast(null), 1800);
                    void juice.miss();
                    return;
                  }
                  setWsToast('Ping…');
                  const ms = await pairRealtime.ping();
                  if (ms == null) {
                    wsToastRef.current = 'Ping timeout — проверь URL/Wi‑Fi';
                    setWsToast('Ping timeout — проверь URL/Wi‑Fi');
                    void juice.miss();
                  } else {
                    wsToastRef.current = `Realtime ok · ${ms} ms`;
                    setWsToast(`Realtime ok · ${ms} ms`);
                    void juice.sync();
                  }
                  setTimeout(() => setWsToast(null), 2200);
                })();
              }}
            />
            <LpdButton
              label="Сбросить на default"
              variant="ghost"
              onPress={async () => {
                await resetWsUrl();
                const url = getWsUrl();
                setWsDraft(url);
                setWsSaved(url);
                setWsToast('Default WS');
                setTimeout(() => setWsToast(null), 1600);
                void juice.hit();
                if (user && pair) {
                  pairRealtime.connect(pair.code, user.id, user.displayName);
                }
              }}
            />
          </View>
          <Text style={typography.caption}>Сейчас: {wsSaved}</Text>
        </View>

        <View style={styles.plusBox}>
          <Text style={styles.plusTitle}>Duo Plus</Text>
          <Text style={styles.plusMeta}>
            {premium.isPlus
              ? premium.daysLeft >= 999
                ? 'Активен · пара'
                : `Trial · ${premium.daysLeft}д`
              : 'Free · платный контент на паре'}
            {' · '}полки {premium.maxShelves} · memory {premium.maxMemories}
            {playStats
              ? ` · стартов ${playStats.totalStarts} · streak ${playStats.streakDays}д`
              : ''}
          </Text>
          {playStats ? (
            <>
              <View style={styles.statStrip}>
                {(
                  [
                    ['sky-claim', 'Sky'],
                    ['heartbeat', 'Beat'],
                    ['truth-or-spark', 'ToS'],
                    ['signal-draw', 'Draw'],
                    ['orbit-catch', 'Orbit'],
                    ['soft-duel', 'Duel'],
                    ['word-veil', 'Veil'],
                  ] as const
                ).map(([id, label]) => (
                  <View key={id} style={styles.statPill}>
                    <Text style={styles.statPillNum}>{playStats.byGame[id] ?? 0}</Text>
                    <Text style={styles.statPillLabel}>{label}</Text>
                  </View>
                ))}
              </View>
              <Text style={typography.caption}>
                {premium.isPlus ? 'Plus · ' : 'Free · '}
                старты по играм · streak {playStats.streakDays}д · last{' '}
                {playStats.lastPlayDay ?? '—'}
              </Text>
            </>
          ) : null}
          {premium.features.map((f) => (
            <View key={f.id} style={styles.plusRow}>
              <Text style={styles.plusFeat}>{f.label}</Text>
              <Text style={styles.plusVals}>
                {f.freeValue} → {f.plusValue}
              </Text>
            </View>
          ))}
          {!premium.isPlus ? (
            <LpdButton
              label="Trial Duo Plus · 7 дней"
              onPress={() => {
                const ends = premium.startTrial();
                if (ends) {
                  const result = sendPairMetaOrQueue('duo-plus', {
                    trialEndsAt: ends,
                    fromId: user?.id,
                  });
                  setWsToast(
                    result === 'sent'
                      ? 'Duo Plus trial 7д · для пары'
                      : 'Duo Plus trial 7д · sync ждёт online',
                  );
                } else {
                  setWsToast('Trial уже был');
                }
                setTimeout(() => setWsToast(null), 1800);
                void (ends ? juice.perfect() : juice.miss());
              }}
            />
          ) : (
            <LpdButton
              label="Снять Plus (dev)"
              variant="ghost"
              onPress={() => {
                premium.clearPlus();
                const result = sendPairMetaOrQueue('duo-plus', {
                  cleared: true,
                  fromId: user?.id,
                });
                setWsToast(
                  result === 'sent' ? 'Снова Free · у обоих' : 'Free · sync ждёт online',
                );
                setTimeout(() => setWsToast(null), 1600);
                void juice.miss();
              }}
            />
          )}
          {!premium.isPlus ? (
            <LpdButton
              label="Unlock Plus (dev / без IAP)"
              variant="ghost"
              onPress={() => {
                premium.unlockDevPlus();
                const result = sendPairMetaOrQueue('duo-plus', {
                  tier: 'duo_plus',
                  trialEndsAt: null,
                  fromId: user?.id,
                });
                setWsToast(
                  result === 'sent'
                    ? 'Duo Plus unlocked · для пары'
                    : 'Duo Plus unlocked · sync ждёт online',
                );
                setTimeout(() => setWsToast(null), 1600);
                void juice.perfect();
              }}
            />
          ) : null}
          <Text style={typography.caption}>
            IAP/Google Play Billing позже. Entitlement синкается на пару по WS; привязка к коду
            пары {pair?.code ?? '—'}.
          </Text>
        </View>

        <View style={styles.actions}>
          <LpdButton
            label={sfxMuted ? 'SFX + haptics: выкл' : 'SFX + haptics: вкл'}
            variant="ghost"
            onPress={async () => {
              const next = !sfxMuted;
              setSfxMuted(next);
              await juice.setMuted(next);
              setWsToast(next ? 'SFX + haptics выкл' : 'SFX + haptics вкл');
              setTimeout(() => setWsToast(null), 1600);
              if (!next) void juice.hit();
            }}
          />
          <LpdButton
            label="Отвязать пару"
            variant="ghost"
            onPress={() => {
              void confirmDestructive(
                'Отвязать пару?',
                'Код пары сбросится. Memories останутся локально.',
              ).then(async (ok) => {
                if (!ok) return;
                void juice.miss();
                await unlinkPair();
                router.replace('/pair/create');
              });
            }}
          />
          <LpdButton
            label="Выйти"
            variant="danger"
            onPress={() => {
              void confirmDestructive(
                'Выйти из аккаунта?',
                'Локальные memories будут очищены на этом устройстве.',
              ).then(async (ok) => {
                if (!ok) return;
                void juice.miss();
                clearMemories();
                await signOut();
                router.replace('/welcome');
              });
            }}
          />
        </View>
      </ScrollView>
    </LpdBackground>
  );
}

const styles = StyleSheet.create({
  root: {
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
  statStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statPill: {
    minWidth: 48,
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
  plusBox: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.28)',
    backgroundColor: 'rgba(142,59,74,0.14)',
  },
  plusTitle: {
    fontFamily: fonts.uiSemi,
    fontSize: 16,
    color: colors.accentAmber,
  },
  plusMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  plusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  plusFeat: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.textPrimary,
    flex: 1,
  },
  plusVals: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
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
  wsBadge: {
    marginTop: 6,
    alignSelf: 'flex-start',
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  wsOn: {
    color: colors.accentMist,
    backgroundColor: 'rgba(156,196,196,0.14)',
  },
  wsOff: {
    color: colors.accentRose,
    backgroundColor: 'rgba(196,92,110,0.16)',
  },
  wsToast: {
    marginTop: 6,
    fontFamily: fonts.uiMedium,
    fontSize: 13,
    color: colors.accentAmber,
  },
  wsBox: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.stroke,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  wsLabel: {
    fontFamily: fonts.uiSemi,
    fontSize: 14,
    color: colors.textPrimary,
  },
  nameInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.28)',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    color: colors.textPrimary,
    fontFamily: fonts.ui,
    fontSize: 15,
    backgroundColor: 'rgba(20,14,28,0.55)',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.28)',
    borderRadius: radii.md,
    paddingHorizontal: 14,
    color: colors.textPrimary,
    fontFamily: fonts.mono,
    fontSize: 13,
    backgroundColor: 'rgba(20,14,28,0.55)',
  },
  lan: {
    fontFamily: fonts.ui,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  wssHint: {
    fontFamily: fonts.uiMedium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.accentAmber,
  },
  wsActions: {
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
