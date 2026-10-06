# LovePDuo — PROGRESS

**Repo:** `https://github.com/saha9012/LovePDuo.git`  
**Test:** http://localhost:8081 · WS `:8787`  
**Updated:** 2026-10-06

## Latest

- [x] Soft HUD prefers forceSolo demo over stale live  
- [x] ToS Дальше (обоим) only when peer live  
- [x] Sky Claim ready gates соло demo  
- [x] Soft/Veil/Orbit/Draw ready gates соло demo  
- [x] Heartbeat Solo demo ready + Sync ·demo label  
- [x] ToS syncMeta prefers solo after forceSolo  
- [x] ToS advance CTA says соло on Solo/Demo  
- [x] ToS post-match Solo demo title + lines  
- [x] Post-match demo lines skip fake win/lose tease  
- [x] Post-match Solo demo titles (no fake duel win)  
- [x] Solo/forceSolo HUDs mark partner score as demo  
- [x] Word Veil marks solo partner word as demo  
- [x] Profile Plus copy honest about local stats  
- [x] Word Veil ready wait gates on WS room ≥2  
- [x] ToS clears idle forceSolo only when WS ≥2  
- [x] Home hero gates live copy on WS room ≥2  
- [x] Warmth pulse does not fake partnerPresence  
- [x] joinPair starts offline until WS confirms peer  
- [x] Lobby Solo hint gates on WS room ≥2  
- [x] Together notes CTA gates on WS room ≥2  
- [x] Play densifies pair≠WS room + partner presence  
- [x] Profile shows pair-meta outbox pending  
- [x] Together shows warmth/mutation outbox pending  
- [x] Music tab shows pending music outbox  
- [x] Mount hello skipped while forceSolo  
- [x] Home shows outbox pending (music/warmth/meta)  
- [x] Mutation outbox flush keeps undelivered items  
- [x] peer_joined hello skipped after leaveMatch until rematch  
- [x] Catalog rematch ·соло hints after leaveMatch  
- [x] Word Veil rematch hint ·соло after leaveMatch  
- [x] ToS rematch toast ·соло when partner leftMatch  
- [x] Soft rematch flash says ·соло when partner leftMatch  
- [x] Solo rematch does not spray rematch into WS room  
- [x] Rematch duo only if peer did not leaveMatch (Home ≠ match)  
- [x] Outbox flush marks synced only on live send  
- [x] Together notes send/flush via sendGameIfPeerLive  
- [x] Music now-playing + Together candle via sendGameIfPeerLive  
- [x] Play peek/filter + lobby host via sendGameIfPeerLive  
- [x] Mid-match sends skip forceSolo (sendGameIfDuo)  
- [x] Stale scores/finish ignored after leaveMatch until rematch  
- [x] Mid-match pings ignored after leaveMatch until rematch  
- [x] ToS live badge stays solo after leaveMatch hellos  
- [x] Hello after leaveMatch stays соло · lobby leave via sendGameIfPeerLive  
- [x] Word Veil forceSoloRef guards synced-start timers  
- [x] ToS presence online skips clear after leaveMatch  
- [x] Rematch duo/solo from live WS room (not stale partnerLive)  
- [x] peer_joined after leaveMatch stays solo until rematch  
- [x] leaveMatch carries seed · ignore stale leave after rematch  
- [x] ToS cancels synced-start timers on forceSolo  
- [x] Cancel synced-start timers when forceSolo flips  
- [x] peer_left on ready auto-starts · leaveMatch ready auto-start  
- [x] leaveMatch on ready auto-starts remaining player  
- [x] forceSolo skips synced-start wait after leaveMatch  
- [x] Ready-screen exit announces leaveMatch · PostMatch Home leaveMatch  
- [x] PostMatch Home announces leaveMatch · leaveMatch rejoin races  
- [x] leaveMatch toast ≠ peer_left · Home/Play drop lobby chip on disconnect  
- [x] Play clears peer-lobby on peer_left · scrapbook shows лимит  
- [x] Together candle continues solo on peer_left · lobby pair≠WS  
- [x] Mid-match leave announces leaveMatch → partner forceSolo  
- [x] Scrapbook empty shows Free/Plus memory ceiling  
- [x] Outbox flush only when WS room has a peer (no solo fake-sync)  
- [x] Unlink drops undelivered notes/memories (no fake synced)  
- [x] Home WS sockets label · scrapbook Free/Plus memory cap  
- [x] Pair success: pair code ≠ WS room  
- [x] Home feed shows pending note/memory sync · solo lobby clears session  
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
