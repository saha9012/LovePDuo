import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { useMemories } from '../../src/store/MemoriesStore';
import { copyText, pairInviteMessage } from '../../src/utils/copyText';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, pair, unlinkPair, signOut, updateDisplayName, setPairName } = useApp();
  const { clearMemories } = useMemories();
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
    void juice.hydrateMuted().then(setSfxMuted);
    hydrateWsUrl().then((url) => {
      setWsDraft(url);
      setWsSaved(url);
    });
    return pairRealtime.onStatus((online) => {
      setWsOnline(online);
      if (online && !wasOnline.current) {
        setWsToast('Realtime online');
        void juice.sync();
        setTimeout(() => setWsToast(null), 1600);
      } else if (!online && wasOnline.current) {
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
              void juice.hit();
              if (pair) {
                pairRealtime.connect(pair.code, next.id, next.displayName);
                pairRealtime.send({
                  type: 'presence',
                  status: 'online',
                  name: next.displayName,
                });
                pairRealtime.sendGame('display-name', {
                  name: next.displayName,
                  fromId: next.id,
                });
              }
            }}
          />
          <Text style={styles.wsLabel}>Имя комнаты</Text>
          <TextInput
            value={roomDraft}
            onChangeText={(t) => {
              setRoomDraft(t);
              setRoomSaved(false);
            }}
            placeholder="Наша ночь"
            placeholderTextColor={colors.textMuted}
            style={styles.nameInput}
          />
          <LpdButton
            label={roomSaved ? 'Комната сохранена' : 'Сохранить комнату'}
            variant="ghost"
            onPress={() => {
              const next = roomDraft.trim() || 'Наша комната';
              const both = pair?.name === next;
              const racing =
                both &&
                (wsToastRef.current === 'Оба назвали комнату' ||
                  wsToastRef.current === 'Оба в одной комнате');
              setPairName(next);
              setRoomSaved(true);
              const toast = racing
                ? 'Оба в одной комнате'
                : both
                  ? 'Оба назвали комнату'
                  : 'Имя комнаты сохранено';
              wsToastRef.current = toast;
              setWsToast(toast);
              setTimeout(() => setWsToast(null), 1600);
              pairRealtime.sendGame('room-name', { name: next });
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
            onPress={async () => {
              void juice.miss();
              await unlinkPair();
              router.replace('/pair/create');
            }}
          />
          <LpdButton
            label="Выйти"
            variant="danger"
            onPress={async () => {
              void juice.miss();
              clearMemories();
              await signOut();
              router.replace('/welcome');
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
