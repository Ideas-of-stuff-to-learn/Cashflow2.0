# Cashflow2.0 — Handoff

## Status (2026-09-17)

No active task. Clean main branch.

## What Was Just Done

**Dashboard layout + info pages (2026-09-17):**
- `ChartFootnote` removed from inline position in Dashboard and ChartsScreen; moved into a modal popup triggered by a "User Information" pill button in the header center column (dashboard + charts routes)
- New `FootnoteModal` in `Layout.jsx` renders `<ChartFootnote />` inside a styled overlay; keeps nth-child bold/red rules via scoped CSS in `Layout.css`
- "🔒 Data Security" pill added next to "User Information" — navigates to `/data-security`
- New `DataSecurityScreen.jsx` — full JSX port of `docs/data-security.html` with back button (`navigate(-1)`); own CSS in `dataSecurityStyles.css`; route wired in `App.jsx` outside `<Layout />`
- `html, body` reset (`overflow: hidden; height: 100%; margin: 0`) kills browser scrollbar at root
- `app-shell` changed from `min-height: 100vh` to `height: 100vh; overflow: hidden` — true viewport lock
- `#root { padding-top: 10px }` adds breathing gap between viewport top and header
- Footer border removed (legal links visually cleaner at bottom)
- `dashboard-flex`: `align-items: stretch; flex: 1; min-height: 0` — fills full content height
- `dashboard-home-box`, `dashboard-main`, `dashboard-charts-box`: flex column, stretch to full height
- FilterPane: `position: sticky` + `align-self: flex-start` removed — now stretches with flex row
- `dashboard-chart-area`: `display: flex; flex-direction: column` — enables nav row push
- `.dashboard-chart-area .window-nav-row { margin-top: auto; margin-bottom: -4px }` — nav arrow bottom-aligns with Log Out and filter pane bottom edge
- `BASE_CHART_HEIGHT` bumped 170 → 270 in `SpendingStackedChart.jsx` — chart fills more of the available space
- All `calc(100vh - Npx)` values updated: cs-container → 89px, chartStyles sidebar → 89px

## What Was Just Done

**Manual review UX + stats fixes (2026-09-17):**
- `ManualReviewStatsModal.jsx`: decimal percentage display (e.g. `0.40%`); ≥1% whole number
- `ManualReviewGate.jsx`: optimistic exit with race pattern — instant close if server < 400ms, spinner fallback if slow, error screen if both retries fail; "All done!" path fully optimistic with 900ms close delay
- `ManualReviewSequentialModal.jsx`: small centered saving card, spinner + checkmark, full flushing/exitFailed framework kept for future use
- `categorisation_routes.py`: `/categorize/resolve-and-exit` — picks + remaining-to-Other in one transaction
- `api.jsx`: `resolveAndExit()` added
- `tasks/backlog.md`: task 17 added (owner admin page, P4)
- Test SQL: `_mr_test_backup` table + parameterised flip/restore query

**FilterPane order/persist bug fixes (2026-09-17):**
- `useStackOrder.jsx`: hydration effect no longer filters `savedOrder` against `categoryNames` (empty on mount). Sets raw saved order directly; `effectiveOrder` filters reactively.
- `FilterPane.jsx`: "Remember this order" and "Reset to default" both gated on `isCustomOrder` (previously "Remember this order" always showed).
- `UserPreferencesContext.jsx`: added `flushNow()` — cancels debounce and immediately PUTs to server. Exposed from context.
- `useStackOrder.jsx`: `togglePersist` and `resetOrder` both call `flushNow()` so the DB write is guaranteed before a reload, not dependent on the 2s debounce or `beforeunload`.

Root cause of "filters disappear on reload": server had stale `stackPersist: false` (debounce hadn't fired before reload), server hydration on reload overwrote localStorage `stackPersist: true` with `false`, causing `useStackOrder` to treat order as non-persisted.

---

## Status (2026-09-16)

No active task. Pending push to main.

## What Was Just Done

**UserPreferences context + column resize persistence + info popup + delete removal** (2026-09-16):

- **New file: `App/WebUI/src/appState/UserPreferencesContext.jsx`** — unified preferences context consolidating column widths, stack order, stack persist flag, and manual review picks. Reads from localStorage on mount, hydrates from server on login (server is authoritative), and debounces server PUT (2s after last change).
- **New file: `App/API/routes/preferences.py`** — `GET /preferences` + `PUT /preferences` (JWT required). Partial JSONB merge via `||` operator so only changed keys are overwritten.
- **`App/API/schema.sql`** — added `ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb`.
- **`App/API/backend.py`** — added `import routes.preferences`.
- **`App/WebUI/src/api.jsx`** — added `getPreferences()` and `putPreferences(patch)`.
- **`App/WebUI/src/appState/index.jsx`** — added `UserPreferencesProvider` as 2nd level (inside AuthProvider, wrapping ProcessingProvider); exported `useUserPreferences`.
- **`App/WebUI/src/customHooks/charts/useStackOrder.jsx`** — migrated stack order reads/writes to `useUserPreferences` context.
- **`App/WebUI/src/components/manualReview/ManualReviewGate.jsx`** — migrated MR picks reads/writes to `useUserPreferences` context.
- **`App/WebUI/src/appState/TransactionsContext.jsx`** — migrated MR picks reload-flush to `useUserPreferences` context.
- **`App/WebUI/src/components/contents/TableHeader.jsx`** — column resize handles persist widths to context via `setColumnWidths` on drag end; applied saved widths from context on mount; console logs on mount and after drag (DevTools F12 → Console).
- **`App/WebUI/src/components/contents/SelectionBar.jsx`** — removed Delete button and `onDelete`/`deleting` props.
- **`App/WebUI/src/screens/ContentsScreen.jsx`** — removed `onDelete`/`deleting` props from SelectionBar usage.
- **`App/WebUI/src/components/Layout.jsx`** — added ℹ button next to "Transactions" title; clicking it shows `TransactionsInfoModal` explaining page purpose, search, single/bulk category change, column resize, and sort.
- **`App/WebUI/src/styles/Layout.css`** — added `.info-icon-btn`, `.info-modal-overlay`, `.info-modal`, and supporting styles.

**Context chain for provider nesting:** `AuthProvider → UserPreferencesProvider → ProcessingProvider → TransactionsProvider → ChartFilterProvider`

**Preferences sync lifecycle (final):**
- Change → localStorage (instant) + React context (instant) + debounce 2s → server PUT
- `beforeunload` → reads localStorage, cancels debounce, keepalive fetch → server PUT (all 4 keys incl. mrPicks)
- Login (`isLoggedIn` false→true, every page load) → single `serverGet()` → overwrites localStorage + context (server authoritative)
- `BASE_URL` imported from `frontendLocalConfig` directly in UserPreferencesContext (same source as api.jsx)

**ContentsScreen virtualizer fix (2026-09-16):**
- Root cause: `.cs-container { height: 100% }` resolved to `auto` because `.app-shell` uses `min-height: 100vh` not `height: 100vh` — broken height chain meant `useVirtualizer` had no bounded scroll container and rendered all 3700+ rows on every mount
- Fix: `.cs-container { height: calc(100vh - 48px) }` — explicitly bounded, bypasses the broken chain
- The `@media (max-width: 700px)` breakpoint for mobile CSS overrides was mismatched with the JS `isMobile` threshold of 1024px — at 700–1023px, window scroll was used (JS) but desktop CSS applied (no sticky sidebar, no overflow:visible). Fixed by changing media query to `max-width: 1023px`
- Side effect of the height fix: navigation to `/contents` became instant (was rendering all rows = slow mount)

## What Was Just Done (Previously)

**Manual review UX fixes** (2026-09-15, previous session):
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
