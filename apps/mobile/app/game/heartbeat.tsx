import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LpdBackground } from '../../src/components/LpdBackground';
import { PostMatchCard } from '../../src/components/PostMatchCard';
import { colors, fonts, spacing } from '../../src/theme/tokens';
import {
  buildHeartbeatChart,
  heartbeatConfig,
  judgeTap,
  judgementScore,
  BeatJudgement,
} from '../../src/games/heartbeat';
import { pickPostMatchLine } from '../../src/content/postMatch';

type Phase = 'ready' | 'playing' | 'finished';

export default function HeartbeatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const chart = useMemo(() => buildHeartbeatChart(3), []);
  const [phase, setPhase] = useState<Phase>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState(0);
  const [syncBonus, setSyncBonus] = useState(0);
  const [last, setLast] = useState<BeatJudgement | null>(null);
  const [partnerScore, setPartnerScore] = useState(0);
  const startAt = useRef(0);
  const cursor = useRef(0);
  const scoreRef = useRef(0);
  const syncRef = useRef(0);

  const start = () => {
    setPhase('playing');
    setElapsed(0);
    setScore(0);
    setSyncBonus(0);
    setLast(null);
    cursor.current = 0;
    scoreRef.current = 0;
    syncRef.current = 0;
    startAt.current = Date.now();
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setInterval(() => {
      const t = Date.now() - startAt.current;
      setElapsed(t);
      while (
        cursor.current < chart.length &&
        chart[cursor.current].atMs < t - heartbeatConfig.windowGreatMs
      ) {
        // missed note
        cursor.current += 1;
        setLast('miss');
      }
      if (t >= heartbeatConfig.durationMs) {
        clearInterval(id);
        const partner = Math.max(
          0,
          Math.round((scoreRef.current + syncRef.current) * (0.8 + Math.random() * 0.35)),
        );
        setPartnerScore(partner);
        setPhase('finished');
      }
    }, 32);
    return () => clearInterval(id);
  }, [phase, chart]);

  const onTap = () => {
    if (phase !== 'playing') return;
    const t = Date.now() - startAt.current;
    const note = chart[cursor.current];
    if (!note) return;
    const delta = t - note.atMs;
    if (Math.abs(delta) > heartbeatConfig.windowGreatMs + 40) {
      setLast('miss');
      void Haptics.selectionAsync();
      return;
    }
    const j = judgeTap(delta);
    const pts = judgementScore(j);
    scoreRef.current += pts;
    setScore(scoreRef.current);
    setLast(j);
    cursor.current += 1;
    // simulated partner sync window
    if (j !== 'miss' && Math.abs(delta) < 90 && Math.random() > 0.35) {
      syncRef.current += 40;
      setSyncBonus(syncRef.current);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const total = score + syncBonus;
  const line = pickPostMatchLine(total, partnerScore, elapsed || 1);
  const beatPulse = Math.sin((elapsed / (60000 / heartbeatConfig.bpm)) * Math.PI * 2);

  if (phase === 'finished') {
    return (
      <LpdBackground mood="warm">
        <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
          <Text style={styles.title}>Heartbeat Tap</Text>
          <Text style={styles.meta}>
            Ты {total} · Партнёр {partnerScore} · sync +{syncBonus}
          </Text>
          <PostMatchCard
            title={total >= partnerScore ? 'Ритм твой' : 'Партнёр чувствует лучше'}
            line={line.text}
            onRematch={start}
            onHome={() => router.replace('/(tabs)/play')}
          />
        </View>
      </LpdBackground>
    );
  }

  return (
    <LpdBackground mood="rain">
      <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.title}>Heartbeat Tap</Text>
        {phase === 'ready' ? (
          <View style={styles.ready}>
            <Text style={styles.readyTitle}>Чувствуй бит вдвоём</Text>
            <Text style={styles.body}>
              Тапай в ритм. Perfect / Great / Miss. Sync bonus, если почти одновременно.
            </Text>
            <Pressable onPress={start} style={styles.btn}>
              <Text style={styles.btnLabel}>Старт</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.hud}>
              <Text style={styles.stat}>Очки {score}</Text>
              <Text style={styles.stat}>Sync +{syncBonus}</Text>
              <Text style={styles.stat}>
                {Math.max(0, Math.ceil((heartbeatConfig.durationMs - elapsed) / 1000))}s
              </Text>
            </View>
            <View style={styles.stage}>
              <View
                style={[
                  styles.ring,
                  {
                    transform: [{ scale: 1 + beatPulse * 0.08 }],
                    borderColor:
                      last === 'perfect'
                        ? colors.success
                        : last === 'great'
                          ? colors.accentAmber
                          : last === 'miss'
                            ? colors.danger
                            : colors.accentRose,
                  },
                ]}
              />
              <Text style={styles.judgement}>{last?.toUpperCase() ?? 'TAP'}</Text>
            </View>
            <Pressable onPress={onTap} style={styles.pad}>
              <Text style={styles.padLabel}>TAP</Text>
            </Pressable>
          </>
        )}
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
  title: {
    fontFamily: fonts.uiSemi,
    color: colors.textPrimary,
    fontSize: 18,
  },
  ready: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.md,
  },
  readyTitle: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.textPrimary,
  },
  body: {
    fontFamily: fonts.ui,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  btn: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: colors.accentWine,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.35)',
  },
  btnLabel: {
    fontFamily: fonts.uiSemi,
    color: colors.textPrimary,
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    fontFamily: fonts.uiMedium,
    color: colors.textSecondary,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
  },
  judgement: {
    position: 'absolute',
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.textPrimary,
  },
  pad: {
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: 'rgba(227,154,160,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(227,154,160,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  padLabel: {
    fontFamily: fonts.uiSemi,
    letterSpacing: 3,
    color: colors.accentRose,
    fontSize: 18,
  },
  meta: {
    fontFamily: fonts.ui,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
});
