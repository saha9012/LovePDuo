import { Platform, Share } from 'react-native';

/** Copy text; falls back to Share sheet if clipboard unavailable. */
export async function copyText(text: string, shareTitle = 'LovePDuo') {
  const clean = text.trim();
  if (!clean) return false;

  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(clean);
      return true;
    }
  } catch {
    // fall through
  }

  try {
    await Share.share({ message: clean, title: shareTitle });
    return true;
  } catch {
    return false;
  }
}

export function pairInviteMessage(code: string) {
  return `LovePDuo код: ${code}\nlovepduo://join/${code}`;
}
