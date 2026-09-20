# Revert State — Safe Points

A safe-point commit hash is recorded here before every task that touches code.
If something goes wrong mid-session, revert to the recorded hash:

```bash
git reset --hard <hash>   # hard revert — discards all changes since safe-point
git revert <hash>         # soft revert — creates a new commit undoing changes
```

Use `git reset --hard` when the changes are local and not yet pushed.
Use `git revert` when changes have already been pushed to origin.

---

## Log

| Date | Task | Safe-point commit | Status |
|---|---|---|---|
| 2026-09-15 | Intelligence system build | a155128 | complete — no revert needed |
| 2026-09-15 | Manual review reload persistence + exit button | 49c97b1 | complete — no revert needed |
| 2026-09-16 | UserPreferences context, column resize persist, info popup, delete removal | c9c56ad | complete — no revert needed |
| 2026-09-16 | Preferences sync lifecycle, virtualizer height fix, CSS breakpoint sync | c9c56ad | complete — shipping to main |
| 2026-09-16 | Legal pages: /privacy, /terms, /accessibility, /cookies | 33ad764 | complete — no revert needed |
| 2026-09-17 | FilterPane order/persist bugs: remember order visibility, filter wipe on reload, stale buttons after nav | 53bd2ef | complete — no revert needed |
| 2026-09-17 | Manual review: decimal %, optimistic exit, spinner fallback, resolve-and-exit endpoint | 4e9d8f6 | complete — no revert needed |
| 2026-09-17 | Dashboard layout: info popup, data security page, viewport lock, chart height, bottom alignment | 39e4371 | complete — no revert needed |
| 2026-09-20 | App title centralised + renamed, dynamic font scaling (header + home), header flex layout, filter pane spacing/font, mobile pills routing fix, popup mobile scroll | e679c1e | complete — shipping to main |
