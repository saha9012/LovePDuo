import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { LpdButton } from '../../src/components/LpdButton';
import { colors, fonts, radii, spacing } from '../../src/theme/tokens';
import { typography } from '../../src/theme/typography';
import { useApp } from '../../src/store/AppStore';
import { juice } from '../../src/audio/juice';
import { copyText, pairInviteMessage } from '../../src/utils/copyText';

export default function PairSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pair } = useApp();
  const scale = useSharedValue(0.86);
  const opacity = useSharedValue(0);
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);
  const [copied, setCopied] = useState(false);
  const [peerToast, setPeerToast] = useState<string | null>(null);
  const seenPeer = useRef(false);
  const code = pair?.code ?? '------';
  const deepLink = `lovepduo://join/${code}`;
  const daysTogether = pair?.pairedAt
    ? Math.max(1, Math.floor((Date.now() - pair.pairedAt) / 86_400_000) + 1)
    : 1;

  useEffect(() => {
    void juice.postMatch();
    opacity.value = withTiming(1, { duration: 700 });
    scale.value = withSequence(
      withTiming(1.06, { duration: 560, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 320 }),
    );
    spin.value = withRepeat(
      withTiming(1, { duration: 5000, easing: Easing.linear }),
      -1,
      false,
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    // Web: quiet clipboard. Native: keep manual button (Share sheet is too loud auto).
    if (Platform.OS !== 'web') return;
    const t = setTimeout(() => {
      void copyText(pairInviteMessage(code)).then((ok) => {
        if (ok) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2200);
        }
      });
    }, 900);
    return () => clearTimeout(t);
  }, [opacity, scale, spin, pulse, code]);

  useEffect(() => {
    const size = pair?.roomSize ?? 0;
    if (size >= 2 && !seenPeer.current) {
      seenPeer.current = true;
      setPeerToast(`${pair?.partnerName ?? 'Партнёр'} в WS`);
      void juice.sync();
      const t = setTimeout(() => setPeerToast(null), 2000);
      return () => clearTimeout(t);
    }
  }, [pair?.roomSize, pair?.partnerName]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${spin.value * 360}deg` },
      { scale: 1 + pulse.value * 0.04 },
    ],
    opacity: interpolate(pulse.value, [0, 1], [0.55, 0.95]),
  }));

  const shareCode = async () => {
    const ok = await copyText(pairInviteMessage(code));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      void juice.warmth();
    }
  };

  return (
    <LpdBackground mood="warm">
      <View style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <Animated.View style={[styles.center, style]}>
          <View style={styles.stage}>
            <Animated.View style={[styles.ring, ringStyle]} />
            <View style={[styles.orb, styles.orbAmber]} />
            <View style={[styles.orb, styles.orbRose]} />
          </View>
          <Text style={styles.kicker}>Pair link</Text>
          <Text style={styles.title}>Вы связаны</Text>
          <Text style={typography.tease}>
            Два телефона. Одна пара{pair?.name ? ` «${pair.name}»` : ''} по коду — не «комната».
            Online ниже = кто сейчас в WS.
          </Text>
          {peerToast ? <Text style={styles.peerToast}>{peerToast}</Text> : null}
          <View style={styles.statStrip}>
            {(
              [
                ['c', code.slice(0, 4), 'код'],
                [
                  'o',
                  typeof pair?.roomSize === 'number' ? `${pair.roomSize}/2` : '—',
                  'WS',
                ],
                [
                  'p',
                  typeof pair?.roomSize === 'number' && pair.roomSize >= 2
                    ? 'on'
                    : pair?.partnerPresence === 'online'
                      ? '≠'
                      : 'off',
                  'партнёр',
                ],
                ['g', String(pair?.gamesStarted ?? 0), 'стартов'],
                ['d', String(daysTogether), 'дней'],
              ] as const
            ).map(([k, n, l]) => (
              <View key={k} style={styles.statCell}>
                <Text style={styles.statNum}>{n}</Text>
                <Text style={styles.statLabel}>{l}</Text>
              </View>
            ))}
          </View>
          <View style={styles.codeBlock}>
            <Text style={styles.codeLabel}>Код пары (identity)</Text>
            <Text style={typography.code}>{code}</Text>
          </View>
          <Text style={styles.hint}>
            Пара = код {code}. WS online — отдельно. Deep link: {deepLink}
          </Text>
        </Animated.View>
        <View style={styles.actions}>
          <LpdButton
            label={copied ? 'Скопировано' : 'Скопировать / поделиться кодом'}
            variant="ghost"
            onPress={() => void shareCode()}
          />
          <LpdButton
            label="В пару"
            onPress={() => {
              void juice.warmth();
              router.replace('/(tabs)/home');
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
    justifyContent: 'space-between',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  stage: {
    height: 120,
    marginBottom: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
    borderColor: 'rgba(226,176,122,0.55)',
  },
  orb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  orbAmber: {
    left: '32%',
    backgroundColor: colors.accentAmber,
    shadowColor: colors.accentAmber,
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  orbRose: {
    right: '32%',
    backgroundColor: colors.accentRose,
    shadowColor: colors.accentRose,
    shadowOpacity: 0.9,
    shadowRadius: 10,
  },
  kicker: {
    fontFamily: fonts.uiMedium,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.accentAmber,
    fontSize: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 48,
    color: colors.textPrimary,
  },
  peerToast: {
    marginTop: spacing.sm,
    fontFamily: fonts.uiSemi,
    fontSize: 15,
    color: colors.accentRose,
  },
  statStrip: {
    marginTop: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statCell: {
    minWidth: 52,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(232,196,122,0.28)',
    backgroundColor: 'rgba(36,28,49,0.4)',
    alignItems: 'center',
  },
  statNum: {
    fontFamily: fonts.uiSemi,
    fontSize: 13,
    color: colors.accentAmber,
  },
  statLabel: {
    fontFamily: fonts.ui,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  codeBlock: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  codeLabel: {
    fontFamily: fonts.ui,
    color: colors.textMuted,
    fontSize: 13,
  },
  hint: {
    marginTop: spacing.lg,
    fontFamily: fonts.ui,
    color: colors.textSecondary,
    lineHeight: 20,
    fontSize: 14,
  },
  actions: {
    gap: spacing.sm,
  },
});
