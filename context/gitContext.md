# Cashflow2.0 — Git Context

## Repository

```yaml
upstream: https://github.com/Ideas-of-stuff-to-learn/Cashflow2.0.git
base_branch: main
auto_merge: false
```

## Current Workflow

The project owner pushes directly to `main` for most changes (no PR required unless the owner explicitly requests one). Claude Code follows the owner's direction: implement locally, build to verify, then push to main when the owner says "push" or equivalent.

Do NOT auto-merge anything. Do NOT open a PR unless the owner explicitly asks for one.

## Commit Attribution

All commits must end with:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

## Branch Naming (if a branch is ever requested)

```
ai/<short-description>
```
Example: `ai/fix-auth-refresh`

Only create a branch if the owner explicitly requests it. Default is direct-to-main.

## Automated Bot Commits

Two GitHub Actions workflows auto-commit to main:
- `supabase-backup.yml` → appends to `DBbackupLog.txt` (nightly)
- `supabase-keep-alive.yml` → appends to `DBaliveLog.txt` (nightly/periodic)

These bot commits appear in `git log` with messages like `"Backup log: SUCCESS (2026-09-12 07:49 UTC)"`. They are not human changes.

## Pre-Push Checklist

1. `npm run build` passes in `App/WebUI/`
2. No unintended files staged (check `git status`)
3. Commit message describes the actual change (not just "update files")
4. `git pull --rebase` before push if behind origin (stash changes first if needed)

## Key Branches

- `main` — the only permanent branch; all work lands here

## GitHub Actions

| Workflow | Trigger | Effect |
|---|---|---|
| `autoDeployFrontend.yml` | Push to main | Deploys web frontend |
| `supabase-backup.yml` | Nightly schedule | `pg_dump` → artifact + `DBbackupLog.txt` commit |
| `supabase-keep-alive.yml` | Periodic schedule | Ping DB + `DBaliveLog.txt` commit |
