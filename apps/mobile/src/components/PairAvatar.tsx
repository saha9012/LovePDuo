import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radii, spacing } from '../theme/tokens';

type Presence = 'online' | 'away' | 'offline';

type Props = {
  name: string;
  presence?: Presence;
  size?: number;
};

const presenceColor: Record<Presence, string> = {
  online: colors.success,
  away: colors.warning,
  offline: colors.textMuted,
};

export function PairAvatar({ name, presence = 'offline', size = 52 }: Props) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initials, { fontSize: size * 0.34 }]}>{initials || 'L'}</Text>
      <View
        style={[
          styles.dot,
          {
            backgroundColor: presenceColor[presence],
            borderColor: colors.bg1,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: fonts.uiSemi,
    color: colors.accentRose,
  },
  dot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
});
