# LovePDuo Design System

> Темная romantic innovation. Не Material из коробки. Не baby-pink love-app.

## Tokens

См. `apps/mobile/src/theme/tokens.ts`.

| Token | Value |
|-------|-------|
| bg-0 | `#07060A` |
| bg-1 | `#121018` |
| bg-2 | `#1B1524` |
| bg-elevated | `#241C31` |
| stroke | `rgba(255,214,186,0.12)` |
| text-primary | `#F7EDE3` |
| text-secondary | `#C9B6A8` |
| text-muted | `#8E7B72` |
| accent-rose | `#E39AA0` |
| accent-amber | `#E2B07A` |
| accent-wine | `#8E3B4A` |
| accent-mist | `#7A8CA3` |

## Typography

| Role | Font |
|------|------|
| Display / brand | Fraunces |
| UI | Sora |
| Mono / codes | IBM Plex Mono |

## Components

| Component | Path | Notes |
|-----------|------|-------|
| `LpdBackground` | `src/components/LpdBackground.tsx` | breathing glow + vignette + mood |
| `BrandMark` | `src/components/BrandMark.tsx` | LovePDuo wordmark |
| `LpdButton` | `src/components/LpdButton.tsx` | primary / ghost / danger |
| `PairAvatar` | `src/components/PairAvatar.tsx` | initials + presence |
| `CodeInput` | `src/components/CodeInput.tsx` | 6-символьный код |
| `GameTile` | `src/components/GameTile.tsx` | catalog row |
| `PostMatchCard` | `src/components/PostMatchCard.tsx` | tease + rematch |
| `BottomNav` | custom tab chrome via Expo Tabs | amber active, rose ember |

## Spacing / radius

- Spacing: 4 / 8 / 12 / 16 / 24 / 32 / 48
- Radius: 12–20 (не capsuel-pill everywhere)

## Motion

1. Breathing dark background — Home / Welcome
2. Pair-link cinematic scale reveal — `/pair/success`
3. Veil fade on welcome
4. Game juice — catch / perfect / miss haptics
5. Post-match typography — Fraunces italic tease

## Rules

- Home ≠ dashboard
- Cards только для interactive containers
- Акценты: rose + amber only (не purple neon)
- Фон всегда с глубиной
