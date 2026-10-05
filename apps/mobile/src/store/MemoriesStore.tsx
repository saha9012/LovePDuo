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
  kind: 'sky' | 'heartbeat' | 'spark' | 'candle';
  title: string;
  detail: string;
  at: number;
};

type MemoriesApi = {
  items: MemoryItem[];
  addMemory: (item: Omit<MemoryItem, 'id' | 'at'>) => void;
  clearMemories: () => void;
};

const KEY = 'lovepduo.memories.v1';
const Ctx = createContext<MemoriesApi | null>(null);

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
    setItems((prev) =>
      [
        {
          ...item,
          id: `mem_${Math.random().toString(36).slice(2, 9)}`,
          at: Date.now(),
        },
        ...prev,
      ].slice(0, 40),
    );
  }, []);

  const clearMemories = useCallback(() => {
    setItems([]);
  }, []);

  const value = useMemo(
    () => ({ items, addMemory, clearMemories }),
    [items, addMemory, clearMemories],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMemories() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMemories outside provider');
  return ctx;
}
