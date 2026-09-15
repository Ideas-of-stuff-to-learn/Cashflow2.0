# Cashflow2.0 — Known Problems

Issues that are documented but not yet fixed. Useful before starting work in an area.

## Cross-cutting

**No automated tests anywhere.**
No unit, integration, or end-to-end tests exist in any part of the project (backend, web, RN). Verification is build + visual only. This is the biggest quality risk.

**Two sentinels defined in 4 files with no shared runtime import.**
`NEEDS_MANUAL_REVIEW = "MANUALLY CATEGORISE"` and `NOT_YET_CATEGORISED = "NOT YET CATEGORISED"` are each defined in:
- `App/shared/checkingName.js` (canonical JS)
- `App/WebUI/src/checkingName.jsx`
- `App/NativeAppUI/checkingName.js`
- `App/API/checkingName.py`

The Python backend can't import JS. The RN metro config aliases `App/shared/` but that alias must be maintained. If any of the 4 files drifts, categorization logic silently breaks across platforms.

**`COLOR_PALETTE` triplicated.**
`App/WebUI/src/utils/charts/chartUtils.jsx`, `App/NativeAppUI/utils/charts/chartUtils.js`, and `App/adminClI/colours/setColorAdmin.py` each define or reference the color list independently. If a category color changes in one, it won't match the others.

## Web

**Web AppState often misdocumented as monolithic.**
New sessions or tools sometimes incorrectly document the state as a single `AppContext.jsx`. It is 4 separate contexts: `AuthContext`, `ProcessingContext`, `TransactionsContext`, `ChartFilterContext`.

**sendBeacon gap on tab close.**
If the user closes the browser tab while categorization is still in progress (in-flight batch not flushed), those picks are lost. Only fully-staged items survive. Mitigation is complex; flagged for awareness.

## Mobile (RN)

**RN popup not config-driven.**
`App/NativeAppUI/config/popupChartConfig.js` is vocabulary-only. `ChartWindowSection.js` has a hardcoded modal popup. Changing the config has no visible effect. The web version is fully wired; RN is not.

**FilterPane drag has no live animation.**
RN FilterPane uses PanResponder. Items reorder on finger release, not animated live under the finger. HTML5 DnD on web has smoother behavior. Low priority, cosmetic.

**RN ContentsScreen uses FlatList.**
`ContentsScreen.js` uses FlatList with `CategoryChipRow` (chips above the list) rather than a virtualized sidebar layout like the web version. For very large transaction lists, this may be slower.

## Backend / Admin

**AdminCLI hardcoded to production.**
`BASE_URL` in the admin CLI scripts always points to `https://cashflow2-0.onrender.com`. There is no dev/staging mode. Running any admin script hits the live database.

**No ORM, no migration system.**
Schema changes are hand-applied to Supabase. `schema.sql` is the human-maintained record. There are no rollbacks.

**Scratch CSVs in API dir.**
Test/scratch CSV files may exist in `App/API/`. They are gitignored (`*.csv`) but could confuse file explorers.

## Docs

**Root README is a placeholder.**
`README.md` at the repo root contains only `# Cashflow2.0`. Anyone landing on the GitHub page sees nothing useful.
