# Cashflow2.0 — Current Task

## Status (2026-09-15)

No active task. Clean main branch.

## Recently Completed

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
