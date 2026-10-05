import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, pair, unlinkPair, signOut, updateDisplayName, setPairName } = useApp();
  const [sfxMuted, setSfxMuted] = useState(false);
  const [nameDraft, setNameDraft] = useState(user?.displayName ?? '');
  const [roomDraft, setRoomDraft] = useState(pair?.name ?? '');
  const [wsDraft, setWsDraft] = useState(getWsUrl());
  const [wsSaved, setWsSaved] = useState(getWsUrl());
  const [wsOnline, setWsOnline] = useState(pairRealtime.connected);
  const [nameSaved, setNameSaved] = useState(false);
  const [roomSaved, setRoomSaved] = useState(false);

  useEffect(() => {
    setNameDraft(user?.displayName ?? '');
  }, [user?.displayName]);

  useEffect(() => {
    setRoomDraft(pair?.name ?? '');
  }, [pair?.name]);

  useEffect(() => {
    hydrateWsUrl().then((url) => {
      setWsDraft(url);
      setWsSaved(url);
    });
    return pairRealtime.onStatus(setWsOnline);
  }, []);

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
            <Text style={[styles.wsBadge, wsOnline ? styles.wsOn : styles.wsOff]}>
              WS {wsOnline ? 'online' : 'offline'}
            </Text>
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
              setPairName(roomDraft);
              setRoomSaved(true);
              void juice.card();
            }}
          />
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
          </Text>
          <View style={styles.wsActions}>
            <LpdButton
              label="Сохранить URL"
              onPress={async () => {
                await setWsUrl(wsDraft);
                setWsSaved(getWsUrl());
                if (user && pair) {
                  pairRealtime.connect(pair.code, user.id, user.displayName);
                }
              }}
            />
            <LpdButton
              label="Пресет LAN 192.168.0.120"
              variant="ghost"
              onPress={() => setWsDraft('ws://192.168.0.120:8787')}
            />
            <LpdButton
              label="Сбросить на default"
              variant="ghost"
              onPress={async () => {
                await resetWsUrl();
                const url = getWsUrl();
                setWsDraft(url);
                setWsSaved(url);
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
  wsActions: {
    gap: spacing.sm,
  },
  actions: {
    marginTop: 'auto',
    gap: spacing.sm,
  },
});
