# Cashflow2.0 — Handoff

## Status (2026-09-15)

No active task. Clean main branch.

## What Was Just Done

**Manual review UX fixes** (2026-09-15):
- Reload persistence: picks accumulated mid-review are stored in `localStorage` (`mr_pending_picks`); on reload `TransactionsContext` flushes them to DB before triggering the flow, so remaining count is accurate and completed picks aren't lost
- Exit button: small red "Exit" bottom-right of each categoriser popup; opens confirmation overlay explaining remaining go to Other; Confirm exit / Go back options
- Exit-confirm error recovery: if save fails, shows "Something went wrong — Retry exit / Go back" instead of a dead end
- Retry wiring: sequential flush error Retry button now correctly retries the flush (was wired to no-op)
- Auto-logout: `api.jsx` fires `auth:session-expired` custom event when refresh token is rejected; `AuthContext` listens and calls `endSession()` — kicks to login screen instead of looping with errors
- File list clears: selected file names under "Choose CSV files" clear automatically when manual review flow resolves (both `HomeScreen` and `Dashboard`)
- Progress update rule: added to CLAUDE.md, constraints.md, and spec section 54

**DB reset SQL fix** (2026-09-15):
- Old pattern (DELETE + INSERT users) created a new user_id, invalidating the JWT cookie — caused "parsing failed" loop until manual logout
- Correct pattern: `UPDATE users SET password_hash = '...' WHERE username = 'owner'` preserves user_id; `TRUNCATE transactions, category_records, uploaded_files, merchants`
- In-memory global cache (`_global_records_cache` in `cache.py`) must be cleared by restarting the Flask process after a DB reset

**ContentsScreen redesign** (commit a155128, 2026-09-15):
- New sidebar layout: category filter (196px) on left, transaction table on right
- Sidebar "Filter by category" aligned with DATE column header via 86px spacer (matching search-wrap 52px + count-row 34px)
- Owner badge fixed to always top-right: Layout.jsx now uses 3-column CSS grid header
- Back button + "Transactions" title moved from ContentsScreen into Layout.jsx header for /contents route
- cs-topbar div removed from ContentsScreen
- Slim single-row SelectionBar (cs-sel-* classes) replacing old dark two-row banner
- cs-container changed from `height: 100vh` to `height: 100%`; app-content made flex column to fill correctly

**FilterPane bug fix** (commit 8e2a61d, 2026-09-12):
- Removed stale `localStorage` minimize state (`dashboardFilterPaneMinimized`) from FilterPane.jsx
- The collapse button had been removed/commented out but the localStorage read persisted, causing the pane to initialize minimized in production with no way to expand it

## Important Files for Next Session

| If touching... | Read first |
|---|---|
| Transaction table | `App/WebUI/src/screens/ContentsScreen.jsx`, `context/architecture.md` (ContentsScreen section) |
| Charts | `App/WebUI/src/utils/charts/buildStackData.jsx`, `App/WebUI/src/config/popupChartConfig.jsx` |
| Auth / permissions | `App/API/permissions.py`, `App/API/routes/auth.py` |
| Categorization | `App/API/categorise/pipeline.py` and its tiers |
| Layout / header | `App/WebUI/src/components/Layout.jsx`, `App/WebUI/src/styles/Layout.css` |
| Mobile (RN) | `App/NativeAppUI/AGENTS.md` warning first, then relevant screen/component |

## Open Work (Not Blocking)

- RN popup config wiring: `popupChartConfig.js` exists but ChartWindowSection.js has hardcoded popup — not wired
- FilterPane RN drag animation: PanResponder reorders on release, not live-animated
- COLOR_PALETTE triplicated (adminClI/adminCliCommon.py may drift from web/RN chartUtils)
- Root README.md is just a placeholder
- context/overview.html may need a milestone update for the ContentsScreen redesign

## Architecture Notes for New Sessions

See `context/architecture.md` for full detail. Key points:
- Backend: Flask + raw psycopg2, no ORM, no automated tests
- Web: React 19 + Vite, plain CSS, no TypeScript
- Web AppState = **4 split contexts** (Auth/Processing/Transactions/ChartFilter) — NOT a single AppContext
- RN AppState = **single AppContext.js** with useApp() hook
- Two sentinels: `NEEDS_MANUAL_REVIEW` (user picks) + `NOT_YET_CATEGORISED` (timed-out, retry later) — both in all 4 files
- ResponsiveGate: mobile→/home+/charts (phone mimic), desktop→/dashboard — re-evaluates live on resize
- RN popup hardcoded — popupChartConfig.js is vocabulary only, has no effect on behavior
- Auth: web = httpOnly JWT cookie; RN = expo-secure-store

## Previous Significant Sessions (Archived)

Full session write-ups are in `App/handoffFiles/01_upload-and-cache.txt` through `11_manual-review-and-optimisations.txt`. The raw chat transcript is in `App/handoffFiles/chatLog.txt` (~15,500 lines — last resort only).

Historical context that has been distilled into permanent docs:
- Architecture → `context/architecture.md`
- Engineering decisions → `context/decisions.md`
- Known bugs/debt → `context/known-problems.md`
- Failed approaches → `context/failed-solutions.md`
- Constraints → `context/constraints.md`
