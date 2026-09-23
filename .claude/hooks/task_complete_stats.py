"""
task_complete_stats.py — called by /task-done and /execute at task completion.
Prints a completion summary block to stdout (injected into Claude's context):
  - Files changed (git diff vs last commit or vs base ref)
  - % impact: files changed / total source files
  - Lines added/removed
  - Importance flags (touched critical areas?)
  - One-line opinion

Can be run directly: python .claude/hooks/task_complete_stats.py [base_ref]
base_ref defaults to HEAD~1 (last commit). Pass a commit hash to compare further back.
Fails open — always exits 0.
"""
import sys, os, subprocess, json

IMPORTANT_PATTERNS = [
    ("auth",        ["App/backend/auth.py", "App/backend/routes/auth_routes.py"]),
    ("pipeline",    ["App/backend/categorization_pipeline.py", "App/backend/ml_categorizer.py"]),
    ("schema/DB",   ["App/backend/schema.sql", "App/backend/database.py"]),
    ("routes",      ["App/backend/routes/", "App/WebUI/src/App.jsx"]),
    ("billing",     ["App/backend/routes/billing", "stripe"]),
    ("mobile",      ["App/NativeAppUI/"]),
    ("context/AI",  ["context/", ".claude/", ".ai/"]),
]

SOURCE_EXTENSIONS = {".py", ".jsx", ".tsx", ".ts", ".js", ".sql", ".json", ".md"}
SOURCE_EXCLUDE = {"node_modules", ".git", "__pycache__", "dist", "build", ".expo"}


def count_source_files(proj):
    total = 0
    for root, dirs, files in os.walk(proj):
        dirs[:] = [d for d in dirs if d not in SOURCE_EXCLUDE]
        for f in files:
            if any(f.endswith(ext) for ext in SOURCE_EXTENSIONS):
                total += 1
    return total


def get_diff_stats(proj, base_ref):
    try:
        stat = subprocess.run(
            ["git", "diff", "--stat", base_ref, "HEAD"],
            capture_output=True, text=True, cwd=proj
        )
        name_only = subprocess.run(
            ["git", "diff", "--name-only", base_ref, "HEAD"],
            capture_output=True, text=True, cwd=proj
        )
        # Also include uncommitted changes
        unstaged = subprocess.run(
            ["git", "diff", "--name-only"],
            capture_output=True, text=True, cwd=proj
        )
        staged = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            capture_output=True, text=True, cwd=proj
        )
        committed_files = [f for f in name_only.stdout.strip().splitlines() if f]
        uncommitted_files = [f for f in (unstaged.stdout + staged.stdout).strip().splitlines() if f]
        all_files = list(set(committed_files + uncommitted_files))
        return stat.stdout.strip(), all_files
    except Exception as e:
        return f"(git unavailable: {e})", []


def flag_important(changed_files, proj):
    flags = []
    for label, patterns in IMPORTANT_PATTERNS:
        for pattern in patterns:
            if any(pattern.lower() in f.lower() for f in changed_files):
                flags.append(label)
                break
    return flags


def one_line_opinion(changed_files, flags, pct):
    if not changed_files:
        return "No source changes detected — context/docs update only."
    parts = []
    if pct > 15:
        parts.append("wide-ranging change")
    elif pct > 5:
        parts.append("moderate-scope change")
    else:
        parts.append("focused change")
    if flags:
        parts.append(f"touching critical areas: {', '.join(flags)}")
    if len(changed_files) > 10:
        parts.append("— review the diff carefully before shipping")
    elif "auth" in flags or "schema/DB" in flags:
        parts.append("— auth/DB changes: run /verifier and test manually before shipping")
    else:
        parts.append("— looks self-contained")
    return " ".join(parts).capitalize() + "."


def main():
    proj = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
    base_ref = sys.argv[1] if len(sys.argv) > 1 else "HEAD~1"

    stat_output, changed_files = get_diff_stats(proj, base_ref)
    total_files = count_source_files(proj)
    n_changed = len(changed_files)
    pct = round((n_changed / total_files) * 100, 1) if total_files > 0 else 0
    flags = flag_important(changed_files, proj)
    opinion = one_line_opinion(changed_files, flags, pct)

    print("\n" + "=" * 60)
    print("TASK COMPLETE — Impact Summary")
    print("=" * 60)
    print(f"Files changed:   {n_changed} of {total_files} source files ({pct}%)")
    if changed_files:
        for f in changed_files[:10]:
            print(f"  • {f}")
        if len(changed_files) > 10:
            print(f"  … and {len(changed_files) - 10} more")
    print()
    if stat_output:
        # Extract summary line (last non-empty line of git diff --stat)
        summary_line = [l for l in stat_output.splitlines() if "changed" in l]
        if summary_line:
            print(f"Git diff:        {summary_line[-1].strip()}")
    if flags:
        print(f"Critical areas:  {', '.join(flags)}")
    print(f"\nOpinion: {opinion}")
    print("=" * 60 + "\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
