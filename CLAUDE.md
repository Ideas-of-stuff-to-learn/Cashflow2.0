# Cashflow2.0 — AI Operating Instructions

Personal-finance transaction tracker: users upload bank statement CSV/Excel files, a Flask + Postgres (Supabase) backend runs them through a tiered auto-categorization pipeline (exact match → merchant match → fuzzy similarity → Gemini LLM → manual review fallback), and a React (Vite) web app plus an Expo/React Native mobile app render category-based spending charts and a searchable transaction table.

---

## Persistent Knowledge System

This repository uses a persistent intelligence system. Do not reconstruct project understanding from scratch by scanning the whole repo — use the knowledge system instead.

### Keep the Context Window Light

Query SQLite for exactly what the current task needs — do not load everything upfront, and do not accumulate knowledge in the context window just because it is convenient. This applies continuously throughout every session, not only at the start.

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
| Intelligence system usage | `context/savings-log.md` |
| Revert safe-points | `context/revert-state.md` |

**Ghost test / local verification cleanup:** any temporary files generated during a ghost test or local verification (scratch scripts, test outputs, debug files) must be fully deleted before the task is considered complete. Never commit or leave them in the working directory.

**Before touching any code**, record the current commit hash in `context/revert-state.md`:
```bash
git rev-parse HEAD  # copy this hash into the log
```
Format: `YYYY-MM-DD | task: <description> | safe-point: <hash> | status: in-progress`
Update status to `complete` or `reverted` when done.
If changes are still local: `git reset --hard <hash>`. If already pushed: `git revert <hash>`.

At the end of every session, append one line to `context/savings-log.md`:
```
YYYY-MM-DD | task: <what was done> | SQLite queries: <N> | context docs loaded: <N> | full repo scan avoided: yes/no | notes
```

After updating Markdown, sync to SQLite:
```bash
python .ai/sync_context.py   # fast — only re-syncs changed context/*.md docs
python .ai/rebuild_db.py     # full rebuild — use when file index/deps/constraints change
```

---

## End-of-Session Ritual (Do This Every Time Before Shipping)

Run these steps **in order** — do not skip any, do not reorder:

1. **revert-state.md** — update the in-progress row's status to `complete`
2. **current-task.md** — move active task to "Recently Completed", clear active section, note open work
3. **handoff.md** — prepend a new "What Was Just Done" block with file-level detail and commit hashes; keep older blocks below
4. **backlog.md** — mark any completed tasks `[x]` + strikethrough in the Quick Reference table; add a progress log entry with date, status, overall %, and a one-line note; add a new full task section if a new task was created mid-session
5. **Sync to SQLite** — `python .ai/sync_context.py` (fast sync after context/*.md changes)
6. **savings-log.md** — append one line: date | task | SQLite queries | context docs loaded | scan avoided | notes
7. **Commit everything together** — code commits first (already done during the task), then one `chore:` commit covering all updated context/backlog files, then push. "Ship everything" means the chore commit goes to main too — not just the code changes.

### What "ship everything" means

When the owner says "ship", commit and push:
- All uncommitted code changes (if any remain)
- All updated context files (`context/*.md`)
- Updated `tasks/backlog.md`
- Updated `context/savings-log.md`

Do NOT leave context updates as local-only. They are part of the deliverable.

---

## Backlog Conventions (`tasks/backlog.md`)

- **Task numbering** — sequential integers, never reused. Next task = max existing number + 1.
- **Quick Reference table** — when a task is done, add strikethrough to the title cell: `~~Title~~`
- **Full task section** — when done, add `~~` around the heading and `✅` at the end: `### ~~22 · Responsive modal audit~~ ✅`; add `**Status:** \`[x]\` Done — YYYY-MM-DD` line at the top of the section body
- **Progress log** — one row per work session (even if no tasks completed); keep format: `| Date | Status emoji | ~N% | one-line note |`
- **New task mid-session** — add both the Quick Reference row AND the full section before the "Dependency Order" block; if P4 or lower, put it in the P4 section
- **Dependency Order diagram** — update when a new task has prereqs or unblocks others
- **Overall %** — rough fraction of total task-points done (count `[x]` tasks / total tasks, weight by effort if obvious); this is a pulse not a calculation

---

## Context Reading Efficiency

When starting a session or resuming work, read in this order — stop as soon as you have enough to proceed:

1. `context/handoff.md` — most recent first; tells you exactly what was just done
2. `context/current-task.md` — active task and open work
3. SQLite query for the specific area you're touching — files, deps, constraints
4. Only read architecture/overview/decisions if the task genuinely requires it

**Do not load `context/architecture.md`, `context/overview.md`, or `context/dependencies.md` as a routine warm-up.** They are large. Load them only when you need to understand something they specifically cover.

### Efficient audit pattern

When asked to "peruse the entire app" or "check everything" for a class of issue (e.g. responsive modals, accessibility, colour hardcoding):
1. Glob all relevant file types
2. Read every file — do not sample
3. Make a list of what is fine vs. what needs fixing before touching anything
4. Report the scope searched ("checked all 17 CSS files + 44 JSX components") so the owner knows the coverage
5. Only edit what genuinely has the problem — do not touch things that look fine
6. Ship after owner confirms

---

## Two-Confirm Rule for Substantial Changes

For any change that is large, risky, or hard to reverse — agreeing with the analysis is **not** authorisation to code. Get an explicit second go-ahead ("yes do it", "go ahead", "ship it") before writing code. A single "sounds right" is not enough.

What counts as substantial: new context files, new routes, schema changes, refactoring more than 3 files, anything touching auth, anything the owner hasn't seen in a screenshot yet.

---

## Overview.html Update Rule

`context/overview.html` is developer/client-facing and follows a milestone structure: a sidebar table of contents, a "Since the last major change" section at the top for incremental work, and older content grouped under "Major change" sections below it, newest first. Small refinements get added to the top section instead of editing older milestone text.

When a change is substantial enough to count as its own milestone: promote the existing "Since the last major change" section in place — relabel it "Major change: \<description\>", move it down above the previous top-most "Major change" section (newest-first order), and update its anchor/TOC entry. Then open a new empty "Since the last major change" section at the top. Never create a second parallel section and copy content into it.

---

## Git Workflow

- **Trigger word:** `"ship"` — when the owner says this, commit and push current work
- Direct to `main` by default (no PR unless owner requests one)
- Never auto-merge
- Branch workflow (`ai/<desc>`) only when owner explicitly requests a PR; after merge: `git checkout main && git pull origin main`
- `git pull --rebase` before pushing if behind origin; `git stash -u` first if uncommitted changes exist
- Commit attribution: end all commit messages with `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- Bot commits (`Backup log:`, `Keep-alive ping:`) appear in git log — ignore them
- Full git workflow stored in SQLite: `SELECT workflow, notes FROM git_configuration WHERE id = 1;`

---

## Progress Updates

After each meaningful sub-step of any task — reading context, finishing a file edit, completing a sync, hitting a decision point — write a one-to-two line **visible text message to the user** with a rough overall completion percentage. This must appear as actual chat text the user can read, not as a tool call description or internal label.

```
✓ <what was just done> [~X% complete]
→ <what's next / current step> [~X% complete]
```

- Write these as plain text in the response, before or after tool calls, so the user sees them in the chat UI
- Applies to every task, small or large, including when just reading files or querying SQLite
- Percentage is a rough pulse, not a precise figure; reset or note if scope expands
- Do not front-load a full plan and then go silent — give updates as work progresses
- **For large tasks**: two levels — granular sub-step updates within each phase, **plus** a one-to-two line chunk-complete summary when a major phase finishes (e.g. "✓ Backend changes complete — all 3 files updated [~50%]")

---

## Hard Constraints (Quick Reference)

- **Owner badge must always be top-right** — Layout.jsx 3-column grid enforces this
- **Never read/edit `context/overview.html`** unless explicitly told
- **Never hand-edit** `App/.env` or `App/NativeAppUI/generatedLocalConfig.js`
- **NEEDS_MANUAL_REVIEW sentinel** must be identical in all three files (`App/shared/`, `App/NativeAppUI/`, `App/WebUI/src/`)
- **No automated tests exist** — verification is build + visual only
- **Check Expo SDK 54 docs** before touching any Expo API in `App/NativeAppUI/`
