# Production realtime (wss) — draft

MVP uses local `ws://IP:8787` (see `docs/ANDROID_QA.md`).
Ideal Bar dual-feel (hello pings, lobby cancel, finish notes, Music/Together hellos) uses the same JSON protocol — no client fork for prod.

## Target

- `wss://realtime.lovepduo.app` (or Cloudflare Tunnel / Fly / Railway)
- TLS terminate at reverse proxy
- Auth: short-lived room token tied to pair code + userId
- Same JSON protocol as `backend/src/server.js`

## Client

Set Profile Realtime URL or:

```bash
EXPO_PUBLIC_LPD_WS_URL=wss://realtime.lovepduo.app
```

`PairRealtime` already reconnects with backoff and sends presence heartbeats.
Profile surfaces online/offline reconnect juice when the socket flaps.

## Suggested first deploy

1. Quick tunnel (no account needed for trycloud):

```bash
cd backend
npm start
# other terminal:
npx --yes cloudflared tunnel --url http://localhost:8787
```

Copy the printed `https://….trycloudflare.com` URL, convert to `wss://….trycloudflare.com`, paste in Profile → Realtime URL on both phones.

2. Or Fly/Railway single node with sticky websocket  
3. Point both phones at `wss://…` in Profile → confirm Home room size 2 · Play peek · lobby Ready  

## Server hardening (shipped in stub)

- `maxPayload` / `LPD_MAX_MSG_BYTES` (default 48KB)
- per-socket rate limit `LPD_RATE_MAX` msgs/sec (default 48)
- same `userId` reconnect replaces stale socket (room stays 1–2)
- empty rooms deleted on last leave
- `ping` / `pong` for Profile «Проверить соединение» RTT

## Not done yet

- Deployed host
- Token auth
- Sticky rooms across multi-instance

Until then: LAN `ws://` or temporary Cloudflare Tunnel.
