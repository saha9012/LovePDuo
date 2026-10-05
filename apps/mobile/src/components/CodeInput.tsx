import React, { useRef } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  Text,
  Pressable,
} from 'react-native';
import { colors, fonts, radii, spacing } from '../theme/tokens';

type Props = {
  value: string;
  onChange: (code: string) => void;
  length?: number;
};

export function CodeInput({ value, onChange, length = 6 }: Props) {
  const inputRef = useRef<TextInput>(null);
  const chars = value.toUpperCase().padEnd(length, ' ').slice(0, length).split('');

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={styles.wrap}>
      <View style={styles.boxes}>
        {chars.map((ch, i) => (
          <View key={i} style={[styles.box, value.length === i && styles.boxActive]}>
            <Text style={styles.char}>{ch.trim()}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) =>
          onChange(t.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, length))
        }
        autoCapitalize="characters"
        autoCorrect={false}
        keyboardType="default"
        maxLength={length}
        style={styles.hidden}
        caretHidden
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  boxes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    aspectRatio: 0.78,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.stroke,
    backgroundColor: 'rgba(36,28,49,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    borderColor: colors.accentAmber,
  },
  char: {
    fontFamily: fonts.mono,
    fontSize: 24,
    color: colors.textPrimary,
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
});
