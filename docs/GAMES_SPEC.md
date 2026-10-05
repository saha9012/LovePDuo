# Games Spec — LovePDuo MVP

## Shared

- Два телефона / два аккаунта одной пары
- Состояния: `lobby → countdown → playing → round_end → finished`
- Post-match: `pickPostMatchLine(my, their)` из ≥30 фраз
- Rematch обязателен

Realtime sync: `backend` WebSocket rooms (seed + score events).  
Пока клиент умеет solo + simulated partner score; dual sync подключается к `:8787`.

---

## GAME-01 Sky Claim

**Файл:** `apps/mobile/app/game/sky-claim.tsx` + `src/games/skyClaim.ts`

| Param | Value |
|-------|-------|
| Duration | ~50s |
| Spawn | every 700ms, seeded |
| Types | orb (+1), amber (+3), decoy (−2) |
| Combo | +15% per stack, cap 8 |
| Field | per-device catch zone |

Feel checklist:
- [x] clear tap hitbox
- [x] haptic catch/miss
- [x] readable HUD
- [x] post-match + rematch
- [ ] authoritative dual seed sync via WS (in progress)

---

## GAME-02 Heartbeat Tap

**Файл:** `apps/mobile/app/game/heartbeat.tsx` + `src/games/heartbeat.ts`

| Param | Value |
|-------|-------|
| Duration | 36s |
| BPM | 104 |
| Perfect window | ±70ms |
| Great window | ±140ms |
| Sync bonus | +40 when near-simultaneous |

---

## GAME-03 Truth Or Spark

**Файл:** `apps/mobile/app/game/truth-or-spark.tsx` + `src/content/sparks.ts`

- Filters: soft / spicy (Play-safe)
- Kinds: question / dare / spark
- Skip limit: 3
- Cards RU: ≥60

---

## Post-match engine

`src/content/postMatch.ts` — win / lose / draw pools, дерзко-милый тон.
