# Cashflow2.0 — Constraints

## Hard Constraints

**The Owner badge must always appear in the top-right corner of every screen.**  
The Layout.jsx 3-column grid header enforces this. Never remove or reposition the `<RoleBadge />` element, and never change the header layout in a way that breaks its right-anchor.

**`context/overview.html` must not be read or edited unless explicitly instructed.**  
It is a client/developer-facing progress report, not AI engineering context. It follows a specific milestone structure and should only be updated at the end of a substantial task, when asked.

**Generated local config files must not be hand-edited.**  
`App/.env` and `App/NativeAppUI/generatedLocalConfig.js` are regenerated on every `start-all.bat` run. Manual edits are silently overwritten.

**The `NEEDS_MANUAL_REVIEW` sentinel string must remain consistent across all three definitions.**  
`App/shared/checkingName.js`, `App/NativeAppUI/checkingName.js`, `App/WebUI/src/checkingName.jsx` — any change to the sentinel value must be applied to all three files simultaneously.

**Admin CLI always talks to the production backend.**  
`App/adminClI/adminCliCommon.py` has `BASE_URL` hardcoded to `https://cashflow2-0.onrender.com`. Do not run admin CLI scripts when the intention is to test against local data without first changing this constant (and changing it back afterward).

**No automated test suite exists anywhere.**  
There are no unit tests, integration tests, or test scripts in the Flask backend, Web UI, or RN app. Verification is manual only (build checks + visual inspection). Do not claim a change is verified purely from test results — they do not exist.

**`App/NativeAppUI/AGENTS.md` carries a live Expo SDK warning.**  
Expo's API surface changed meaningfully around SDK 54. Before writing RN code that touches Expo APIs, check the versioned docs at `docs.expo.dev/versions/v54.0.0/`.

## Behavioral Invariants

**Re-uploading the same bank statement must be a safe no-op.**  
The `dedup_key` mechanism in the upload pipeline ensures this. Do not break deduplication logic.

**Manual review flush must be a single atomic API call, not N per-transaction calls.**  
Picks are batched client-side. The server receives one request. Do not revert to per-item API calls.

**"Put in Other" for all NEEDS_MANUAL_REVIEW must be one SQL UPDATE, not a per-item loop.**  
Performance constraint. The single `UPDATE ... WHERE category = NEEDS_MANUAL_REVIEW` scales to any number of transactions.

**Chart segment visibility: empty selectedCategories set must show nothing, not everything.**  
A previous bug treated empty set as "show all." The fix in `buildStackData.jsx` must not be reverted.

**`App/NativeAppUI/` is the current mobile app directory (renamed from `App/UI/`).**  
All scripts and configs (`start-all.bat`, `start-rn.bat`, `.gitignore`, `metro.config.js`) reference `NativeAppUI`. `App/UI/` no longer exists. Ignore any documentation that references `App/UI` or `App/API/oldCLI`.

## Scope Constraints

**This project is not built for public signup at scale.**  
User management is via admin CLI only. There is no self-registration flow.

**No ORM — schema changes are hand-applied SQL.**  
There is no migration framework. `schema.sql` is the schema source of truth but changes must be applied directly to the Supabase DB.

**No auto-merge of PRs.**  
The owner manually reviews and merges all pull requests. Claude Code must not auto-merge.

## Security Constraints

**Web auth must use httpOnly cookies.**  
The JWT must not be accessible to JavaScript on the web client. Do not move to localStorage or any JS-accessible storage.

**Payment/financial data — no external services receive transaction data except Gemini (LLM tier).**  
Gemini receives transaction descriptions for categorization only, not amounts or identifying user info beyond what's in the description text.
