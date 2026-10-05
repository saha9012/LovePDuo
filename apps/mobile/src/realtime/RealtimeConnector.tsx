import { useEffect } from 'react';
import { useApp } from '../store/AppStore';
import { pairRealtime } from './PairRealtime';

/** Держит WS-сессию пары на всём приложении (не рвём при уходе с Home). */
export function RealtimeConnector() {
  const { user, pair, sendWarmth } = useApp();

  useEffect(() => {
    if (!user || !pair) return;
    pairRealtime.connect(pair.code, user.id, user.displayName);
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'warmth' || msg.type === 'peer_joined') {
        sendWarmth();
      }
    });
    return () => {
      off();
    };
  }, [user?.id, pair?.code, sendWarmth]);

  return null;
}
