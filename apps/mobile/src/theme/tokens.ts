export const colors = {
  bg0: '#07060A',
  bg1: '#121018',
  bg2: '#1B1524',
  bgElevated: '#241C31',
  stroke: 'rgba(255,214,186,0.12)',
  textPrimary: '#F7EDE3',
  textSecondary: '#C9B6A8',
  textMuted: '#8E7B72',
  accentRose: '#E39AA0',
  accentAmber: '#E2B07A',
  accentWine: '#8E3B4A',
  accentMist: '#7A8CA3',
  success: '#6FAE8F',
  danger: '#C75B5B',
  warning: '#D2A35C',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
} as const;

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_600SemiBold_Italic',
  ui: 'Sora_400Regular',
  uiMedium: 'Sora_500Medium',
  uiSemi: 'Sora_600SemiBold',
  mono: 'IBMPlexMono_500Medium',
} as const;

export const motion = {
  veil: 420,
  breath: 4200,
  pairReveal: 900,
  juice: 180,
} as const;
