import * as Haptics from 'expo-haptics';
import { Audio, AVPlaybackSource } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MUTE_KEY = 'lovepduo.sfx_muted';

const sources = {
  catch: require('../../assets/sfx/catch.wav'),
  perfect: require('../../assets/sfx/perfect.wav'),
  miss: require('../../assets/sfx/miss.wav'),
  decoy: require('../../assets/sfx/decoy.wav'),
  sync: require('../../assets/sfx/sync.wav'),
  warmth: require('../../assets/sfx/warmth.wav'),
  post_match: require('../../assets/sfx/post_match.wav'),
  card: require('../../assets/sfx/card.wav'),
  beat_tick: require('../../assets/sfx/beat_tick.wav'),
  ui_tick: require('../../assets/sfx/ui_tick.wav'),
} as const;

type SfxKey = keyof typeof sources;

let muted = false;
let ready = false;
let hydrated = false;

async function ensureAudio() {
  if (ready) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });
    ready = true;
  } catch {
    // ignore
  }
}

async function play(key: SfxKey, vol = 0.7) {
  if (muted) return;
  try {
    await ensureAudio();
    const { sound } = await Audio.Sound.createAsync(
      sources[key] as AVPlaybackSource,
      { shouldPlay: true, volume: vol },
    );
    sound.setOnPlaybackStatusUpdate((st) => {
      if (!st.isLoaded) return;
      if (st.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  } catch {
    // silent fail — haptics still fire when unmuted
  }
}

function haptic(fn: () => Promise<unknown>) {
  if (muted) return;
  void fn().catch(() => undefined);
}

/** Haptics + procedural WAV juice. */
export const juice = {
  async hydrateMuted() {
    if (hydrated) return muted;
    try {
      const raw = await AsyncStorage.getItem(MUTE_KEY);
      muted = raw === '1';
    } catch {
      // ignore
    }
    hydrated = true;
    return muted;
  },
  isMuted() {
    return muted;
  },
  async setMuted(v: boolean) {
    muted = v;
    try {
      await AsyncStorage.setItem(MUTE_KEY, v ? '1' : '0');
    } catch {
      // ignore
    }
  },
  hit: () => {
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    void play('ui_tick', 0.45);
  },
  perfect: () => {
    haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    void play('perfect');
  },
  miss: () => {
    haptic(() => Haptics.selectionAsync());
    void play('miss', 0.55);
  },
  catch: () => {
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    void play('catch');
  },
  decoy: () => {
    haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
    void play('decoy');
  },
  sync: () => {
    haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    void play('sync');
  },
  beat: () => {
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    void play('beat_tick', 0.4);
  },
  postMatch: () => {
    haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
    void play('post_match');
  },
  warmth: () => {
    haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    void play('warmth', 0.6);
  },
  card: () => {
    haptic(() => Haptics.selectionAsync());
    void play('card', 0.5);
  },
};
