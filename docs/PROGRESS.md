# LovePDuo — PROGRESS

**Repo:** `https://github.com/saha9012/LovePDuo.git`  
**Test:** http://localhost:8081 · WS `:8787`  
**Updated:** 2026-10-06

## Latest

- [x] Lobby cancel/unready/leave clears match session  
- [x] Auth honesty: local ≠ cloud · pair = code+WS (Welcome/Profile)  
- [x] Entering a match consumes session (Home resume disappears)  
- [x] Late match resume enters game · Soft/Orbit/Draw/Veil consumeMatchSession  
- [x] Lobby ready/start live-only · memory broadcast skips empty room · Together hello gated  
- [x] Finish + mid-match game signals live-only (all catalog games)  
- [x] ToS rematch live-only · Word Veil/ToS peer_left → forceSolo · Home mood live-only  
- [x] Rematch announce live-only (Soft/HB/Sky/Orbit/Draw/Veil)  
- [x] Rematch resets forceSolo from live peer (Soft/HB/Sky/Orbit/Draw)  
- [x] Soft forceSoloRef · synced-start 800ms grace · sendGameIfPeerLive hellos  
- [x] Gate mount hellos (games + Music/Together) via sendGameIfPeerLive  
- [x] Lobby start claims stale/empty host · host re-elect via outbox · peek/filter live-only  
- [x] Clear sync outboxes + drop pending note/memory on unlink/sign-out  
- [x] Music upload/stub/react outbox · Now Playing live-only · Lobby leave notify  
- [x] Together candle/spark outbox · Duo Plus/pair-meta queue when alone  
- [x] Live synced-start countdown tick · display-name outbox · play-peek only when live  
- [x] ToS synced-start countdown · Word Veil/Soft synced-start · mid-match forceSolo  
- [x] Host claim on peer_left · Soft/Orbit rematch seed settle  
- [x] Memory/note remove outbox · scrapbook pending UI  
- [x] Music mutation outbox · ToS soloEscape unlock · Soft synced-start gate  
- [x] Duo Plus pair WS sync · warmth outbox · Word Veil no self-match finish  
- [x] Global note/memory outbox · Music shelf auto-add · pair-meta host sync  
- [x] Lobby host double-start fix · note outbox · ToS spicy Free gate  
- [x] Sky/Draw/Orbit/HB: no fake partner scores in live duo · playlist Free6/Plus8  
- [x] Pair create/join/deep-link densify · Home pair≠room  
- [x] Match session AsyncStorage + backend `pair_sync` / lastMatch handoff  

## Catalog

Sky Claim · Heartbeat · Truth Or Spark · Signal Draw · Orbit Catch · Soft Duel · Word Veil

## Still open (Ideal Bar not closed)

Remaining blockers need external input / real product work (not toast layers):

1. Live device screenshot replace (`docs/STORE_SHOTS.md`)  
2. Physical Android Expo Go dual QA (`docs/ANDROID_QA.md`)  
3. Spotify OAuth keys + App Remote stream  
4. Signal Draw smoother canvas — Svg paths shipped; Skia optional later  
5. Production `wss://` deploy (`docs/WSS_PROD.md`) — stub has rate/size limits + reconnect replace; host still external  
