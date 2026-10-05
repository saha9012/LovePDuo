type EventName =
  | 'session_start'
  | 'pair_created'
  | 'pair_joined'
  | 'game_started'
  | 'game_finished'
  | 'track_uploaded'
  | 'warmth_sent'
  | 'note_sent';

type Payload = Record<string, string | number | boolean | undefined>;

/** Lightweight analytics sink — console in MVP, swap for Firebase later. */
export function track(event: EventName, payload: Payload = {}) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[LPD analytics]', event, payload);
  }
}
