import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';

type Props = {
  name: 'home' | 'play' | 'music' | 'together' | 'profile';
  focused: boolean;
};

const glyphs: Record<Props['name'], string> = {
  home: '◇',
  play: '✦',
  music: '♪',
  together: '✶',
  profile: '◎',
};

export function TabGlyph({ name, focused }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.glyph, focused && styles.glyphActive]}>{glyphs[name]}</Text>
      {focused ? <View style={styles.ember} /> : <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 28,
  },
  glyph: {
    fontFamily: fonts.uiSemi,
    fontSize: 16,
    color: colors.textMuted,
    lineHeight: 20,
  },
  glyphActive: {
    color: colors.accentAmber,
  },
  ember: {
    marginTop: 3,
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accentRose,
  },
  spacer: {
    marginTop: 3,
    height: 2,
  },
});
