import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

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
};

const Ctx = createContext<MemoriesApi | null>(null);

export function MemoriesProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<MemoryItem[]>([]);

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

  const value = useMemo(() => ({ items, addMemory }), [items, addMemory]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMemories() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMemories outside provider');
  return ctx;
}
