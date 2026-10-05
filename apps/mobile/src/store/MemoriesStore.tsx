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
};

type MemoriesApi = {
  items: MemoryItem[];
  addMemory: (item: Omit<MemoryItem, 'id' | 'at'>) => MemoryItem;
  receiveMemory: (item: MemoryItem) => void;
  removeMemory: (id: string) => void;
  clearMemories: () => void;
};

const KEY = 'lovepduo.memories.v1';
const Ctx = createContext<MemoriesApi | null>(null);

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
          if (Array.isArray(parsed)) setItems(parsed.slice(0, 40));
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
    };
    setItems((prev) => [created, ...prev].slice(0, 40));
    return created;
  }, []);

  const receiveMemory = useCallback((item: MemoryItem) => {
    if (!item?.id || !item.title) return;
    setItems((prev) => {
      if (prev.some((m) => m.id === item.id)) return prev;
      return [item, ...prev].slice(0, 40);
    });
  }, []);

  const removeMemory = useCallback((id: string) => {
    setItems((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearMemories = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo(
    () => ({ items, addMemory, receiveMemory, removeMemory, clearMemories }),
    [items, addMemory, receiveMemory, removeMemory, clearMemories],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMemories() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMemories outside provider');
  return ctx;
}
