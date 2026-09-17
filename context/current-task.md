# Cashflow2.0 — Current Task

## Status (2026-09-17)

No active task. Clean main branch.

## Recently Completed

**FilterPane order/persist bug fixes (2026-09-17):**
- `useStackOrder.jsx`: hydration effect no longer filters `savedOrder` against `categoryNames` at mount (categoryNames=[] on mount → filtering produced [] permanently, breaking all filter checkboxes on reload). Now sets raw `savedOrder` directly; `effectiveOrder` already filters reactively on every render.
- `FilterPane.jsx`: "Remember this order" and "Reset to default" both now gated on `isCustomOrder`. Previously "Remember this order" was always visible and clickable even on default order.

## Recently Completed

**UserPreferences context + column resize persistence + info popup + delete removal + virtualizer fix (2026-09-16):**
- New `UserPreferencesContext` (5th context, between Auth and Processing)
- Column widths, stack order, MR picks — localStorage → React context → debounced server PUT (2s) + beforeunload keepalive flush
- Single `serverGet()` on login; server authoritative over localStorage
- New backend `App/API/routes/preferences.py` with JSONB partial merge; `preferences JSONB` column on users table
- TableHeader drag-end saves to context + server; applied from context on mount
- Delete button removed from SelectionBar
- ℹ info popup added to Transactions header in Layout.jsx
- Desktop ContentsScreen sidebar scrollbar hidden
- CSS media query synced from 700px → 1023px to match JS `isMobile` breakpoint (1024px)
- `.cs-container` height fixed: `calc(100vh - 48px)` instead of broken `height: 100%` chain — was rendering all 3700+ rows every mount, now virtualizer works correctly and navigation is instant

**Previously (2026-09-15):**

**Persistent Repository Intelligence System (full coverage):**
- `CLAUDE.md` — entry point pointing to `.ai/knowledge.db` and context docs
- `context/architecture.md` — full layer diagram, 4-context AppState split, both sentinels, ResponsiveGate routing, ChartsScreen/HomeScreen roles, RN vs web differences
- `context/constraints.md` — both sentinels in 4 files, RoleBadge position, ResponsiveGate ownership, popup config warning, 4-context invariant
- `context/known-problems.md` — sentinel quadruplication, COLOR_PALETTE triplication, RN popup not wired, no tests
- `context/dependencies.md` — inter-file relationships, context composition chain, sentinel duplication map, routing chain
- `context/decisions.md` — engineering decisions with rationale
- `context/failed-solutions.md` — 10 failed approaches with lessons
- `context/realignment.md` — recovery procedure, never-do list
- `context/handoff.md` — session state
- `context/overview.md` — project purpose and tech stack
- `.ai/rebuild_db.py` — generates SQLite index of all ~150 source files across WebUI, NativeAppUI, API, and shared

**ContentsScreen redesign (2026-09-15):**
- Sidebar layout for ContentsScreen
- Layout.jsx 3-column grid header
- Owner badge always top-right

## Open Work (Not Blocking)

- RN popup wiring: popupChartConfig.js vocabulary exists but ChartWindowSection.js has hardcoded popup
- FilterPane RN drag animation (cosmetic)
- COLOR_PALETTE triplication (adminClI/web/RN can drift)
- Root README.md placeholder

## Next Session Guidance

Start with realignment.md → overview.md → architecture.md. Key non-obvious things to know:
1. Web AppState = 4 separate contexts (not one) — `appState/index.jsx` composes them
2. Two sentinels, not one: NEEDS_MANUAL_REVIEW (user picks) + NOT_YET_CATEGORISED (retry, hidden from user)
3. ResponsiveGate: mobile→/home+/charts, desktop→/dashboard — re-evaluates live on resize
4. ChartsScreen.jsx at /charts is the "phone mimic" for mobile-width web users
5. RN uses single AppContext.js (useApp hook) — not split like web
6. RN popup is hardcoded — popupChartConfig.js has no effect there
