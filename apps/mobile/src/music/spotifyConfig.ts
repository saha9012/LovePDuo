/** Spotify OAuth — keys via env; never hardcode secrets. */
export function spotifyConfigured() {
  const id = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID?.trim();
  const redirect = process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI?.trim();
  return Boolean(id && redirect);
}

export function spotifyStatusLabel() {
  if (spotifyConfigured()) {
    return 'Spotify keys найдены — OAuth flow можно подключать.';
  }
  return 'Spotify OAuth: задай EXPO_PUBLIC_SPOTIFY_CLIENT_ID + REDIRECT_URI в .env';
}
