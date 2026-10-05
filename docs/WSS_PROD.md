# Production realtime (wss) — draft

MVP uses local `ws://IP:8787` (see `docs/ANDROID_QA.md`).

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

## Not done yet

- Deployed host
- Token auth / rate limits
- Sticky rooms across multi-instance

Until then: LAN `ws://` only.
