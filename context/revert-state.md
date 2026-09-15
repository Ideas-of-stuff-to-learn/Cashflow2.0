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
