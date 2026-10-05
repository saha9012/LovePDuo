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

- [ ] Sky Claim: очки · miss/decoy/combo · оба ловят/в небе · оба на очках · партнёр/я впереди/гонка/оба в гонке · оба miss/мимо · оба decoy · оба combo/в комбо · оба финиш/на финише · оба догоняют · оба rematch · peer_left · оба снова здесь  
- [ ] Heartbeat: sync!/оба sync · оба miss/мимо · оба perfect/great · оба в ритме · оба на очках · партнёр/я впереди/гонка/оба в гонке · оба финиш/на финише · оба догоняют · оба rematch · presence · peer_left · оба снова здесь  
- [ ] Truth Or Spark: named turn · skip · оба скипнули/мимо карт · оба листают/на карте · оба soft/spicy · оба в soft/spicy · filter · оба колода/по кругу · оба новая колода · peer_left · оба снова здесь  
- [ ] Signal Draw: first stroke · рисуем вместе · оба рисуют · оба на штрихах · я/партнёр впереди/гонка/оба в гонке · оба кисть/одной кистью · clear/чисто · undo/назад · brush · 5s · оба финиш/на финише · оба догоняют · оба rematch · peer_left · оба снова здесь  
- [ ] Orbit Catch: miss/align · sync-align · оба sync · оба catch/в орбите · оба на очках · партнёр/я впереди/гонка/оба в гонке · оба miss/мимо · оба финиш/на финише · оба догоняют · оба rematch · peer_left · оба снова здесь  
- [ ] Soft Duel: tap grade · оба PERFECT/ритме · оба GOOD/темпе · оба OK/такте · оба на очках/в счёте · оба рано/спешат · оба ЖМИ/жмут · оба ждут/ждут вместе · наравне/оба наравне · я впереди · гонка/оба в гонке · оба финиш/на финише · PostMatch dual label · оба догоняют · arm · sync-finish · оба rematch/снова · late-start · peer_left · оба снова в комнате  
- [ ] Word Veil: typing · пишем вместе · оба закрыли/завесили · оба: одно слово/совпали · оба на буквах/в длине · оба почти · оба догоняют · lock clear · match juice · finish sync · оба rematch/снова · peer_left · оба снова здесь  
- [ ] Lobby: Ready toast · оба READY/готовы · оба сняли Ready/не готовы · оба в этом лобби · оба догоняют/в старте · cancel mid-count · peer leave/rejoin · оба снова в лобби · Ready rebroadcast · late-start «догоняем» · peek  
- [ ] Play: peer-lobby banner → one-tap join · leave toast · оба фильтр MVP/New · оба в каталоге · оба в игре · оба ждут игру  
- [ ] Music: now-playing · оба слушают · оба в треке · stop · оба остановили/тишина · shelf · оба полка/в полке · оба на полке · оба добавили/в коллекции · оба на Music/слушают полку · reaction sync · оба чувствуют/в эмоции · reaction match · leave/rejoin · оба снова на Music  
- [ ] Together: candle · sync-light · оба у свечи · оба погасили/гасят · оба догорели/в пепле · named spark · оба искра · оба в искрах · оба на Together/рядом · note · переписка/оба пишут · оба на буквах/в длине · warmth · оба в тепле · leave/rejoin · оба снова вместе  
- [ ] Home: warmth send/receive · тепло встречное · оба в тепле · peer-join · оба в комнате/дома/снова дома · leave toast · оба настроение · оба в настроении · mood sync · presence · room size 2
- [ ] Welcome reconnect · оба в комнате/дома · leave toast · Profile invite deep link · partner rename toast · оба обновили имена · display-name sync · оба назвали комнату/в одной комнате  

## Web dual (без телефонов)

Два профиля браузера → http://localhost:8081  
WS: `ws://127.0.0.1:8787` (default).

## Remote dual без одной Wi‑Fi

См. `docs/WSS_PROD.md` — Cloudflare Tunnel one-liner → `wss://….trycloudflare.com` в Profile на обоих телефонах.
