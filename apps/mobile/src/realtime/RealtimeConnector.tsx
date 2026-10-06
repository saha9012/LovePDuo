import { useEffect } from 'react';
import { useApp, TinyNote } from '../store/AppStore';
import { useMemories, MemoryItem } from '../store/MemoriesStore';
import { usePremium } from '../store/PremiumStore';
import { pairRealtime } from './PairRealtime';
import { setMatchSession } from './matchSession';
import { setLastRoomSize } from './pairPresence';
import { flushWarmthOutbox } from './warmthOutbox';
import { flushMusicOutbox } from './musicOutbox';
import { juice } from '../audio/juice';

const PING_MS = 18000;

function flushNoteOutbox(
  pendingNotes: () => TinyNote[],
  markNoteSynced: (id: string) => void,
) {
  const outbox = pendingNotes();
  for (const n of outbox) {
    const { pendingSync: _p, ...payload } = n;
    pairRealtime.sendGame('tiny-note', payload);
    markNoteSynced(n.id);
  }
  return outbox.length;
}

function flushMemoryOutbox(
  pendingMemories: () => MemoryItem[],
  markMemorySynced: (id: string) => void,
  from?: { displayName?: string; id?: string },
) {
  const outbox = pendingMemories();
  for (const m of outbox) {
    const { pendingSync: _p, ...payload } = m;
    pairRealtime.sendGame('memory-add', {
      ...payload,
      from: from?.displayName,
      fromId: from?.id,
    });
    markMemorySynced(m.id);
  }
  return outbox.length;
}

/** Держит WS-сессию пары на всём приложении (не рвём при уходе с Home). */
export function RealtimeConnector() {
  const {
    user,
    pair,
    sendWarmth,
    setPartnerInfo,
    setHostUserId,
    setRoomSize,
    setPairName,
    receiveNote,
    removeNote,
    pendingNotes,
    markNoteSynced,
  } = useApp();
  const {
    receiveMemory,
    removeMemory,
    clearMemories,
    pendingMemories,
    markMemorySynced,
  } = useMemories();
  const { isPlus, trialEndsAt, applyPeerEntitlement } = usePremium();

  useEffect(() => {
    void juice.hydrateMuted();
  }, []);

  useEffect(() => {
    if (!user || !pair) return;

    const announceHost = () => {
      if (pair.hostUserId && pair.hostUserId === user.id) {
        pairRealtime.sendGame('pair-meta', {
          hostUserId: user.id,
          pairName: pair.name,
          fromId: user.id,
        });
      }
    };

    const announcePlus = () => {
      if (!isPlus) return;
      pairRealtime.sendGame('duo-plus', {
        tier: trialEndsAt && trialEndsAt > Date.now() ? 'free' : 'duo_plus',
        trialEndsAt: trialEndsAt && trialEndsAt > Date.now() ? trialEndsAt : null,
        fromId: user.id,
      });
    };

    const flushAll = () => {
      announceHost();
      announcePlus();
      flushNoteOutbox(pendingNotes, markNoteSynced);
      flushMemoryOutbox(pendingMemories, markMemorySynced, {
        displayName: user.displayName,
        id: user.id,
      });
      flushWarmthOutbox();
      flushMusicOutbox();
    };

    pairRealtime.connect(pair.code, user.id, user.displayName);
    announceHost();
    announcePlus();

    const off = pairRealtime.onMessage((msg) => {
      if (typeof msg.size === 'number') {
        setLastRoomSize(msg.size);
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
      if (msg.type === 'game' && msg.gameId === 'duo-plus') {
        const payload = msg.payload as {
          tier?: 'free' | 'duo_plus';
          trialEndsAt?: number | null;
          cleared?: boolean;
          fromId?: string;
        } | undefined;
        if (payload?.fromId === user.id) return;
        applyPeerEntitlement({
          tier: payload?.tier,
          trialEndsAt: payload?.trialEndsAt,
          cleared: payload?.cleared,
        });
        void juice.card();
      }
      if (msg.type === 'game' && msg.gameId === 'pair-meta') {
        const payload = msg.payload as {
          hostUserId?: string;
          pairName?: string;
          fromId?: string;
        } | undefined;
        if (payload?.fromId === user.id) return;
        if (
          typeof payload?.hostUserId === 'string' &&
          payload.hostUserId &&
          payload.hostUserId !== user.id
        ) {
          setHostUserId(payload.hostUserId);
        }
        if (typeof payload?.pairName === 'string' && payload.pairName.trim()) {
          if (pair.name !== payload.pairName.trim()) {
            setPairName(payload.pairName.trim());
          }
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
      if (msg.type === 'game' && msg.gameId === 'tiny-note') {
        const payload = msg.payload as TinyNote | undefined;
        if (payload?.id && payload.text) {
          receiveNote(payload);
        }
      }
      if (msg.type === 'game' && msg.gameId === 'tiny-note-remove') {
        const payload = msg.payload as { id?: string; fromId?: string } | undefined;
        if (payload?.id && payload.fromId !== user.id) {
          removeNote(payload.id);
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
        flushAll();
      }
      if (msg.type === 'pair_sync') {
        const payload = msg as {
          pairName?: string | null;
          lastMatch?: {
            gameId?: string;
            seed?: number;
            startAtMs?: number;
          } | null;
        };
        if (typeof payload.pairName === 'string' && payload.pairName.trim()) {
          if (pair.name !== payload.pairName.trim()) {
            setPairName(payload.pairName.trim());
          }
        }
        const lm = payload.lastMatch;
        if (
          lm &&
          typeof lm.gameId === 'string' &&
          typeof lm.seed === 'number' &&
          typeof lm.startAtMs === 'number' &&
          Date.now() - lm.startAtMs < 12 * 60_000
        ) {
          setMatchSession({
            gameId: lm.gameId,
            seed: lm.seed,
            startAtMs: lm.startAtMs,
            pairCode: pair.code,
            pairId: pair.id,
          });
        }
      }
      if (msg.type === 'peer_joined') {
        void juice.sync();
        if (typeof msg.name === 'string' && msg.name) {
          setPartnerInfo(msg.name, 'online');
        }
        flushAll();
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
    pair?.hostUserId,
    pair?.name,
    pair?.id,
    sendWarmth,
    setPartnerInfo,
    setHostUserId,
    setRoomSize,
    setPairName,
    user?.displayName,
    receiveNote,
    removeNote,
    receiveMemory,
    removeMemory,
    clearMemories,
    pendingNotes,
    markNoteSynced,
    pendingMemories,
    markMemorySynced,
    isPlus,
    trialEndsAt,
    applyPeerEntitlement,
  ]);

  return null;
}
