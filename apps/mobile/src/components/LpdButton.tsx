import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, fonts, radii, spacing } from '../theme/tokens';

type Variant = 'primary' | 'ghost' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function LpdButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: Props) {
  const handlePress = () => {
    if (disabled || loading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        (disabled || loading) && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.textPrimary} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'ghost' && styles.ghostLabel,
            variant === 'danger' && styles.dangerLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.accentWine,
    borderWidth: 1,
    borderColor: 'rgba(226,176,122,0.35)',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  danger: {
    backgroundColor: 'rgba(199,91,91,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(199,91,91,0.45)',
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.92,
  },
  label: {
    fontFamily: fonts.uiSemi,
    fontSize: 16,
    color: colors.textPrimary,
  },
  ghostLabel: {
    color: colors.accentAmber,
  },
  dangerLabel: {
    color: colors.danger,
  },
});
