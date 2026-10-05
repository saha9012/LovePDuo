import { useEffect } from 'react';
import { useApp } from '../store/AppStore';
import { pairRealtime } from './PairRealtime';

/** Держит WS-сессию пары на всём приложении (не рвём при уходе с Home). */
export function RealtimeConnector() {
  const { user, pair, sendWarmth, setPartnerInfo } = useApp();

  useEffect(() => {
    if (!user || !pair) return;
    pairRealtime.connect(pair.code, user.id, user.displayName);
    const off = pairRealtime.onMessage((msg) => {
      if (msg.type === 'warmth') {
        sendWarmth();
      }
      if (msg.type === 'peer_joined') {
        sendWarmth();
        if (typeof msg.name === 'string' && msg.name) {
          setPartnerInfo(msg.name, 'online');
        }
      }
      if (msg.type === 'peer_left') {
        setPartnerInfo(pair.partnerName || 'Партнёр', 'away');
      }
    });
    return () => {
      off();
    };
  }, [user?.id, pair?.code, pair?.partnerName, sendWarmth, setPartnerInfo, user?.displayName]);

  return null;
}
