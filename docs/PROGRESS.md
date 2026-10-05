# LovePDuo — PROGRESS

**Repo:** `https://github.com/saha9012/LovePDuo.git` (НЕ pom)  
**Local:** `C:\prodject\LovePDio`  
**TZ:** v1.1.2  
**Updated:** 2026-10-05  
**Branch:** `cursor/phase0-foundation-lovepduo-8960` (+ pushed to `main`)

## Stack decision

Expo RN + TypeScript (Flutter SDK отсутствует в среде). Зафиксировано в README.

## Status by phase

### Phase 0 — Foundation ✅

- [x] Monorepo + Expo app `app.lovepduo`
- [x] Theme tokens amber + dusty rose / Fraunces+Sora+Plex
- [x] `LpdBackground` breathing glow
- [x] Welcome hero brand LovePDuo
- [x] README + docs (TZ / DESIGN / GAMES / PROGRESS)

### Phase 1 — Pair core ✅ (local + WS stub)

- [x] Sign-in persist, create/join 6-char, success cinematic
- [x] Home room, mood, warmth pulse
- [x] WS backend `:8787` + client `PairRealtime`
- [ ] QR deep-link join UI polish

### Phase 2 — Games MVP ✅ (playable)

- [x] Sky Claim + juice + post-match + WS score relay (fallback demo partner)
- [x] Heartbeat Tap + sync bonus
- [x] Truth Or Spark 62 cards soft/spicy
- [x] Post-match ≥30 lines + GameCover tiles
- [ ] Shared seed countdown lobby UX

### Phase 3 — Music 🚧

- [x] Upload → library persist + in-app AV play for local URI
- [x] Spotify/VK metadata stubs + honest notes in UI/PROGRESS
- [ ] Spotify OAuth keys / App Remote
- [ ] VK official audio (blocked → upload fallback)

## Gaps vs Ideal Bar

1. Shared authoritative spawn seed still soft (per-client seed + score sync).
2. Custom SVG icon set / SFX packs incomplete.
3. Device dual-phone QA pending (need 2 clients + backend running).
4. PR API 401 без token — ветки запушены; PR можно открыть вручную.

## Run

```bash
cd apps/mobile && npm start
# optional realtime:
cd backend && npm start
```

## Acceptance snapshot

| Criterion | Status |
|-----------|--------|
| Canonical repo LovePDuo | ✅ pushed |
| Brand first screen | ✅ |
| Dark romantic | ✅ |
| 3 games playable | ✅ |
| Music upload persist + play | ✅ local |
| Spotify/VK attempt logged | ✅ |
| Dual-phone live score | 🟡 WS ready, needs 2-device QA |
