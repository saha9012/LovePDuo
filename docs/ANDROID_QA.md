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

- [ ] Sky Claim: очки партнёра · miss/decoy/combo notes · finish note · rematch hello  
- [ ] Heartbeat: sync · miss HUD note · finish note · rematch hello · presence mid-match  
- [ ] Truth Or Spark: named turn · skip juice · filter-change toast · deck-wrap · Перетасовать  
- [ ] Signal Draw: first stroke toast · brush toast · 5s warning · peer finish · rematch hello  
- [ ] Orbit Catch: miss/align notes · finish sync · rematch hello · presence  
- [ ] Soft Duel: tap grade mirror · round-ahead · arm ЖМИ · partner finish juice · rematch hello · presence  
- [ ] Word Veil: typing juice · peer-locked hint · start hello · presence · rematch hello  
- [ ] Lobby: Ready toast · cancel mid-count · peer_left · peek «партнёр тоже здесь»  
- [ ] Play: peer-lobby banner → one-tap join  
- [ ] Welcome reconnect · Profile invite deep link · partner rename toast  
- [ ] Music: now-playing juice · stop toast · playlist switch · shelf + sync · reaction sync  
- [ ] Together: candle start/blow/end · spark · note · warmth receive toast  
- [ ] Home: warmth · peer-join toast · mood toast · presence online/away · room size 2
- [ ] Lobby: peer_left / unready toast · Ready rebroadcast after WS reconnect  

## Web dual (без телефонов)

Два профиля браузера → http://localhost:8081  
WS: `ws://127.0.0.1:8787` (default).

## Remote dual без одной Wi‑Fi

См. `docs/WSS_PROD.md` — Cloudflare Tunnel one-liner → `wss://….trycloudflare.com` в Profile на обоих телефонах.
