---
name: task-done
description: Mini-handoff run automatically after every completed subtask. Records safe-point, updates backlog + current-task + context, syncs DB. No push.
---

Run this after completing any discrete subtask. Exact order, no skipping:

1. **Safe-point** — run `git rev-parse HEAD`, append to `context/revert-state.md`:
   `YYYY-MM-DD | task: <description> | safe-point: <hash> | status: complete`

2. **current-task.md** — move the just-completed item from Active to Recently Completed; update any open sub-items or blockers.

3. **backlog.md** — mark the task done (check it off or add ✓); append a one-line progress log row with date + what was done.

4. **context files** — if the task changed architecture, dependencies, decisions, known-problems, or constraints, update the relevant `context/*.md` files now. If nothing changed, skip.

5. **Sync DB** — run `python .ai/sync_context.py`

6. **savings-log.md** — append one line:
   `YYYY-MM-DD | task: <what was done> | SQLite queries: <N> | context docs loaded: <N> | full repo scan avoided: yes/no | notes`

Do NOT commit or push — that is `/ship-main` or `/ship-branch`.
