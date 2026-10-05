import { useEffect } from 'react';
import { useApp } from '../store/AppStore';
import { useMemories, MemoryItem } from '../store/MemoriesStore';
import { pairRealtime } from './PairRealtime';
import { juice } from '../audio/juice';

const PING_MS = 18000;

/** Держит WS-сессию пары на всём приложении (не рвём при уходе с Home). */
export function RealtimeConnector() {
  const { user, pair, sendWarmth, setPartnerInfo, setRoomSize, setPairName } = useApp();
  const { receiveMemory, removeMemory, clearMemories } = useMemories();

  useEffect(() => {
    void juice.hydrateMuted();
  }, []);

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
      if (msg.type === 'presence') {
        if (msg.from && msg.from !== user.id) {
          const status = msg.status === 'away' ? 'away' : 'online';
          const name =
            typeof msg.name === 'string' && msg.name
              ? msg.name
              : pair.partnerName || 'Партнёр';
          setPartnerInfo(name, status);
        }
      }
      if (msg.type === 'game' && msg.gameId === 'room-name') {
        const payload = msg.payload as { name?: string } | undefined;
        if (typeof payload?.name === 'string' && payload.name.trim()) {
          const next = payload.name.trim();
          const both = pair.name === next;
          if (!both) setPairName(next);
          void (both ? juice.perfect() : juice.card());
        }
      }
      if (msg.type === 'game' && msg.gameId === 'display-name') {
        const payload = msg.payload as { name?: string; fromId?: string } | undefined;
        if (
          payload?.fromId &&
          payload.fromId !== user.id &&
          typeof payload.name === 'string' &&
          payload.name.trim()
        ) {
          setPartnerInfo(payload.name.trim(), 'online');
          void juice.card();
        }
      }
      if (msg.type === 'game' && msg.gameId === 'memory-add') {
        const payload = msg.payload as (MemoryItem & { fromId?: string }) | undefined;
        if (payload?.id && payload.fromId !== user.id && payload.title) {
          receiveMemory({
            id: payload.id,
            kind: payload.kind,
            title: payload.title,
            detail: payload.detail ?? '',
            at: typeof payload.at === 'number' ? payload.at : Date.now(),
          });
        }
      }
      if (msg.type === 'game' && msg.gameId === 'memory-remove') {
        const payload = msg.payload as { id?: string; fromId?: string } | undefined;
        if (payload?.id && payload.fromId !== user.id) {
          removeMemory(payload.id);
        }
      }
      if (msg.type === 'game' && msg.gameId === 'memory-clear') {
        const payload = msg.payload as { fromId?: string } | undefined;
        if (payload?.fromId !== user.id) {
          clearMemories();
        }
      }
      if (msg.type === 'joined') {
        const peers = msg.peers as { userId?: string; name?: string }[] | undefined;
        const peer = peers?.find((p) => p.userId && p.userId !== user.id && p.name);
        if (peer?.name) {
          setPartnerInfo(peer.name, 'online');
        }
      }
      if (msg.type === 'peer_joined') {
        void juice.sync();
        if (typeof msg.name === 'string' && msg.name) {
          setPartnerInfo(msg.name, 'online');
        }
      }
      if (msg.type === 'peer_left') {
        setPartnerInfo(pair.partnerName || 'Партнёр', 'away');
        void juice.miss();
      }
    });

    const ping = setInterval(() => {
      pairRealtime.send({
        type: 'presence',
        status: 'online',
        name: user.displayName,
      });
    }, PING_MS);
    pairRealtime.send({
      type: 'presence',
      status: 'online',
      name: user.displayName,
    });

    return () => {
      off();
      clearInterval(ping);
    };
  }, [
    user?.id,
    pair?.code,
    pair?.partnerName,
    sendWarmth,
    setPartnerInfo,
    setRoomSize,
    setPairName,
    user?.displayName,
    receiveMemory,
    removeMemory,
    clearMemories,
  ]);

  return null;
}
