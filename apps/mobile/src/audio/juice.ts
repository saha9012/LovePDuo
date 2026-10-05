import * as Haptics from 'expo-haptics';

/** Haptic-first juice layer until wav packs land in assets/audio. */
export const juice = {
  hit: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  perfect: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  miss: () => Haptics.selectionAsync(),
  catch: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  decoy: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  sync: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  beat: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  postMatch: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warmth: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  card: () => Haptics.selectionAsync(),
};
