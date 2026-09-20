# Intelligence System — Savings Log

Each entry = one session that used the intelligence system instead of cold-scanning the repo.

2026-09-17 | task: dashboard layout, info popup, data security page, viewport lock, chart height, bottom alignment | SQLite queries: 2 | context docs loaded: 4 | full repo scan avoided: yes | resumed from compacted context via handoff.md
2026-09-20 | task: responsive modal/popup audit + dashboard chart spacing | SQLite queries: 0 | context docs loaded: 2 (current-task, handoff via summary) | full repo scan avoided: yes | targeted glob+read of 17 CSS files + 44 JSX components only
2026-09-21 | task: auth & platform architecture design | SQLite queries: 2 | context docs loaded: 3 (handoff, current-task, auth.py read) | full repo scan avoided: yes | discussion-only session; no code changed; auth-design.md created
2026-09-20 | task: app title centralisation, header flex layout, filter pane spacing, mobile pills routing, popup mobile scroll | SQLite queries: 0 | context docs loaded: 4 | full repo scan avoided: yes | resumed from compacted context via handoff.md

Format:
```
YYYY-MM-DD | task: <what was done> | SQLite queries: <N> | context docs loaded: <N> | full repo scan avoided: yes/no | notes
```

---

| Date | Task | SQLite queries | Context docs loaded | Repo scan avoided | Notes |
|---|---|---|---|---|---|
| 2026-09-15 | Build full intelligence system | 0 (first build) | all | n/a | Initial implementation session |
| 2026-09-16 | UserPreferences context, column resize persist, delete removal, info popup | 0 | handoff + current-task | yes | Context recovered from conversation summary |
| 2026-09-16 | Preferences sync lifecycle fixes, virtualizer height fix, CSS breakpoint sync | 0 | handoff + current-task | yes | Continued same session |
| 2026-09-15 | Manual review UX + auth fixes | 3 | architecture, constraints, handoff | yes | SQLite queried for manual review files; no full repo scan needed |
| 2026-09-16 | Legal pages: /privacy, /terms, /accessibility, /cookies | 0 | App.jsx, routes.jsx, Layout.jsx only | yes | Continued from compacted session; all context from summary |
2026-09-17 | task: FilterPane order/persist bug fixes | SQLite queries: 3 | context docs loaded: 4 | full repo scan avoided: yes | useStackOrder hydration fix + FilterPane button visibility fix
2026-09-17 | task: FilterPane persist-to-DB fix (flushNow) | SQLite queries: 0 | context docs loaded: 0 | full repo scan avoided: yes | added flushNow to UserPreferencesContext; togglePersist+resetOrder now write to server immediately
2026-09-17 | task: Manual review UX fixes (decimal pct, optimistic exit, spinner fallback, resolve-and-exit endpoint) | SQLite queries: 0 | context docs loaded: 2 | full repo scan avoided: yes | also marked task 9 complete in backlog
