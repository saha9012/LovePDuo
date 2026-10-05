import { useEffect } from 'react';
import { useApp } from '../store/AppStore';
import { pairRealtime } from './PairRealtime';

/** Держит WS-сессию пары на всём приложении (не рвём при уходе с Home). */
export function RealtimeConnector() {
  const { user, pair, sendWarmth, setPartnerInfo, setRoomSize } = useApp();

  useEffect(() => {
    if (!user || !pair) return;
    pairRealtime.connect(pair.code, user.id, user.displayName);
    const off = pairRealtime.onMessage((msg) => {
      if (typeof msg.size === 'number') {
        setRoomSize(msg.size);
      }
      if (msg.type === 'warmth') {
        sendWarmth();
      }
      if (msg.type === 'joined') {
        const peers = msg.peers as { userId?: string; name?: string }[] | undefined;
        const peer = peers?.find((p) => p.userId && p.userId !== user.id && p.name);
        if (peer?.name) {
          setPartnerInfo(peer.name, 'online');
          sendWarmth();
        }
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
  }, [
    user?.id,
    pair?.code,
    pair?.partnerName,
    sendWarmth,
    setPartnerInfo,
    setRoomSize,
    user?.displayName,
  ]);

  return null;
}
