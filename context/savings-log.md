# Intelligence System — Savings Log

Each entry = one session that used the intelligence system instead of cold-scanning the repo.

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
