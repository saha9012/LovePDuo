import { useEffect } from 'react';
import { useApp } from './AppStore';
import { usePremium } from './PremiumStore';
import { setMemoryCap } from './MemoriesStore';

/** Keeps Duo Plus entitlements tied to the active pair code. */
export function PairPremiumBinder() {
  const { pair } = useApp();
  const { bindPair, maxMemories, isPlus } = usePremium();

  useEffect(() => {
    bindPair(pair?.code ?? null);
  }, [pair?.code, bindPair]);

  useEffect(() => {
    setMemoryCap(maxMemories);
  }, [maxMemories, isPlus]);

  return null;
}
