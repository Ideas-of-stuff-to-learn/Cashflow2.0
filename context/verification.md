# Cashflow2.0 — Verification

## Web Frontend

### Build Check (primary — always run after web changes)
```bash
cd App/WebUI && npm run build
```
Expected: `✓ built in Xs` with no errors. Warnings about unused variables are acceptable but worth investigating.

### Dev Server (visual verification)
```bash
cd App/WebUI && npm run dev
```
Then open the local URL in a browser. Test the golden path: login → upload CSV → check chart → open transactions page.

### What to check visually
- Owner badge is top-right on every screen (not displaced)
- ContentsScreen: sidebar categories align with DATE column header
- Chart segment popup appears correctly (check `popupChartConfig.jsx` for current `POPUP_VARIANT`)
- FilterPane drag-to-reorder works in Dashboard
- Manual review flow completes without error
- Re-uploading same file does not create duplicate transactions

## Backend

### No automated tests exist.
Manual verification only.

### Start the Flask dev server
```bash
python App/API/backend.py
```
Or via `start-all.bat` for full local dev stack (auto-detects LAN IP).

### Key manual checks after backend changes
- Upload a CSV → verify deduplication works
- Login / logout → verify JWT cookie set and cleared
- Token refresh → verify new token issued
- Permission enforcement → verify non-owner can't hit owner-only routes

## Mobile (RN)

### Start Expo
```bash
cd App/NativeAppUI && npx expo start
```
Or via `start-all.bat`.

Check `docs.expo.dev/versions/v54.0.0/` before writing any Expo API code.

## No Test Suite

There is no `npm test`, `pytest`, `vitest`, or any automated test runner anywhere in this project. Do not attempt to run tests — they do not exist.

## Verification After Code Changes

1. Run `npm run build` (web) — catches syntax errors, import errors, dead exports
2. Run dev server and check the affected screen visually
3. If auth/permissions changed: manual round-trip test (login → action → logout)
4. If pipeline changed: upload a test CSV and verify categorization output
5. If schema changed: manually apply SQL to Supabase and verify no breakage

## CI Verification (GitHub Actions)

After pushing to main:
- `autoDeployFrontend.yml` runs and deploys the web frontend
- Check the Actions tab for success/failure
- `DBbackupLog.txt` and `DBaliveLog.txt` update nightly (bot-committed) — these are not code verification
