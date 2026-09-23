<!-- last-verified: eb0073b 2026-09-23 -->
# Cashflow2.0 — Realignment Map

Use this document when: starting a new session, recovering from context loss, unsure about architecture, or continuing work from another session. It tells you what to retrieve and in what order — it is not itself a complete knowledge dump.

## Step 1: Start with SQLite

Query `.ai/knowledge.db` for the realignment record:
```sql
SELECT * FROM realignment WHERE id = 1;
```
This gives you pointers to all foundational context documents.

## Step 2: Load Foundational Context (always)

Read these in order — each is short:
1. `context/overview.md` — what the project is, subsystems, tech stack
2. `context/architecture.md` — layers, data flows, component responsibilities
3. `context/constraints.md` — hard invariants that must not be violated
4. `context/current-task.md` — what is active right now

## Step 3: Load Task-Specific Context (as needed)

Only load what the current task requires:

| Task area | Read |
|---|---|
| Transaction table / ContentsScreen | `context/dependencies.md` → key files section, then ContentsScreen.jsx |
| Charts / visualization | `context/dependencies.md` → chart flow, then `buildStackData.jsx`, `popupChartConfig.jsx` |
| Auth / JWT / permissions | `context/architecture.md` (Auth section) + `App/API/permissions.py` |
| Categorization pipeline | `context/architecture.md` (Pipeline section) + `App/API/categorise/pipeline.py` |
| Layout / header | `App/WebUI/src/components/Layout.jsx` |
| Mobile (RN) | Read `App/NativeAppUI/AGENTS.md` warning first |
| Admin / CLI | `context/architecture.md` (Admin Flow section) |

## Step 4: Check for Known Gotchas

Before modifying anything, quickly check:
- `context/known-problems.md` — does the area you're touching have a documented problem?
- `context/failed-solutions.md` — has what you're about to try already been attempted and failed?
- `context/decisions.md` — is there an intentional design decision explaining why the code looks the way it does?

## Step 5: Targeted Source Retrieval

Use SQLite dependency queries or direct file reads to get the specific source you need. Do not scan the entire repo.

```sql
-- Find context docs related to a topic
SELECT * FROM context_documents WHERE tags LIKE '%auth%';

-- Find files related to a component
SELECT * FROM files WHERE path LIKE '%categorise%';

-- Find what calls a specific module
SELECT * FROM dependencies WHERE target LIKE '%buildStackData%';
```

## Step 6: Load Handoff Only If Continuing Active Work

`context/handoff.md` — only needed if you're continuing a multi-session task or need to know what was recently changed and why.

## How to Determine Currency

- Current source code beats documentation when they conflict
- `git log --oneline -10` shows what actually changed recently
- Bot commits (`Backup log:`, `Keep-alive ping:`) can be ignored
- If docs and code disagree: investigate, then update docs

## Where Historical Knowledge Lives

- Full session write-ups: `App/handoffFiles/01_...` through `11_...`
- Raw chat transcript: `App/handoffFiles/chatLog.txt` (15,500 lines — last resort only)
- Distilled knowledge: `context/architecture.md`, `context/decisions.md`, `context/known-problems.md`, `context/failed-solutions.md`

## Recovery When Information Conflicts

1. Read current source code
2. Run `git log --oneline -- <file>` to see recent changes to that file
3. Treat current source as authoritative
4. Update the relevant context doc if it's stale

## Quick Reference: Never Do These

- Don't move Owner badge from top-right
- Don't read `context/overview.html` unless explicitly told to
- Don't hand-edit `App/.env` or `App/NativeAppUI/generatedLocalConfig.js`
- Don't change NEEDS_MANUAL_REVIEW or NOT_YET_CATEGORISED sentinel in fewer than all 4 files (shared/web/RN/Python)
- Don't run admin CLI scripts against production without intent
- Don't auto-merge PRs
- Don't describe web AppState as a single AppContext — it's 4 split contexts (Auth/Processing/Transactions/ChartFilter)
- Don't assume RN popup follows popupChartConfig.js — it's hardcoded in ChartWindowSection.js
