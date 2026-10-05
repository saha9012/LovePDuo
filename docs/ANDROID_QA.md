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
3. Home: оба online, Warmth доходит, meta показывает «в комнате 2»  
4. Play → Lobby → оба Ready (SFX) → countdown → общий seed

## 5. Smoke checklist

- [ ] Sky Claim: очки партнёра двигаются · rematch sync  
- [ ] Heartbeat: sync bonus · rematch seed  
- [ ] Truth Or Spark: ход переключается · Перетасовать sync  
- [ ] Signal Draw: чужие штрихи видны · rematch blank  
- [ ] Orbit Catch: co-op счёт · rematch  
- [ ] Soft Duel / Word Veil: live + rematch  
- [ ] Lobby: Ready / Снять Ready · peer_left clears  
- [ ] Music: now-playing у партнёра  
- [ ] Together: candle sync · spark sync · tiny note  
- [ ] Home: warmth toast · room size 2  

## Web dual (без телефонов)

Два профиля браузера → http://localhost:8081  
WS: `ws://127.0.0.1:8787` (default).
