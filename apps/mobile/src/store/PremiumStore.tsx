import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PremiumTier = 'free' | 'duo_plus';

export type PremiumFeature = {
  id: string;
  label: string;
  freeValue: string;
  plusValue: string;
};

export const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    id: 'shelves',
    label: 'Полки музыки',
    freeValue: '6',
    plusValue: '8',
  },
  {
    id: 'sparks',
    label: 'Колода искр',
    freeValue: 'soft',
    plusValue: 'soft + spicy pack',
  },
  {
    id: 'memories',
    label: 'Memory лента',
    freeValue: '40',
    plusValue: '120',
  },
  {
    id: 'themes',
    label: 'Настроения',
    freeValue: '3',
    plusValue: '3 + pulse skins',
  },
  {
    id: 'stats',
    label: 'Статистика пары',
    freeValue: 'базовая',
    plusValue: 'streaks + история',
  },
];

type PremiumApi = {
  hydrated: boolean;
  tier: PremiumTier;
  trialEndsAt: number | null;
  pairCode: string | null;
  isPlus: boolean;
  daysLeft: number;
  maxShelves: number;
  maxMemories: number;
  spicyUnlocked: boolean;
  bindPair: (code: string | null) => void;
  startTrial: () => boolean;
  unlockDevPlus: () => void;
  clearPlus: () => void;
  features: PremiumFeature[];
};

const KEY = 'lovepduo.premium.v1';
const TRIAL_MS = 7 * 86_400_000;

const Ctx = createContext<PremiumApi | null>(null);

type Persisted = {
  tier: PremiumTier;
  trialEndsAt: number | null;
  trialUsed: boolean;
  pairCode: string | null;
};

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [tier, setTier] = useState<PremiumTier>('free');
  const [trialEndsAt, setTrialEndsAt] = useState<number | null>(null);
  const [trialUsed, setTrialUsed] = useState(false);
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const p = JSON.parse(raw) as Persisted;
          setTier(p.tier === 'duo_plus' ? 'duo_plus' : 'free');
          setTrialEndsAt(typeof p.trialEndsAt === 'number' ? p.trialEndsAt : null);
          setTrialUsed(Boolean(p.trialUsed));
          setPairCode(typeof p.pairCode === 'string' ? p.pairCode : null);
        }
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(
      KEY,
      JSON.stringify({ tier, trialEndsAt, trialUsed, pairCode } satisfies Persisted),
    );
  }, [hydrated, tier, trialEndsAt, trialUsed, pairCode]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const trialActive = Boolean(trialEndsAt && trialEndsAt > now);
  const isPlus = tier === 'duo_plus' || trialActive;
  const daysLeft = trialActive
    ? Math.max(1, Math.ceil(((trialEndsAt as number) - now) / 86_400_000))
    : tier === 'duo_plus'
      ? 999
      : 0;

  const bindPair = useCallback((code: string | null) => {
    setPairCode(code ? code.toUpperCase() : null);
  }, []);

  const startTrial = useCallback(() => {
    if (trialUsed || tier === 'duo_plus') return false;
    const ends = Date.now() + TRIAL_MS;
    setTrialEndsAt(ends);
    setTrialUsed(true);
    return true;
  }, [trialUsed, tier]);

  const unlockDevPlus = useCallback(() => {
    setTier('duo_plus');
    setTrialEndsAt(null);
  }, []);

  const clearPlus = useCallback(() => {
    setTier('free');
    setTrialEndsAt(null);
  }, []);

  const value = useMemo<PremiumApi>(
    () => ({
      hydrated,
      tier: isPlus ? 'duo_plus' : 'free',
      trialEndsAt,
      pairCode,
      isPlus,
      daysLeft,
      // 4 default mood shelves + extras (free: +2, plus: +4)
      maxShelves: isPlus ? 8 : 6,
      maxMemories: isPlus ? 120 : 40,
      spicyUnlocked: isPlus,
      bindPair,
      startTrial,
      unlockDevPlus,
      clearPlus,
      features: PREMIUM_FEATURES,
    }),
    [
      hydrated,
      isPlus,
      trialEndsAt,
      pairCode,
      daysLeft,
      bindPair,
      startTrial,
      unlockDevPlus,
      clearPlus,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePremium() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePremium outside provider');
  return ctx;
}
