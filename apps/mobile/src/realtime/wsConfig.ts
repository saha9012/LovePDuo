import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'lovepduo.ws_url';
const DEFAULT = process.env.EXPO_PUBLIC_LPD_WS_URL ?? 'ws://127.0.0.1:8787';

let override: string | null = null;
const listeners = new Set<(url: string) => void>();

export function getWsUrl() {
  return override ?? DEFAULT;
}

export async function hydrateWsUrl() {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved) override = saved;
  } catch {
    // ignore
  }
  return getWsUrl();
}

export async function setWsUrl(url: string) {
  const clean = url.trim() || DEFAULT;
  override = clean;
  await AsyncStorage.setItem(KEY, clean);
  listeners.forEach((l) => l(clean));
}

export async function resetWsUrl() {
  override = null;
  await AsyncStorage.removeItem(KEY);
  listeners.forEach((l) => l(getWsUrl()));
}

export function onWsUrlChange(fn: (url: string) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
