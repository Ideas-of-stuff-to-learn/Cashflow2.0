# Installing the Intelligence System in Any Project

Three steps from a completely fresh project (or cleared memory) to a fully wired intelligence system.

---

## Step 1 — Add the marketplace (one-time, global)

Edit `~/.claude/settings.json` (your global Claude Code config — not the project one) and add:

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

This teaches Claude Code where your private plugin marketplace lives. Do this once per machine.

---

## Step 2 — Install the plugin in your project

In a terminal at your project root:

```bash
claude plugin add claude-intelligence
```

This copies the skills and agents into your project's `.claude/` directory. After this step you have all 13 skills and 4 agents available in any Claude Code session for that project.

---

## Step 3 — Run `/build-intelligence`

Open a Claude Code session in the project and type:

```
/build-intelligence
```

Claude will detect which of three cases applies:

| Case | What it does |
|---|---|
| **Empty project** | Scaffolds all context docs, copies hooks, wires settings.json, runs explorer subagents to fill the docs from the codebase |
| **Partial system** | Audits what's missing, adds gaps only, leaves existing content alone |
| **Different context system** | Maps your existing docs to the standard schema, confirms with you, migrates, then fills gaps |

At the end: restart your Claude Code session so the SessionStart hook fires fresh.

---

## That's it

After step 3, every future session in that project will:
- Load your last handoff and active task automatically on session start
- Block edits without a recorded safe-point
- Auto-sync context docs to SQLite on every edit
- Snapshot full context before any context compaction
- Require `/task-done` after each subtask and `/verifier` before declaring done
- Print task-complete stats (files changed, % impact, opinion) after every task

To bring context up to date after a gap or merge: `/catch-up`
To discuss before coding: `/discuss`
To execute with auto-permissions: `/execute`
To execute cautiously: `/execute-careful`
