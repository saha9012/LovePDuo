# LovePDuo — PROGRESS

**Repo:** `https://github.com/saha9012/LovePDuo.git` (НЕ pom)  
**Local:** `C:\prodject\LovePDio`  
**TZ:** v1.1.2  
**Updated:** 2026-10-05  
**Branch:** `cursor/phase0-foundation-lovepduo-8960` (+ `main`)

## Stack

Expo RN + TypeScript. Realtime: `backend` WS `:8787`.

## Dev servers (owner test)

- App: http://localhost:8081  
- WS: ws://127.0.0.1:8787  

## Phase status

### Phase 0 — Foundation ✅
### Phase 1 — Pair core ✅ (+ app-wide RealtimeConnector)
### Phase 2 — Games MVP ✅

- [x] Lobby Ready → shared seed → countdown (host starts)
- [x] Sky Claim shared seed + live score
- [x] Heartbeat shared seed + real tap sync bonus (±120ms) + live score
- [x] Truth Or Spark shared shuffled deck + synced index/filter/skip
- [x] Post-match ≥30 · GameCover · juice haptics layer

### Phase 3 — Music 🚧

- [x] Upload persist + in-app AV play
- [x] Spotify/VK metadata stubs (honest)
- [ ] OAuth keys when available

### Together

- [x] Daily spark
- [x] Candle Timer 2 мин (WS sync start)
- [x] Warmth from Together

## Gaps vs Ideal Bar

1. Dual-phone physical QA (web 2× окна работают; Android Expo Go — нужен LAN IP в `.env`)
2. WAV SFX packs (сейчас haptic juice)
3. Custom raster app icon / store screenshots
4. Authoritative server clock for beat (сейчас client clocks + shared seed)

## Run

```bash
cd backend && npm start
cd apps/mobile && npm start   # web: http://localhost:8081
```
