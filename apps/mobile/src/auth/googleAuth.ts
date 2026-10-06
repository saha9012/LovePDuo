/**
 * Google Sign-In scaffolding.
 * Real OAuth needs EXPO_PUBLIC_GOOGLE_CLIENT_ID (+ platform client setup).
 * Until then we keep local profiles and surface an honest status.
 */

export function googleClientId(): string | undefined {
  const id = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim();
  return id || undefined;
}

export function googleConfigured(): boolean {
  return Boolean(googleClientId());
}

export function googleStatusLabel(): string {
  if (googleConfigured()) {
    return 'Google keys найдены — OAuth flow можно подключать (expo-auth-session).';
  }
  return 'Google Sign-In: задай EXPO_PUBLIC_GOOGLE_CLIENT_ID в .env';
}

export type GoogleProfile = {
  displayName: string;
  email?: string;
  idToken?: string;
};

/**
 * Placeholder until AuthSession + Google provider are wired.
 * Returns null so UI falls back to local name entry — never fakes a Google account.
 */
export async function signInWithGoogle(): Promise<GoogleProfile | null> {
  if (!googleConfigured()) return null;
  // Keys present but SDK path not shipped yet — caller shows status, no fake login.
  return null;
}
