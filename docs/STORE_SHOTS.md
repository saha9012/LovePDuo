# Store screenshots — capture runbook

Draft marketing frames live in `assets/store/` (1080×1920). They are **placeholders**.
Store listing should use **live device captures** when available.

## Regenerate procedural frames

```powershell
cd C:\prodject\LovePDio
python scripts\gen_store_frames.py
```

Requires Pillow: `pip install pillow`

## Live capture (preferred)

1. Run Expo on Android/iOS with pair already linked.
2. Shoot these screens full-bleed (no status-bar clutter if possible):
   - Welcome
   - Pair create / join success
   - Home (partner online)
   - Sky Claim mid-round
   - Heartbeat Tap
   - Music shelf with a track
   - Together candle
3. Export 1080×1920 (or crop to 9:16) and overwrite:
   - `assets/store/01_welcome.png` … `07_candle.png`
4. Keep filenames — listing docs reference them.

## Web helper (optional)

Open `assets/store/capture.html` in a browser to preview frame slots and mark which are still drafts.

See also `docs/STORE_LISTING.md`.
