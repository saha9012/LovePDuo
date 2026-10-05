import { StyleSheet, TextStyle } from 'react-native';
import { colors, fonts } from './tokens';

export const typography = StyleSheet.create({
  brandHero: {
    fontFamily: fonts.display,
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: -1.2,
    color: colors.textPrimary,
  } as TextStyle,
  brandMark: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.4,
    color: colors.textPrimary,
  } as TextStyle,
  headline: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
    color: colors.textPrimary,
  } as TextStyle,
  title: {
    fontFamily: fonts.uiSemi,
    fontSize: 20,
    lineHeight: 26,
    color: colors.textPrimary,
  } as TextStyle,
  body: {
    fontFamily: fonts.ui,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
  } as TextStyle,
  bodyStrong: {
    fontFamily: fonts.uiMedium,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  } as TextStyle,
  caption: {
    fontFamily: fonts.ui,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  } as TextStyle,
  code: {
    fontFamily: fonts.mono,
    fontSize: 28,
    letterSpacing: 8,
    color: colors.accentAmber,
  } as TextStyle,
  tease: {
    fontFamily: fonts.displayItalic,
    fontSize: 22,
    lineHeight: 30,
    color: colors.accentRose,
  } as TextStyle,
});
