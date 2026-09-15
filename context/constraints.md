# Cashflow2.0 — Constraints

Hard invariants. Violations cause bugs, data inconsistency, or security issues.

## UI / Layout

**Owner badge always top-right.**
Layout.jsx 3-column grid header enforces this. The `<RoleBadge />` is always the last child in the header grid and uses `justify-self: end`. Never reposition it.

**Do not read `context/overview.html` unless explicitly told to.**
It's a client-facing progress-report artifact, not coding context. Edit it only at the end of substantial tasks, when asked.

## Data / Logic

**Both sentinels must stay in sync across all 4 files.**
There are TWO sentinel constants:
- `NEEDS_MANUAL_REVIEW = "MANUALLY CATEGORISE"` — user must pick a category; surfaced in manual review flow
- `NOT_YET_CATEGORISED = "NOT YET CATEGORISED"` — timed out / not yet processed; should retry; never shown to user

Both must be identical in all 4 locations:
1. `App/shared/checkingName.js` (canonical)
2. `App/WebUI/src/checkingName.jsx`
3. `App/NativeAppUI/checkingName.js`
4. `App/API/checkingName.py`

Change all 4 or none.

**Re-upload must be a no-op.**
The `dedup_key` mechanism prevents duplicate rows. Do not break it.

**Manual review must use a single flush.**
Picks are batched client-side. One API call when the user finishes manual review. Never per-item API calls.

**Empty `selectedCategories` = show nothing.**
`buildStackData` (web and shared) must show an empty chart when the filter set is empty. Do not add a `size === 0` guard that shows all categories.

**RN popup is NOT config-driven.**
`App/NativeAppUI/config/popupChartConfig.js` exists as vocabulary/reference only. `App/NativeAppUI/components/charts/ChartWindowSection.js` has a hardcoded modal popup. Changing the config file has no effect on behavior.

## Auth / Security

**Web auth must use httpOnly cookie.**
JWT must not be accessible to JavaScript on the web side. No localStorage-based auth.

**RN auth uses expo-secure-store.**
Not cookies. Not localStorage.

## Infrastructure / Build

**Do not hand-edit generated configs.**
`App/.env` and `App/NativeAppUI/generatedLocalConfig.js` are overwritten every time the dev start script runs. Edit the templates/scripts, not the generated outputs.

**Admin CLI always targets production.**
`BASE_URL` in adminClI scripts is hardcoded to `https://cashflow2-0.onrender.com`. Run with intent. Never run bulk-delete or destructive admin operations without owner authorization.

**No automated tests.**
There is no test suite anywhere in the project. Verification is build + visual inspection only. Do not set up a test framework without explicit instruction.

**No ORM.**
Schema changes go directly to Supabase via hand-applied SQL. `App/API/schema.sql` is the source of truth. Do not introduce SQLAlchemy or any migration framework.

**No auto-merge.**
Never auto-merge PRs. The owner manually merges after testing. Do not enable auto-merge via GitHub settings or `gh` commands.

## AI Behavior

**Progress updates are mandatory for every task.**
After each meaningful sub-step (context read, file edit, sync, decision point), output a one-to-two line update in the chat UI with a rough percentage:
`✓ <done> [~X%]` or `→ <next> [~X%]`
Never go silent mid-task. Never front-load the full plan and then execute silently. Applies to small and large tasks equally.

## Routing

**ResponsiveGate owns the mobile/desktop routing split.**
`App/WebUI/src/components/ResponsiveGate.jsx` is the single place that decides mobile→/home+/charts vs desktop→/dashboard. Do not add routing logic to other components that duplicates or overrides this.

## Mobile

**Check Expo SDK 54 docs before any Expo API work.**
`App/NativeAppUI/AGENTS.md` has the warning. Any Expo API change must be verified against `docs.expo.dev/versions/v54.0.0/`.

## State Architecture

**Web AppState is 4 separate contexts, not one.**
`AuthContext`, `ProcessingContext`, `TransactionsContext`, `ChartFilterContext` — composed via `AppStateProvider` in `appState/index.jsx`. Do not conflate them into a single context.

**RN AppState is one combined context.**
`AppContext.js` with `useApp()` hook. This is intentional and mirrors how earlier RN versions were structured — it has not been split like the web.
