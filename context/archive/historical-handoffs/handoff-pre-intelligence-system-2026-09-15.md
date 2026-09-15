# Cashflow2.0 — Handoff / Technical Context

## Purpose

Cashflow2.0 is a personal-finance transaction tracker built for an individual/small set of users (owner/admin/user roles exist, so it's multi-user-capable but not built for public signup at scale). A user uploads bank statement exports (CSV or Excel), the backend deduplicates and auto-categorizes every transaction, and both a web app and a mobile app visualize spending by category over time (monthly/yearly bar charts) alongside a searchable, filterable transaction table.

The categorization pipeline is the core value proposition: rather than requiring the user to manually tag every transaction, the backend tries progressively more expensive matching strategies (exact history match, merchant name match, fuzzy similarity, then an LLM) before giving up and asking the user directly. This is meant to minimize manual review load over time as the user's own transaction history grows.

## Tech stack

- **Backend**: Python 3.13, Flask 3.1, Flask-JWT-Extended (auth + refresh + revocation), Flask-Limiter, flask-cors, gunicorn (prod). **No ORM** — raw SQL via psycopg2 against Postgres (Supabase-hosted). bcrypt for password hashing. `google-genai` (Gemini) for the LLM categorization tier. rapidfuzz + pyahocorasick + numpy for fuzzy/merchant matching. openpyxl/xlrd for Excel parsing.
- **Web frontend**: React 19 + Vite, react-router-dom v7, recharts, @tanstack/react-virtual (virtualized transaction list). Plain CSS per component/screen. No TypeScript.
- **Mobile frontend** (`App/NativeAppUI/` — renamed from `App/UI/`): Expo SDK 54 / React Native 0.81, @react-navigation, react-native-gifted-charts, react-native-gesture-handler + reanimated (available, used for the drag-to-reorder filter pane — see below), expo-secure-store (token storage), expo-document-picker/file-system.
- **Shared code**: `App/shared/` (small JS utils, e.g. the `NEEDS_MANUAL_REVIEW` sentinel constant), wired into RN via a metro.config.js resolver alias. Note: per-platform duplicate copies of some shared modules also exist (`App/NativeAppUI/checkingName.js`, `App/WebUI/src/checkingName.jsx`) — check both if editing shared constants.
- **Notably absent**: no automated test suite anywhere (no jest/vitest, no test files, no test scripts in either package.json); no ORM/migration framework (schema changes are hand-edited SQL); no TypeScript; no CI test gate (GitHub Actions only handles deploy + DB backup/keep-alive).
- **CI/CD**: GitHub Actions — `autoDeployFrontend.yml` (deploy), `supabase-backup.yml` (nightly `pg_dump`, artifact + commit to `DBbackupLog.txt`), `supabase-keep-alive.yml` (pings DB to prevent free-tier sleep, logs to `DBaliveLog.txt`).
- **Local dev**: `start-all.bat` auto-detects the LAN IP, generates `App/.env` and `App/NativeAppUI/generatedLocalConfig.js`, and launches backend + Vite + Expo each in their own terminal. `start-web.bat` / `start-rn.bat` run a single platform. Generated config files should not be hand-edited.
- **Admin tooling**: `App/adminClI/` — standalone Python CLI scripts for direct DB category/user/permission/colour management, talking to the deployed backend over HTTP (not a direct DB connection) — outside the web app entirely. `App/API/oldCLI` does **not** exist despite older documentation referencing it; ignore that path if you see it mentioned in stale notes.

## Data flow / architecture

1. **Upload** — user picks a CSV/Excel file (web: `useFilePicker`/`useFileProcessor`; RN: same hook names under `App/NativeAppUI/customHooks/homescreen`) → sent to the upload endpoint in `App/API/routes/transactions/upload.py` / `uploads.py`.
2. **Parse & dedup** — backend parses rows, computes a `dedup_key` per row, inserts into `transactions` (unique per user + dedup_key), so re-uploading the same statement is a no-op. The source filename is recorded in `uploaded_files` only if it contributed genuinely new rows (this is what powers the "N files uploaded" stat in the UI).
3. **Categorization pipeline** (`App/API/categorise/pipeline.py`, tiered, cheapest first):
   1. Exact match tier (`exact_tier.py`, against `category_records`)
   2. Merchant substring tier (`merchant_tier.py` / `matching/merchants`, Aho-Corasick)
   3. Similarity tier (`similarity_tier.py`, rapidfuzz)
   4. LLM tier (`categorise/llm_tier`, Gemini via `matching/gemini.py`)
   5. Anything left is tagged `NEEDS_MANUAL_REVIEW` — a hardcoded sentinel constant (`App/shared/checkingName.js`), not a real category row.
4. **Manual review gate** — frontend blocks with a two-stage overlay until all `NEEDS_MANUAL_REVIEW` items are resolved: stage 1 (`ManualReviewStatsModal`) offers "Categorise Now" or "Put in Other"; stage 2 (`ManualReviewSequentialModal`) steps through items one at a time. Picks are batched client-side into a ref array and flushed in a single API call on completion (not one call per pick). "Put in Other" hits a dedicated endpoint that does one SQL `UPDATE ... WHERE category = NEEDS_MANUAL_REVIEW`, not a per-item loop. A `pagehide` listener fires `navigator.sendBeacon` to the same "resolve remaining to Other" endpoint as a safety net if the user closes the tab mid-review; in-flight unflushed picks are lost and reappear as `NEEDS_MANUAL_REVIEW` next login.
5. **Global state** — `AppContext.jsx` (web) / `AppContext.js` (RN) hold transactions, categories, chart summary data, the `selectedCategories` filter Set, manual-review-flow state, and auth/role, via React Context + hooks. `api.js`/`api.jsx` wrap `fetch` with client-side timeouts; web auth uses an httpOnly JWT cookie, RN uses expo-secure-store.
6. **Charts** — a charts-summary endpoint returns server-side yearly/monthly aggregates (filtered by indexed `user_id`) → `useChartData`/`useChartWindows`/`useChartFilters` hooks window/shape the data → `buildStackData.jsx` builds stacked-bar segments filtered by `selectedCategories` (empty set = nothing visible) → rendered via recharts (web) or react-native-gifted-charts (RN). Tapping a bar segment opens a popup showing period/category/amount — on web, which of four popup placements (`none` / `floatingInChart` / `modalInChart` / `belowChart`) renders, and whether it's hover- or click/tap-triggered, is centralized in `App/WebUI/src/config/popupChartConfig.jsx` (`POPUP_VARIANT`, `INTERACTION_MODE`) rather than hardcoded per component; RN has an equivalent `App/NativeAppUI/config/popupChartConfig.js` for the same four state names, but RN's actual popup is still its own separate hardcoded modal implementation in `ChartWindowSection.js` — the config file documents the shared vocabulary but isn't wired into RN's popup logic yet (see rough edges).
7. **Transactions table** — `ContentsScreen` + `useContentsData`/`useCategoryFilters`/`useSelectionMode` hooks drive a virtualized (web: react-virtual), searchable, filterable, bulk-recategorizable transaction list, with a `CategoryResolveModal` for manual fixes outside the initial review flow.
8. **Permissions** — `roles` / `permissions` / `role_permissions` / `user_permission_overrides` tables implement an owner > admin > user hierarchy, enforced via `@require_permission` decorators in `permissions.py` and route files. Admin screens/CLI manage roles, users, category actions, impersonation, and JWT revocation (`revoked_tokens`, `impersonation_log` tables).
9. **Backups** — independent of app runtime: nightly GitHub Actions job `pg_dump`s the Supabase DB to an artifact and appends a line to `DBbackupLog.txt`; a separate keep-alive job pings the DB and logs to `DBaliveLog.txt`. Both auto-commit their log files.

## Source layout

```
Cashflow2.0/
├── README.md                    — placeholder only ("# Cashflow2.0")
├── DBbackupLog.txt              — auto-appended nightly backup log (bot-committed)
├── DBaliveLog.txt               — auto-appended keep-alive ping log (bot-committed)
├── start-all.bat / start-web.bat / start-rn.bat  — local dev launchers (LAN IP detection, env generation)
├── Reports/                     — .docx/.pdf writeups (build narrative, engineering report, migration report, App Store deployment guide)
├── .github/workflows/           — autoDeployFrontend.yml, supabase-backup.yml, supabase-keep-alive.yml
└── App/
    ├── .env                     — backend/shared env vars (local, gitignored contents)
    ├── shared/                  — cross-platform JS utils (e.g. NEEDS_MANUAL_REVIEW sentinel)
    ├── adminClI/                — standalone Python admin CLI (category/user/permission/colour management over HTTP)
    ├── handoffFiles/            — 11 numbered chronological engineering session write-ups (01–11) + a full raw chat-log transcript
    ├── API/                     — Flask backend
    │   ├── backend.py           — entrypoint, imports extensions.app + all routes/*
    │   ├── extensions.py        — shared Flask/JWT/limiter app instance
    │   ├── database.py          — DB connection helpers
    │   ├── shared.py            — cross-route helpers
    │   ├── permissions.py       — role/permission check logic
    │   ├── cache.py             — categorization cache tier logic
    │   ├── schema.sql           — full annotated Postgres schema, heavily commented with design rationale
    │   ├── categorise/          — pipeline.py + exact/merchant/similarity/llm tiers
    │   ├── matching/            — categories.py, fuzzy_index.py, gemini.py, similarity.py, merchants/
    │   └── routes/              — auth.py, categories.py, admin.py, charts.py, health.py, uploads.py, transactions/{crud,upload,categorisation_routes,shared_helpers}.py
    ├── NativeAppUI/             — Expo/React Native app (renamed from App/UI) — screens/, components/{charts,contents,homepage,manualReview,dashboard}/, config/, customHooks/, utils/
    └── WebUI/                   — Vite/React web app (src/screens/, src/components/{charts,contents,homepage,manualReview,dashboard,loading}/, src/config/, src/customHooks/, src/utils/)
```

## Key files

| File | Owns |
|---|---|
| `App/API/backend.py` | App entrypoint, route registration |
| `App/API/categorise/pipeline.py` | Categorization tier order/orchestration |
| `App/API/schema.sql` | DB schema + inline design-decision comments |
| `App/API/permissions.py` | Role/permission enforcement |
| `App/WebUI/src/AppContext.jsx` / `App/NativeAppUI/AppContext.js` | Global frontend state |
| `App/WebUI/src/utils/charts/buildStackData.jsx` | Chart segment visibility/filtering logic |
| `App/WebUI/src/config/popupChartConfig.jsx` / `App/NativeAppUI/config/popupChartConfig.js` | Chart segment popup placement + interaction-mode config (web is fully wired; RN is reference-only, see rough edges) |
| `App/WebUI/src/components/dashboard/FilterPane.jsx` / `App/NativeAppUI/components/dashboard/FilterPane.js` | Combined category-selection + drag-to-reorder pane, shared by Dashboard and the phone-mimic charts screen (web) / ChartsScreen (RN) |
| `App/shared/checkingName.js` | `NEEDS_MANUAL_REVIEW` sentinel (also duplicated at `App/NativeAppUI/checkingName.js`, `App/WebUI/src/checkingName.jsx`) |
| `start-all.bat` | Local dev env generation + launch (don't hand-edit its generated output files) |

## Known rough edges

Grouped by which part of the codebase they live in.

### Backend (`App/API`)

- **No automated tests** — no unit/integration tests anywhere in the Flask app; categorization pipeline and permission logic are unverified except by manual testing.
- **No ORM/migrations** — `schema.sql` is the source of truth but changes are applied by hand; there's no migration history or rollback mechanism.
- **Sample/working CSVs committed alongside source** — `App/API/categorised.csv`, `TransactionHistory.csv` live inside the API directory; they read as working/scratch data rather than test fixtures wired into anything, and aren't referenced by any test (since there are none).

### Admin CLI (`App/adminClI`)

- **`BASE_URL` is hardcoded to the production deployment** (`https://cashflow2-0.onrender.com`, in `adminCliCommon.py`) — every admin script always talks to production, with no environment variable or flag to point it at a local backend instead. Testing an admin action safely against local data isn't currently possible without editing this constant by hand.
- **Inconsistent package structure** — `adminClI/categories/` and `adminClI/permissions/` have no `__init__.py`, while `adminClI/colours/` and `adminClI/users/` do. Not breaking (Python 3 namespace packages don't require it), but inconsistent enough to be worth normalizing.
- **`COLOR_PALETTE` is manually duplicated** — `adminCliCommon.py`'s own comment says to keep it in sync with "`App/utils/charts/chartUtils.js`", but that path doesn't exist anymore; the real counterparts are `App/WebUI/src/utils/charts/chartUtils.jsx` and its RN equivalent. The comment itself has drifted, and there's no actual mechanism keeping the three palettes in sync — just a manual reminder.
- **Old documentation reference** — some earlier internal notes call this directory `App/API/oldCLI`; that path does not exist. The CLI has only ever lived at `App/adminClI`.

### Web UI (`App/WebUI`)

- **No automated tests, no TypeScript** — same caveats as the backend; large components (chart windowing, manual review flow, the new combined `FilterPane`) have no test coverage.
- **Duplicate shared constant copies** — `checkingName.js`/`.jsx` exist in three places (`App/shared/`, `App/NativeAppUI/`, `App/WebUI/src/`) instead of one canonical import everywhere; easy to edit one and miss the others.
- **`App/WebUI/README.md` is the untouched default Vite template** — not project-specific; this handoff file is the real documentation.
- **Root `README.md` is a placeholder** (`# Cashflow2.0` only, 13 bytes).

### Native mobile app (`App/NativeAppUI`, renamed from `App/UI`)

- **RN's chart segment popup isn't config-driven yet** — `App/NativeAppUI/config/popupChartConfig.js` declares the same four popup-placement names as the web config for vocabulary consistency, but `ChartWindowSection.js` still has its own separate, hardcoded modal-with-backdrop-dismiss popup implementation rather than reading `POPUP_VARIANT` from that file. Changing the config currently has no effect on RN — it's a documentation/consistency stub, not a wired switch. Wiring it up (and deciding what an RN "floating" or "below chart" variant even looks like on a touchscreen) is unstarted work.
- **Drag-to-reorder uses a custom `PanResponder` implementation, not a library** — `App/NativeAppUI/components/dashboard/FilterPane.js`'s combined category list reorders on release rather than animating the row live under the finger the way the web build's native HTML5 drag-and-drop does. Functionally equivalent, visually less smooth; `react-native-gesture-handler` + `react-native-reanimated` are already dependencies and would allow a fully animated version if that polish is wanted later.
- **`App/NativeAppUI/AGENTS.md` carries a live warning worth respecting**: Expo's API surface changed meaningfully around SDK 54, and the note says to check the versioned docs at `docs.expo.dev/versions/v54.0.0/` before writing RN code that touches Expo APIs. `App/NativeAppUI/CLAUDE.md` is just `@AGENTS.md`.
- **No automated tests**, same as the other two frontends.

### Cross-cutting

- **`App/handoffFiles/chatLog.txt`** is a raw ~15,500-line session transcript, not curated docs — useful only as a last-resort dig, not a reading assignment.

## Prior significant work (from git history and `App/handoffFiles/`)

The project has gone through eleven documented engineering sessions (`App/handoffFiles/01_upload-and-cache.txt` through `11_manual-review-and-optimisations.txt`), each covering a themed chunk of work: initial upload/cache, categorization + charts + delete CLI, month drilldown + login sessions, permissions/roles, a JWT auth bug and its fix (two separate sessions), multiselect + batch charts, chart reorder/scale, a categorization pipeline speedup/restructure, a full web migration (the app was originally RN-only and gained the Vite web frontend in session 10), and manual-review flow optimisation + chart filter fixes + transaction-list virtualization + local dev auto-IP-detection (session 11).

Session 11 specifically fixed: (a) the manual-review sequential-pick flow going from N API calls to 1 batched flush, (b) "Put in Other" going from a per-item backend loop to a single SQL `UPDATE`, (c) a `pagehide`/`sendBeacon` safety net to sweep leftover manual-review items on tab close, and (d) a chart-filter bug where deselecting all categories left every bar visible instead of none (a stale `size === 0` "empty means show all" guard in `buildStackData.jsx` that no longer matched the checkbox-list filter model elsewhere in the app).

**Most recent session** (see `context/overview.html`'s "Since the last major change" for the plain-language version) was a dashboard/charts space-optimization and cross-platform consistency pass:
- Reworked the web Dashboard's layout to fit one viewport without scrolling (moved the page title into the top banner row, tightened header spacing, restructured the CSS so the filter pane, chart area, and page shell each own exactly one legitimate scroll region instead of nested/duplicate ones — including tracking down a genuine CSS spec quirk where pairing `overflow-x: auto` with `overflow-y: visible` silently forces the `visible` axis into `auto` too, which was the source of an unwanted second vertical scrollbar).
- Merged the web Dashboard's separate "Categories" checkbox list and "Stack order" up/down-button list into one combined `FilterPane` component — each row is a checkbox + colour dot + name + a drag handle, reordered via native HTML5 drag-and-drop.
- Centralized the chart segment popup's placement and hover/click interaction mode into `App/WebUI/src/config/popupChartConfig.jsx`, replacing a hardcoded constant.
- Applied the equivalent restructuring to the web phone-mimic `ChartsScreen` (removed a redundant all-time summary chart, reordered filters-above-chart-then-footnote, reused the same `FilterPane` component inline).
- Ported what applied to the actual React Native app (`App/NativeAppUI`): added the missing `ChartFootnote`, replaced its separate category-chips + stack-order-editor components with the same combined `FilterPane` pattern (drag reorder implemented via `PanResponder` instead of HTML5 DnD, since phones have no native drag-and-drop), and removed its own already-unused all-time summary chart files. RN's popup was deliberately **not** rewired to the new config (see rough edges above).
- Renamed `App/UI` to `App/NativeAppUI` for clarity against the web UI, updating every script/config reference (`start-all.bat`, `start-rn.bat`, `.gitignore`) accordingly.
