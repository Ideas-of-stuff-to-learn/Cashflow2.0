---
name: build-intelligence
description: Install the intelligence system into this repo — create context/*.md, AGENTS.md, .ai/ scripts, and SQLite. Run once on a fresh repo or in fill-in mode on a template clone.
disable-model-invocation: true
---

You are running the `/build-intelligence` skill. Follow these steps exactly.

## Step 1 — Detect mode

Check whether `context/overview.md` already has content (template fill-in mode) or is absent/empty (fresh install mode). Announce which mode you are in.

## Step 2 — Survey the codebase with explorer subagents

Spawn one `explorer` subagent per major area of the codebase (e.g. backend, frontend, mobile, shared utils, infra). Each subagent receives:
- The area name and the relevant file paths/globs to scan
- A task to return: a draft of what belongs in the relevant `context/*.md` sections for that area

Collect all survey results before writing any files.

## Step 3 — Write context documents

Using the survey results, fill in each `context/*.md` skeleton:
- `realignment.md` — recovery map, load order, active task pointer
- `overview.md` — purpose, tech stack, subsystems
- `architecture.md` — layers, data flows, component responsibilities
- `constraints.md` — hard invariants discovered during survey
- `dependencies.md` — key file-to-file dependencies and call chains
- `decisions.md` — engineering decisions inferred from code patterns
- `known-problems.md` — debt, TODO comments, known fragile areas
- `verification.md` — build steps and dev server commands (read package.json / Makefile / README)
- `gitContext.md` — fill from `git remote get-url origin`, default branch

Do NOT fill `handoff.md`, `current-task.md`, `revert-state.md`, `savings-log.md`, `failed-solutions.md` — these are populated by session activity.

## Step 4 — Build SQLite

Run: `python .ai/rebuild_db.py`

If the script doesn't exist, copy it from the template (see §67). Confirm it prints "knowledge.db rebuilt successfully."

## Step 5 — Verify .gitignore hygiene (§68)

Check `.gitignore`. It must NOT have a blanket `.claude/` entry. It must have:
```
.claude/settings.local.json
.claude/**/*.local.*
```

Fix if needed.

## Step 6 — Hand off

Tell the user:
- The system is installed
- From now on, use `/realign` at the start of each session
- Use `/safe-point` before touching code
- Use `/ghost-test` before making changes
- Use `/handoff` before ending each session
- Use `/audit-context` when context feels stale
