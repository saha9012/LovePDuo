# Android dual-device QA (LAN)

Цель: два телефона в одной Wi‑Fi играют через realtime на ПК.

## 1. Backend на ПК

```bash
cd backend
npm start
# [LPD] realtime listening on :8787
```

Узнай IPv4 ПК (`ipconfig` / Settings → Network). Пример: `192.168.0.120`.

Firewall: разреши входящие TCP **8787** для частной сети.

## 2. Expo на ПК

```bash
cd apps/mobile
npm start
# или: npx expo start --lan
```

Открой Expo Go на обоих Android → отсканируй QR (LAN).

## 3. WS URL в приложении

В **Profile** → поле **Realtime URL**:

```text
ws://192.168.0.120:8787
```

Жми **Сохранить URL**. Бейдж должен стать `WS online`.

Клиент сам переподключается с backoff, если Wi‑Fi моргнул; при уходе в фон шлёт `presence: away`.

Альтернатива (rebuild / restart Metro):

```bash
# apps/mobile/.env
EXPO_PUBLIC_LPD_WS_URL=ws://192.168.0.120:8787
```

## 4. Пара

1. Телефон A: создать пару → код  
2. Телефон B: join по коду (или `lovepduo://join/CODE`)  
3. Home: оба online · toast «вошёл» (не warmth) · Warmth отдельно · meta «в комнате 2»  
4. Play → Lobby → оба Ready (SFX) → countdown → общий seed

## 5. Smoke checklist

- [ ] Sky Claim: очки партнёра · miss/decoy/combo · sync-finish PostMatch · rematch hello · peer_left  
- [ ] Heartbeat: sync! dual · miss HUD · sync-finish PostMatch · rematch hello · presence · peer_left  
- [ ] Truth Or Spark: named turn · skip · filter-change · deck-wrap peer · Перетасовать · peer_left  
- [ ] Signal Draw: first stroke · brush on start · 5s · sync-finish PostMatch · rematch · peer_left  
- [ ] Orbit Catch: miss/align · sync-align perfect · sync-finish PostMatch · rematch hello · peer_left  
- [ ] Soft Duel: tap grade · arm ЖМИ · sync-finish PostMatch · rematch hello · late-start · peer_left · presence  
- [ ] Word Veil: typing juice · typing clear on lock · peer-locked hint · match juice · finish sync · rematch · peer_left  
- [ ] Lobby: Ready toast · cancel mid-count · peer leave/rejoin · Ready rebroadcast · late-start «догоняем» · peek  
- [ ] Play: peer-lobby banner → one-tap join · leave toast  
- [ ] Music: now-playing juice · stop toast · playlist switch · shelf + sync · reaction sync · leave/rejoin  
- [ ] Together: candle start/blow/end · sync-light · named spark · note · warmth · leave/rejoin  
- [ ] Home: warmth · peer-join toast · mood toast · mood sync · presence · room size 2  
- [ ] Welcome reconnect · Profile invite deep link · partner rename toast · display-name sync 

## Web dual (без телефонов)

Два профиля браузера → http://localhost:8081  
WS: `ws://127.0.0.1:8787` (default).

## Remote dual без одной Wi‑Fi

См. `docs/WSS_PROD.md` — Cloudflare Tunnel one-liner → `wss://….trycloudflare.com` в Profile на обоих телефонах.
