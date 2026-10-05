import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '../theme/tokens';

export type TabKey = 'home' | 'play' | 'music' | 'together' | 'profile';

type Props = {
  active: TabKey;
  onChange: (tab: TabKey) => void;
};

const tabs: { key: TabKey; label: string; glyph: string }[] = [
  { key: 'home', label: 'Дом', glyph: '◇' },
  { key: 'play', label: 'Игры', glyph: '✦' },
  { key: 'music', label: 'Музыка', glyph: '♪' },
  { key: 'together', label: 'Вместе', glyph: '✶' },
  { key: 'profile', label: 'Пара', glyph: '◎' },
];

export function BottomNav({ active, onChange }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={styles.item}
          >
            <Text style={[styles.glyph, isActive && styles.glyphActive]}>
              {tab.glyph}
            </Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
            {isActive ? <View style={styles.ember} /> : <View style={styles.emberSpacer} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.stroke,
    backgroundColor: 'rgba(7,6,10,0.92)',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  glyph: {
    fontSize: 16,
    color: colors.textMuted,
  },
  glyphActive: {
    color: colors.accentAmber,
  },
  label: {
    fontFamily: fonts.uiMedium,
    fontSize: 11,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.textPrimary,
  },
  ember: {
    marginTop: 4,
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accentRose,
  },
  emberSpacer: {
    marginTop: 4,
    height: 2,
  },
});
