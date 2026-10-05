# LovePDuo — PROGRESS

**Repo:** `https://github.com/saha9012/LovePDuo.git` (НЕ pom)  
**Local:** `C:\prodject\LovePDio`  
**TZ:** v1.1.2  
**Updated:** 2026-10-05

## Stack decision

Expo RN + TypeScript (Flutter SDK отсутствует в среде). Зафиксировано в README.

## Status by phase

### Phase 0 — Foundation ✅ (MVP-level)

- [x] Monorepo structure (`apps/mobile`, `backend`, `assets`, `docs`, `packages/*`)
- [x] Theme tokens amber + dusty rose
- [x] `LpdBackground` breathing glow
- [x] Fraunces / Sora / IBM Plex Mono
- [x] Splash/welcome hero with LovePDuo brand
- [x] README + run scripts

### Phase 1 — Pair core ✅ (local persist)

- [x] Sign-in (display name) + persist
- [x] Create pair → 6-char code
- [x] Join pair by code
- [x] Pair success cinematic
- [x] Home room + presence UI + mood presets + warmth pulse
- [x] Profile unlink / sign out
- [ ] True dual-device presence via WS (server stub ready)

### Phase 2 — Games MVP ✅ (playable, polish ongoing)

- [x] Sky Claim playable + juice + post-match
- [x] Heartbeat Tap playable + sync bonus
- [x] Truth Or Spark ≥60 cards + soft/spicy + skip
- [x] Post-match phrase pool ≥30
- [ ] Authoritative 2-phone score sync (WS integrate next)
- [ ] Ideal Bar feel pass (spawn curves, SFX, covers)

### Phase 3 — Music 🚧

- [x] Upload picker → pair library persist (AsyncStorage metadata + local URI)
- [x] Spotify metadata stub (honest: OAuth/App Remote next)
- [x] VK fallback stub (honest blocker: official audio pull limited)
- [ ] In-app AV playback polish + now playing presence
- [ ] Real Spotify OAuth when keys available

### Phase 4 — Polish

- [ ] Custom game covers / tab icons SVG set
- [ ] Analytics events
- [ ] Store listing screenshots
- [ ] Crash-free pass on mid Android

## Known gaps vs Ideal Bar

1. Dual-phone sync ещё на stub-сервере, не вшит в game clients.
2. Partner score в Sky/Heartbeat — simulation до WS wiring.
3. Ассеты A06–A12 частично procedural/code, не отдельные SVG packs.
4. Spotify/VK — metadata path only until API keys.

## Next sprint

1. Подключить mobile → `backend` WS для pair presence + Sky Claim seed/score.
2. AV playback для upload tracks.
3. Game covers + empty-state illustrations.
4. Feel pass Sky Claim (spawn difficulty curve).

## Acceptance snapshot (§14.1)

| Criterion | Status |
|-----------|--------|
| Android install / pair flow | In progress (Expo) |
| Dark romantic visual | ✅ direction locked |
| Brand on first screen | ✅ |
| 3 MVP games playable | ✅ (solo + simulated partner) |
| Sky Claim post-match | ✅ |
| Music upload persist | ✅ metadata/URI |
| Spotify/VK attempt logged | ✅ honest stubs |
| No critical crashes main flow | needs device QA |
| Non-placeholder assets | partial |
| Git push LovePDuo | in progress |
