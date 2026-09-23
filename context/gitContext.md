<!-- last-verified: eb0073b 2026-09-23 -->
# utility-tools — Git Context

## Repository Configuration

```yaml
upstream:      https://github.com/Ideas-of-stuff-to-learn/utility-tools.git
base_branch:   main
branch_prefix: ai/
auto_merge:    false
trigger_word:  "ship"
```

**Trigger word:** When the owner says `"ship"` (or equivalent — "ship it", "ship all", "ship to main"), that is the signal to commit and push the current work.

---

## Workflow

### Normal (default) — direct to main

```text
implement locally
    ↓
npm run build (verify)
    ↓
owner says "push"
    ↓
git add <specific files>
    ↓
git commit -m "..." (with attribution)
    ↓
git pull --rebase (if behind origin)
    ↓
git push origin main
```

Do NOT auto-merge. Do NOT open a PR unless the owner explicitly asks for one.

### Branch workflow — only when owner requests a PR or branch

```text
git checkout main
    ↓
git pull origin main
    ↓
git checkout -b ai/<short-description>
    ↓
implement changes
    ↓
npm run build (verify)
    ↓
git add <specific files>
    ↓
git commit -m "..."
    ↓
git push origin ai/<short-description>
    ↓
gh pr create ...
    ↓
WAIT — owner reviews and merges
    ↓
git checkout main
git pull origin main
```

Never silently work on main when a branch was requested, and never silently work on a branch when direct-to-main is the current mode.

---

## Local vs Remote State

```text
Local:   git checkout main → working copy on disk
Remote:  origin/main       → GitHub

Sync:    git pull --rebase  (fetch + rebase local commits on top)
         git push origin main
```

Always run `git pull --rebase` before pushing if there's a chance the remote has moved (bot commits happen nightly).

If local has uncommitted changes before a pull:
```text
git stash -u
git pull --rebase
git stash pop
```

---

## Commit Attribution

All commits must end with:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

---

## Branch Naming

```
ai/<short-description>
```
Examples: `ai/fix-auth-refresh`, `ai/contents-redesign`, `ai/sentinel-sync`

---

## Automated Bot Commits

Two GitHub Actions workflows auto-commit to main:
- `supabase-backup.yml` → appends to `DBbackupLog.txt` (nightly)
- `supabase-keep-alive.yml` → appends to `DBaliveLog.txt` (nightly/periodic)

These appear in `git log` as `"Backup log: SUCCESS ..."` and `"Keep-alive ping: SUCCESS ..."`. They are not human changes — ignore them when reading history.

---

## Pre-Push Checklist

1. `npm run build` passes in `App/WebUI/`
2. `git status` — no unintended files staged, no secrets
3. Commit message describes the actual change
4. `git pull --rebase` if behind origin

---

## GitHub Actions

| Workflow | Trigger | Effect |
|---|---|---|
| `autoDeployFrontend.yml` | Push to main | Deploys web frontend to Render |
| `supabase-backup.yml` | Nightly schedule | `pg_dump` → artifact + `DBbackupLog.txt` commit |
| `supabase-keep-alive.yml` | Periodic schedule | Ping DB + `DBaliveLog.txt` commit |
