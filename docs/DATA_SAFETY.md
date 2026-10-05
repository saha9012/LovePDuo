# Data Safety (draft for Play Console)

LovePDuo / Love Play Duo — couples mini-games + music shelf.

## Data collected (MVP local)

| Data type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Display name | Yes (local) | With pair peer via WS room | Pair UX |
| Pair code | Yes (local + ephemeral WS) | Room peers only | Join link |
| Game scores / draw strokes | Ephemeral WS | Pair room only | Dual play |
| Uploaded audio URIs | Local device storage | Not uploaded to LPD cloud in MVP | Music shelf |
| Tiny notes / memories | Local AsyncStorage | Optional WS relay to partner | Rituals |
| Analytics events | Dev console only | No third party in MVP | Product metrics stub |

## Not collected in MVP

- Precise location  
- Contacts / photos gallery bulk  
- Payment info  
- Advertising ID  

## Encryption

- Transit: WS currently **plain** on LAN (`ws://`). Production target: `wss://` + auth tokens.  
- At rest: AsyncStorage on device (OS sandbox).

## Account deletion

Sign out / unlink pair clears local pair state. Full cloud delete N/A until Firebase/Supabase.

## Privacy policy

See `docs/PRIVACY_DRAFT.md`. Publish URL before store submit.
