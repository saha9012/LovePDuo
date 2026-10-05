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

1. Run Expo on Android/iOS with pair already linked (two devices or web dual).
2. Shoot these screens full-bleed (no status-bar clutter if possible):
   - Welcome / reconnect
   - Pair create / join success
   - Home (partner online · warmth toast if possible)
   - Play with peer-lobby banner (optional dual timing)
   - Lobby both READY / countdown
   - Sky Claim mid-round (partner score live)
   - Heartbeat Tap
   - Signal Draw dual strokes
   - Music shelf with partner now-playing
   - Together candle lit
3. Export 1080×1920 (or crop to 9:16) and overwrite:
   - `assets/store/01_welcome.png` … `07_candle.png`
4. Keep filenames — listing docs reference them.
5. Dual-feel extras (Ideal Bar QA): lobby cancel toast, Soft Duel partner grade, ToS named turn, sync-finish PostMatch, peer leave/rejoin.

## Web helper (optional)

Open `assets/store/capture.html` in a browser to preview frame slots and mark which are still drafts.

See also `docs/STORE_LISTING.md` · `docs/ANDROID_QA.md`.
