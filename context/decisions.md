# Cashflow2.0 — Engineering Decisions

## Authentication

**Decision:** Web uses httpOnly JWT cookie; RN uses expo-secure-store.  
**Reason:** httpOnly cookies are inaccessible to JS and immune to XSS on web. RN has no cookie jar — expo-secure-store is the standard secure credential store on device.  
**Alternatives:** localStorage (web, rejected — XSS vulnerable); AsyncStorage (RN, rejected — not encrypted).

**Decision:** Flask-JWT-Extended with token revocation via `revoked_tokens` DB table.  
**Reason:** Stateless JWT needs a revocation mechanism for logout and impersonation; DB table is the simplest durable approach given no Redis is in the stack.

## Database

**Decision:** Raw SQL via psycopg2; no ORM.  
**Reason:** The project is small and the query patterns are simple and well-understood. An ORM adds abstraction overhead with no benefit at this scale. Schema is fully documented in `schema.sql`.  
**Tradeoff:** No migration framework — schema changes are applied by hand. Acceptable for the current user scale.

**Decision:** `dedup_key` per transaction for idempotent re-upload.  
**Reason:** Users may re-upload the same bank statement. Deduplication at insert time means re-upload is always a safe no-op.

## Categorization Pipeline

**Decision:** Tiered pipeline (exact → merchant → fuzzy → LLM → manual) rather than always using LLM.  
**Reason:** LLM calls are slow and cost money. Cheaper tiers handle the majority of repeat transactions (same merchants, same descriptions) before reaching Gemini. Over time the exact-match tier (user's own history) grows and LLM calls decrease.

**Decision:** `NEEDS_MANUAL_REVIEW` is a sentinel string, not a DB category row.  
**Reason:** Avoids polluting the real category list with a system state. The sentinel is checked by string equality in both frontend and backend.  
**Risk:** Sentinel is defined in three separate files that must be kept in sync manually (see known-problems.md).

**Decision:** Manual review picks batched client-side into a ref array, flushed as a single API call on completion.  
**Reason:** N individual API calls for N picked transactions was slow and created partial-state risk if the user closed the tab mid-review. One flush is atomic from the server's perspective.

**Decision:** "Put in Other" uses a single SQL `UPDATE ... WHERE category = NEEDS_MANUAL_REVIEW`, not a per-item loop.  
**Reason:** Performance. Moving all unreviewed transactions to "Other" in one query is O(1) vs O(n) round trips.

**Decision:** `pagehide` + `navigator.sendBeacon` safety net to resolve remaining NEEDS_MANUAL_REVIEW on tab close.  
**Reason:** If the user closes the tab mid-review, unflushed picks are lost. The beacon fires the "resolve remaining to Other" endpoint as a best-effort save. Note: in-flight unflushed picks are still lost; only fully-staged-but-not-flushed items are protected.

## Frontend Architecture

**Decision:** Shared `App/shared/` utils module, but per-platform duplicate copies of some files also exist.  
**Reason:** Metro bundler (RN) needs a special resolver alias to import from outside the RN project directory. The alias is configured in `metro.config.js`. Duplicates exist for files that were easier to copy than alias.  
**Tradeoff:** Manual sync required when shared constants change.

**Decision:** Chart popup placement and interaction mode centralized in `popupChartConfig.jsx` (web) / `popupChartConfig.js` (RN).  
**Reason:** Previously the popup variant was hardcoded per-component. Centralizing it allows toggling between `none` / `floatingInChart` / `modalInChart` / `belowChart` in one place.  
**Status:** Fully wired on web. RN file exists as vocabulary reference only — popup is still hardcoded in `ChartWindowSection.js`.

**Decision:** FilterPane is a single combined component (category checkboxes + drag-to-reorder) rather than two separate components.  
**Reason:** The two lists were always shown together and shared the same data. Merging them reduced prop-drilling and eliminated duplication.  
**Web implementation:** Native HTML5 drag-and-drop.  
**RN implementation:** PanResponder (reorder fires on release, not animated live — see known-problems.md).

**Decision:** ContentsScreen uses a sidebar layout (category filter left, transaction table right) instead of top horizontal chip row.  
**Reason:** The horizontal chip row overflowed on wide screens and wasted horizontal space. The sidebar scales better with many categories and aligns filter controls with the content they affect.

**Decision:** Layout.jsx uses a 3-column CSS grid header (left / center / right) for all routes.  
**Reason:** Ensures the Owner badge is always anchored top-right regardless of what content appears on the left. Prevents the badge from floating left when no left-side element exists.

## Permissions

**Decision:** Three-tier role hierarchy (owner > admin > user) enforced via `@require_permission` decorator.  
**Reason:** Owner is the single superuser, admin manages users and some data, user has read/upload access. Decorator pattern keeps authorization logic out of route handlers.

**Decision:** `user_permission_overrides` table for per-user exceptions.  
**Reason:** Allows granting or revoking specific permissions on individual users without changing their role.

## Local Dev

**Decision:** `start-all.bat` auto-detects LAN IP and generates config files.  
**Reason:** Mobile devices on the same LAN need to reach the dev backend by IP, not localhost. Auto-detection avoids manually editing IP addresses when switching networks.  
**Constraint:** Generated files (`App/.env`, `App/NativeAppUI/generatedLocalConfig.js`) must not be hand-edited — they are overwritten on each launch.

## CI/CD

**Decision:** DB backup and keep-alive as separate GitHub Actions workflows that auto-commit log files.  
**Reason:** Supabase free tier pauses inactive databases. The keep-alive ping prevents this. The backup provides a nightly safety net. Auto-committed log files (`DBbackupLog.txt`, `DBaliveLog.txt`) give a visible audit trail without any external dashboard.

## Documentation

**Decision:** `context/overview.html` is the client/developer-facing progress report; it follows a milestone structure and is only updated at the end of substantial tasks when explicitly asked.  
**Reason:** Keeps developer-facing docs separate from AI-facing engineering context. The HTML file is curated and not a dump of raw session notes.
