"""
Incremental context sync — updates only the context_documents rows whose
Markdown files have changed since the last sync.

Run after editing any context/*.md file:
    python .ai/sync_context.py

This is faster than rebuild_db.py (full rebuild). It only touches the
context_documents table — file index, dependencies, constraints, etc. are
left untouched. Run rebuild_db.py when those change.
"""
import sqlite3, os, hashlib

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH   = os.path.join(os.path.dirname(os.path.abspath(__file__)), "knowledge.db")

# Mapping: context doc name → file path (relative to repo root)
CONTEXT_DOCS = {
    "overview":         "context/overview.md",
    "architecture":     "context/architecture.md",
    "dependencies":     "context/dependencies.md",
    "decisions":        "context/decisions.md",
    "constraints":      "context/constraints.md",
    "known-problems":   "context/known-problems.md",
    "failed-solutions": "context/failed-solutions.md",
    "current-task":     "context/current-task.md",
    "verification":     "context/verification.md",
    "handoff":          "context/handoff.md",
    "realignment":      "context/realignment.md",
    "gitContext":       "context/gitContext.md",
    "revert-state":    "context/revert-state.md",
    "savings-log":     "context/savings-log.md",
    "session-snapshot": "context/session-snapshot.md",
}

def file_hash(path):
    try:
        with open(path, "rb") as f:
            return hashlib.md5(f.read()).hexdigest()
    except FileNotFoundError:
        return None

def main():
    if not os.path.exists(DB_PATH):
        print("knowledge.db not found — run rebuild_db.py first.")
        return

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    # Ensure content_hash column exists (added by this script; rebuild_db may not have it yet)
    try:
        c.execute("ALTER TABLE context_documents ADD COLUMN content_hash TEXT")
        conn.commit()
    except sqlite3.OperationalError:
        pass  # column already exists

    updated = []
    skipped = []
    missing = []

    for name, rel_path in CONTEXT_DOCS.items():
        abs_path = os.path.join(REPO_ROOT, rel_path)
        new_hash = file_hash(abs_path)

        if new_hash is None:
            missing.append(rel_path)
            continue

        row = c.execute(
            "SELECT content_hash FROM context_documents WHERE name = ?", (name,)
        ).fetchone()

        if row is None:
            # Doc not in DB yet — insert it
            c.execute(
                "INSERT INTO context_documents (name, path, updated_at, content_hash) VALUES (?, ?, date('now'), ?)",
                (name, rel_path, new_hash)
            )
            updated.append(f"+ {rel_path} (new)")
        elif row[0] != new_hash:
            # Hash changed — update timestamp and hash
            c.execute(
                "UPDATE context_documents SET updated_at = date('now'), content_hash = ? WHERE name = ?",
                (new_hash, name)
            )
            updated.append(f"~ {rel_path} (changed)")
        else:
            skipped.append(rel_path)

    conn.commit()
    conn.close()

    print(f"Context sync complete.")
    if updated:
        print(f"  Updated ({len(updated)}):")
        for f in updated:
            print(f"    {f}")
    if skipped:
        print(f"  Unchanged: {len(skipped)} docs")
    if missing:
        print(f"  Missing files (not in repo):")
        for f in missing:
            print(f"    {f}")

if __name__ == "__main__":
    main()
