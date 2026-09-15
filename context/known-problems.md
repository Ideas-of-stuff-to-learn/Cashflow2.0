# Cashflow2.0 — Known Problems

## Backend

**No automated tests anywhere.**  
Flask API, categorization pipeline, and permission logic have zero test coverage. All verification is manual. Risk: silent regressions are possible on any change to pipeline or auth logic.

**No ORM / no migration framework.**  
Schema changes are hand-applied to Supabase. No rollback mechanism. If a bad migration runs, recovery requires manual SQL.

**Admin CLI BASE_URL hardcoded to production.**  
`App/adminClI/adminCliCommon.py` always targets `https://cashflow2-0.onrender.com`. No env var or flag to redirect to local dev. Running admin scripts in development requires manually changing and then reverting this constant.

**Sample/scratch CSVs committed inside the API directory.**  
`App/API/categorised.csv` and `App/API/TransactionHistory.csv` appear to be working/scratch data rather than structured test fixtures. They are not referenced by any test (since tests don't exist).

## Admin CLI

**`COLOR_PALETTE` is manually duplicated in three places.**  
`App/adminClI/adminCliCommon.py` duplicates the palette from `App/WebUI/src/utils/charts/chartUtils.jsx` and `App/NativeAppUI/utils/charts/chartUtils.js`. The comment in `adminCliCommon.py` even references a stale path (`App/utils/charts/chartUtils.js`). No sync mechanism exists — they can drift silently.

**Inconsistent package structure in adminClI.**  
`adminClI/categories/` and `adminClI/permissions/` lack `__init__.py`. `adminClI/colours/` and `adminClI/users/` have one. Not breaking (Python 3 namespace packages), but inconsistent.

## Web UI

**No TypeScript, no automated tests.**  
Large components (chart windowing, manual review flow, FilterPane, ContentsScreen) have no test coverage.

**NEEDS_MANUAL_REVIEW sentinel is duplicated in three files.**  
`App/shared/checkingName.js`, `App/NativeAppUI/checkingName.js`, `App/WebUI/src/checkingName.jsx`. Changing the sentinel in one place without updating the others breaks the entire review flow silently.

**`App/WebUI/README.md` is the default Vite template.**  
Not project-specific. Ignore it.

## Mobile (App/NativeAppUI)

**RN chart popup is not config-driven.**  
`App/NativeAppUI/config/popupChartConfig.js` declares the four popup-placement names for vocabulary consistency, but `ChartWindowSection.js` has a fully hardcoded modal-with-backdrop-dismiss implementation that does not read the config. Changing `POPUP_VARIANT` in the config file has no effect on RN behavior. Wiring it up (and defining what "floating" or "below chart" means on a touchscreen) is unstarted work.

**FilterPane drag-to-reorder is not animated on RN.**  
The custom `PanResponder` implementation reorders on finger release, not live under the finger. `react-native-gesture-handler` + `react-native-reanimated` are already installed and could provide a fully animated version if that polish is wanted.

**Expo SDK 54 API surface warning.**  
`App/NativeAppUI/AGENTS.md` explicitly warns that Expo's API changed around SDK 54. Check `docs.expo.dev/versions/v54.0.0/` before touching any Expo-specific API in the RN app.

## Cross-Cutting

**Root README.md is a placeholder.**  
`README.md` at repo root contains only `# Cashflow2.0` (13 bytes). Not a problem to ship with, but misleading to anyone landing on the GitHub page.

**`App/handoffFiles/chatLog.txt` is a raw 15,500-line session transcript.**  
Not a reading assignment. Only useful as a last-resort dig for historical context. Do not process it unless specifically needed.

**`pagehide` + `sendBeacon` safety net has a gap.**  
If the user has submitted picks (batched in the client ref) but the flush API call is still in-flight when they close the tab, those in-flight picks are lost. The beacon only protects fully-staged but not yet flushed items. This is an accepted limitation.
