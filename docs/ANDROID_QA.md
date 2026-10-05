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

- [ ] Sky Claim: очки · miss/decoy/combo · оба ловят · оба miss/decoy · оба combo · оба финиш · оба догоняют · оба rematch · peer_left  
- [ ] Heartbeat: sync! dual · оба miss · оба perfect/great · оба финиш · оба догоняют · оба rematch · presence · peer_left  
- [ ] Truth Or Spark: named turn · skip · оба скипнули · оба soft/spicy · filter · оба колода · оба новая колода · peer_left  
- [ ] Signal Draw: first stroke · рисуем вместе · оба кисть/clear/undo · brush · 5s · оба финиш · оба догоняют · оба rematch · peer_left  
- [ ] Orbit Catch: miss/align · sync-align · оба catch · оба miss · оба финиш · оба догоняют · оба rematch · peer_left  
- [ ] Soft Duel: tap grade · оба PERFECT/GOOD/OK · оба рано · оба ЖМИ · оба ждут · наравне · гонка · оба финиш · оба догоняют · arm · sync-finish · оба rematch · late-start · peer_left  
- [ ] Word Veil: typing · пишем вместе · оба закрыли · оба: одно слово · оба догоняют · lock clear · match juice · finish sync · оба rematch · peer_left  
- [ ] Lobby: Ready toast · оба сняли Ready · оба в этом лобби · оба догоняют · cancel mid-count · peer leave/rejoin · Ready rebroadcast · late-start «догоняем» · peek  
- [ ] Play: peer-lobby banner → one-tap join · leave toast · оба фильтр MVP/New · оба в игре из каталога  
- [ ] Music: now-playing · оба слушают · stop · оба остановили · shelf · оба полка · оба на полке · оба добавили · reaction sync · reaction match · leave/rejoin
- [ ] Together: candle · sync-light · оба погасили · оба догорели · named spark · оба искра · оба на Together · note · переписка · warmth · leave/rejoin  
- [ ] Home: warmth send/receive · тепло встречное · peer-join · оба в комнате · leave toast · оба настроение · mood sync · presence · room size 2  
- [ ] Welcome reconnect · оба в комнате · leave toast · Profile invite deep link · partner rename toast · display-name sync 

## Web dual (без телефонов)

Два профиля браузера → http://localhost:8081  
WS: `ws://127.0.0.1:8787` (default).

## Remote dual без одной Wi‑Fi

См. `docs/WSS_PROD.md` — Cloudflare Tunnel one-liner → `wss://….trycloudflare.com` в Profile на обоих телефонах.
