import React, { useRef } from 'react';
import {
  Platform,
  StyleSheet,
  TextInput,
  View,
  Text,
  Pressable,
} from 'react-native';
import { colors, fonts, radii, spacing } from '../theme/tokens';
import { juice } from '../audio/juice';

type Props = {
  value: string;
  onChange: (code: string) => void;
  length?: number;
};

function sanitize(raw: string, length: number) {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, length);
}

export function CodeInput({ value, onChange, length = 6 }: Props) {
  const inputRef = useRef<TextInput>(null);
  const chars = value.toUpperCase().padEnd(length, ' ').slice(0, length).split('');

  const pasteFromClipboard = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        const clean = sanitize(text, length);
        if (clean) {
          onChange(clean);
          void juice.hit();
        }
      } else {
        inputRef.current?.focus();
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      onLongPress={() => void pasteFromClipboard()}
      style={styles.wrap}
    >
      <View style={styles.boxes}>
        {chars.map((ch, i) => (
          <View key={i} style={[styles.box, value.length === i && styles.boxActive]}>
            <Text style={styles.char}>{ch.trim()}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.hint}>Вставь код · long-press на web вставит из буфера</Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(sanitize(t, length))}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
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
    gap: spacing.sm,
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
  hint: {
    fontFamily: fonts.ui,
    fontSize: 11,
    color: colors.textMuted,
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
});
