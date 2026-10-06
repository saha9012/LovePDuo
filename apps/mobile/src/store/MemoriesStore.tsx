import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MemoryItem = {
  id: string;
  kind: 'sky' | 'heartbeat' | 'spark' | 'candle' | 'draw' | 'duel' | 'orbit' | 'veil';
  title: string;
  detail: string;
  at: number;
  /** Author user id when received over WS — for local UGC report. */
  fromId?: string;
  /** True until partner receives / we flush on peer_joined */
  pendingSync?: boolean;
};

type MemoriesApi = {
  items: MemoryItem[];
  addMemory: (item: Omit<MemoryItem, 'id' | 'at'>) => MemoryItem;
  receiveMemory: (item: MemoryItem) => void;
  removeMemory: (id: string) => void;
  clearMemories: () => void;
  markMemorySynced: (id: string) => void;
  pendingMemories: () => MemoryItem[];
};

const KEY = 'lovepduo.memories.v1';
const Ctx = createContext<MemoriesApi | null>(null);

let memoryCap = 40;
let markSyncedHook: ((id: string) => void) | null = null;
let dropPendingHook: (() => void) | null = null;

/** Called by PairPremiumBinder when Duo Plus changes the cap. */
export function setMemoryCap(n: number) {
  memoryCap = Math.max(20, Math.min(200, Math.floor(n)));
}

/** Used by broadcastMemory when peer is already in the WS room. */
export function markMemorySyncedExternal(id: string) {
  markSyncedHook?.(id);
}

/** Drop undelivered memories so they never flush into a new invite. */
export function dropAllPendingMemorySyncExternal() {
  dropPendingHook?.();
}

function makeId() {
  return `mem_${Math.random().toString(36).slice(2, 9)}`;
}

export function MemoriesProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as MemoryItem[];
          if (Array.isArray(parsed)) setItems(parsed.slice(0, memoryCap));
        }
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addMemory = useCallback((item: Omit<MemoryItem, 'id' | 'at'>) => {
    const created: MemoryItem = {
      ...item,
      id: makeId(),
      at: Date.now(),
      pendingSync: true,
    };
    setItems((prev) => [created, ...prev].slice(0, memoryCap));
    return created;
  }, []);

  const receiveMemory = useCallback((item: MemoryItem) => {
    if (!item?.id || !item.title) return;
    const clean: MemoryItem = {
      id: item.id,
      kind: item.kind,
      title: item.title,
      detail: item.detail ?? '',
      at: typeof item.at === 'number' ? item.at : Date.now(),
      ...(typeof item.fromId === 'string' ? { fromId: item.fromId } : {}),
    };
    setItems((prev) => {
      if (prev.some((m) => m.id === clean.id)) return prev;
      return [clean, ...prev].slice(0, memoryCap);
    });
  }, []);

  const removeMemory = useCallback((id: string) => {
    setItems((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearMemories = useCallback(() => {
    setItems([]);
  }, []);

  const markMemorySynced = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((m) => (m.id === id && m.pendingSync ? { ...m, pendingSync: false } : m)),
    );
  }, []);

  const dropAllPendingSync = useCallback(() => {
    // Undelivered memories never reached the partner — remove, don't fake synced.
    setItems((prev) => (prev.some((m) => m.pendingSync) ? prev.filter((m) => !m.pendingSync) : prev));
  }, []);

  useEffect(() => {
    markSyncedHook = markMemorySynced;
    dropPendingHook = dropAllPendingSync;
    return () => {
      if (markSyncedHook === markMemorySynced) markSyncedHook = null;
      if (dropPendingHook === dropAllPendingSync) dropPendingHook = null;
    };
  }, [markMemorySynced, dropAllPendingSync]);

  const pendingMemories = useCallback(
    () => items.filter((m) => m.pendingSync),
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      addMemory,
      receiveMemory,
      removeMemory,
      clearMemories,
      markMemorySynced,
      pendingMemories,
    }),
    [
      items,
      addMemory,
      receiveMemory,
      removeMemory,
      clearMemories,
      markMemorySynced,
      pendingMemories,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMemories() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMemories outside provider');
  return ctx;
}
