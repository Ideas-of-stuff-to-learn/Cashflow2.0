# Cashflow2.0 — AI Operating Instructions

Personal-finance transaction tracker: users upload bank statement CSV/Excel files, a Flask + Postgres (Supabase) backend runs them through a tiered auto-categorization pipeline (exact match → merchant match → fuzzy similarity → Gemini LLM → manual review fallback), and a React (Vite) web app plus an Expo/React Native mobile app render category-based spending charts and a searchable transaction table.

---

## Persistent Knowledge System

This repository uses a persistent intelligence system. Do not reconstruct project understanding from scratch by scanning the whole repo — use the knowledge system instead.

### Entry Point

**SQLite database:** `.ai/knowledge.db`

Query it to find what you need:
```sql
-- Recover project context (start here in any new session)
SELECT * FROM realignment WHERE id = 1;

-- Find context docs by topic
SELECT name, path, description FROM context_documents WHERE tags LIKE '%auth%';

-- Find key files by area
SELECT path, description FROM files WHERE tags LIKE '%categorization%';

-- Find what depends on a file
SELECT * FROM dependencies WHERE target LIKE '%pipeline%';

-- Check constraints before modifying anything
SELECT title, description FROM constraints WHERE severity = 'hard';

-- Check if approach has been tried and failed
SELECT title, lesson FROM failed_solutions WHERE area = 'web';
```

### Context Documents (`context/`)

| File | Purpose |
|---|---|
| `context/realignment.md` | **Start here** — recovery map, what to load and in what order |
| `context/overview.md` | Project purpose, subsystems, tech stack |
| `context/architecture.md` | Layers, data flows, component responsibilities |
| `context/constraints.md` | Hard invariants that must not be violated |
| `context/current-task.md` | Active task, recent state |
| `context/dependencies.md` | File-to-file dependencies, call chains |
| `context/decisions.md` | Engineering decisions with rationale |
| `context/known-problems.md` | Known bugs, debt, fragile areas |
| `context/failed-solutions.md` | Previously attempted approaches that failed |
| `context/verification.md` | Build, dev server, and manual verification procedures |
| `context/handoff.md` | Recent changes, open work, notes for next session |
| `context/gitContext.md` | Git repo URL, workflow rules, CI/CD |

**Do NOT read** `context/overview.html` unless explicitly told to. It is a client/developer-facing progress report, not AI engineering context.

---

## Context Degradation Recovery

If you are in a new session, have lost context, are unsure about architecture, or are continuing work from another session:

1. Read `context/realignment.md` — it tells you exactly what to load and in what order
2. Query `.ai/knowledge.db` realignment record for pointers
3. Do NOT scan the entire repository — retrieve only what you need for the task

---

## Updating Durable Knowledge

When you discover something that should persist:

| Discovery | Update |
|---|---|
| Architecture finding | `context/architecture.md` |
| New dependency relationship | `context/dependencies.md` |
| Design decision | `context/decisions.md` |
| Hard constraint | `context/constraints.md` |
| New bug or debt | `context/known-problems.md` |
| Failed approach | `context/failed-solutions.md` |
| Active task state | `context/current-task.md` |
| Session state / recent changes | `context/handoff.md` |

After updating Markdown, sync to SQLite:
```python
python .ai/rebuild_db.py  # if it exists; otherwise update manually
```

---

## Overview.html Update Rule

`context/overview.html` is developer/client-facing and follows a milestone structure: a sidebar table of contents, a "Since the last major change" section at the top for incremental work, and older content grouped under "Major change" sections below it, newest first. Small refinements get added to the top section instead of editing older milestone text.

When a change is substantial enough to count as its own milestone: promote the existing "Since the last major change" section in place — relabel it "Major change: \<description\>", move it down above the previous top-most "Major change" section (newest-first order), and update its anchor/TOC entry. Then open a new empty "Since the last major change" section at the top. Never create a second parallel section and copy content into it.

---

## Git Workflow

- Direct to `main` by default (no PR unless owner requests one)
- Never auto-merge
- `git pull --rebase` before pushing if behind origin
- Commit attribution: end all commit messages with `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- Bot commits (`Backup log:`, `Keep-alive ping:`) appear in git log — ignore them

---

## Hard Constraints (Quick Reference)

- **Owner badge must always be top-right** — Layout.jsx 3-column grid enforces this
- **Never read/edit `context/overview.html`** unless explicitly told
- **Never hand-edit** `App/.env` or `App/NativeAppUI/generatedLocalConfig.js`
- **NEEDS_MANUAL_REVIEW sentinel** must be identical in all three files (`App/shared/`, `App/NativeAppUI/`, `App/WebUI/src/`)
- **No automated tests exist** — verification is build + visual only
- **Check Expo SDK 54 docs** before touching any Expo API in `App/NativeAppUI/`
