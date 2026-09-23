# Intelligence System — Setup Guide

---

## Starting fresh in a chat (clear stale context)

Before installing or running anything in a new session, clear the context window:

```
/clear
```

This wipes the conversation history so the hooks and skills load clean on the next message.

---

## One-time machine setup — add the marketplace

Edit `~/.claude/settings.json` (your global Claude Code config, not the project one).
Add the `extraKnownMarketplaces` block so Claude Code knows where the plugin lives:

```json
{
  "extraKnownMarketplaces": [
    {
      "name": "Ideas of Stuff to Learn",
      "url": "https://raw.githubusercontent.com/Ideas-of-stuff-to-learn/claude-intelligence-plugin/main/.claude-plugin/marketplace.json"
    }
  ]
}
```

Do this once per machine. If `~/.claude/settings.json` already has other entries, add the `extraKnownMarketplaces` key alongside them.

---

## Per-project — install the plugin

In a terminal at your project root:

```bash
claude plugin add claude-intelligence
```

This copies the skills and agents into your project's `.claude/` directory. You now have all 13 skills and 4 subagents available in every Claude Code session for that project.

---

## After install — wire and fill the system

Open a Claude Code session in the project, then:

**If the intelligence system is NOT yet in place** (fresh project, or just installed the plugin for the first time):

```
/build-intelligence
```

Claude detects which of three cases applies and handles it automatically:
- Empty project → scaffolds context docs, copies hooks, wires `settings.json`, fills docs from codebase using explorer subagents
- Partial system → audits gaps, adds what's missing, leaves existing content alone
- Different context system → maps your existing docs to the standard schema, confirms with you, migrates

Restart your Claude Code session after this completes so the SessionStart hook fires fresh.

---

**If the intelligence system IS already in place** (returning to a project, resuming after a gap, or after a merge):

```
/catch-up
```

Checks each context doc's staleness marker, spawns targeted subagents only for stale docs, updates and re-stamps them, syncs the DB. Does not touch source code.

---

## Quick reference — skills available after setup

| Skill | When to use |
|---|---|
| `/catch-up` | Start of session, after merge, after a gap |
| `/discuss` | Before coding — plan and align first |
| `/execute` | Run an agreed plan, auto-permissions |
| `/execute-careful` | High-risk task, ask before every action |
| `/task-done` | After every completed subtask |
| `/ship-main` | Explicit: commit + push to main |
| `/ship-branch` | Explicit: commit + push to new branch |
| `/safe-point` | Record a revert anchor before risky work |
| `/ghost-test` | Dry-run a change before writing code |
| `/handoff` | End-of-session ritual |
| `/realign` | Recover working memory after confusion |
| `/audit-context` | Check context docs for drift vs source |
| `/build-intelligence` | Install or repair the system |
