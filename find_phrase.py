#!/usr/bin/env python3
"""
find_phrase.py — search the whole repo for a phrase, starting from any
file/folder path and climbing up to find the repo root automatically.

Run with no arguments, or -h/--help, to see the full menu of options.

Matches are browsed ONE FILE AT A TIME - it never opens everything it
found in one shot. At each file, an interactive menu lets you open
just that one, open several by number, open every remaining match,
skip to the next, or quit at any point.

Opening prefers VS Code (jumping straight to the matched line via
`code -g file:line`), falling back to the OS's default app for that
file type only if the `code` command genuinely isn't on PATH.
"""

import argparse
import os
import re
import shlex
import shutil
import subprocess
import sys

REPO_ROOT_MARKER = ".git"

SKIP_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv", "env",
    "dist", "build", ".expo", ".next", "Pods", ".pytest_cache",
    ".mypy_cache", ".idea", ".vscode",
}

# Bold + italic, for highlighting the exact matched text inside a
# printed line. Reset afterwards so the rest of the line/terminal is
# unaffected. Most modern terminals (Windows Terminal, VS Code's
# integrated terminal, iTerm2, GNOME Terminal) render this fine; older
# ones just show the raw escape codes, which is a harmless degrade.
HIGHLIGHT_ON = "\x1b[1m\x1b[3m"
HIGHLIGHT_OFF = "\x1b[0m"


def find_repo_root(start_path):
    """Climb up from start_path until a folder containing .git is found."""
    current = os.path.abspath(start_path)
    if os.path.isfile(current):
        current = os.path.dirname(current)

    while True:
        if os.path.exists(os.path.join(current, REPO_ROOT_MARKER)):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            raise SystemExit(
                f"Couldn't find a repo root (no '{REPO_ROOT_MARKER}' folder) "
                f"above: {start_path}"
            )
        current = parent


def iter_candidate_files(repo_root, extensions):
    for dirpath, dirnames, filenames in os.walk(repo_root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for filename in filenames:
            if extensions and not any(filename.endswith(ext) for ext in extensions):
                continue
            yield os.path.join(dirpath, filename)


def read_lines(path):
    """Returns the file's lines (keeping line endings) or None if it
    can't be read as text at all."""
    try:
        with open(path, "r", encoding="utf-8", errors="strict") as f:
            return f.readlines()
    except (UnicodeDecodeError, PermissionError, OSError):
        return None


def find_matches(lines, pattern):
    """Returns a list of 1-indexed line numbers where pattern matches."""
    return [i for i, line in enumerate(lines, start=1) if pattern.search(line)]


def highlight(line, pattern):
    """Wraps every match of pattern within line in bold+italic. Applied
    display-only - never touches what's actually written to a file."""
    return pattern.sub(lambda m: f"{HIGHLIGHT_ON}{m.group(0)}{HIGHLIGHT_OFF}", line.rstrip("\n"))


def print_context(rel_path, line_numbers, lines, context, pattern):
    for n in line_numbers:
        start = max(1, n - context)
        end = min(len(lines), n + context)
        print(f"  --- {rel_path}:{n} (+/-{context}) ---")
        for i in range(start, end + 1):
            marker = ">>" if i == n else "  "
            text = highlight(lines[i - 1], pattern) if i == n else lines[i - 1].rstrip("\n")
            print(f"  {marker} {i}: {text}")


def build_diff(lines, pattern, replacement):
    """Returns a list of (line_number, old_line, new_line) for every
    line the replacement would actually change. Nothing is written
    here - purely computes what WOULD happen."""
    diffs = []
    new_lines = list(lines)
    for i, line in enumerate(lines, start=1):
        new_line, n_subs = pattern.subn(replacement, line)
        new_lines[i - 1] = new_line
        if n_subs:
            diffs.append((i, line, new_line))
    return diffs, new_lines


def print_diff(rel_path, diffs, pattern, replacement):
    replacement_pattern = re.compile(re.escape(replacement)) if replacement else None
    for line_no, old_line, new_line in diffs:
        print(f"    line {line_no}:")
        print(f"      - {highlight(old_line, pattern)}")
        new_display = highlight(new_line, replacement_pattern) if replacement_pattern else new_line.rstrip('\n')
        print(f"      + {new_display}")


def write_lines(path, new_lines):
    with open(path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)


def open_in_default_app(path):
    if sys.platform.startswith("win"):
        os.startfile(path)  # noqa: only exists on Windows
    elif sys.platform == "darwin":
        subprocess.run(["open", path], check=False)
    else:
        subprocess.run(["xdg-open", path], check=False)


_VSCODE_CMD = shutil.which("code")


def open_file(path, line=None):
    """Prefers VS Code (jumping straight to the first matched line via
    `code -g file:line`) - falls back to the OS default app only when
    the `code` CLI genuinely isn't on PATH."""
    if _VSCODE_CMD:
        target = f"{path}:{line}" if line else path
        subprocess.run([_VSCODE_CMD, "-g", target], check=False)
    else:
        open_in_default_app(path)


def browse_matches(matches, context):
    """One-at-a-time interactive walkthrough over `matches` (a list of
    dicts: path, rel, line_numbers, lines). Never opens everything in
    one shot on its own - opening anything is always something the
    person explicitly chose from the menu below."""
    print(f"\nFound matches in {len(matches)} file(s):")
    for idx, m in enumerate(matches, start=1):
        plural = "s" if len(m["line_numbers"]) > 1 else ""
        lines_str = ", ".join(str(n) for n in m["line_numbers"])
        print(f"  {idx}. {m['rel']} (line{plural} {lines_str})")

    opener = "VS Code" if _VSCODE_CMD else "your OS's default app for each file type"
    print(f"\nBrowsing one file at a time. Opening uses {opener}.")

    i = 0
    opened = 0
    while i < len(matches):
        m = matches[i]
        print(f"\n=== [{i + 1}/{len(matches)}] {m['rel']} ===")
        print_context(m["rel"], m["line_numbers"], m["lines"], context, m["pattern"])

        print("  [o] open this one   [m] open multiple (by number)   [a] open all remaining")
        print("  [n] next / skip     [q] quit")
        try:
            choice = input("  > ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            print("\nStopping.")
            break

        if choice == "q":
            break
        elif choice == "o":
            open_file(m["path"], m["line_numbers"][0])
            opened += 1
            i += 1
        elif choice == "m":
            try:
                raw = input("  Which file numbers? (e.g. 2,4,5): ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\nStopping.")
                break
            for token in raw.split(","):
                token = token.strip()
                if not token.isdigit():
                    continue
                target_idx = int(token) - 1
                if 0 <= target_idx < len(matches):
                    target = matches[target_idx]
                    open_file(target["path"], target["line_numbers"][0])
                    opened += 1
            i += 1
        elif choice == "a":
            for remaining in matches[i:]:
                open_file(remaining["path"], remaining["line_numbers"][0])
                opened += 1
            break
        else:
            # Anything else (including blank/"n") - just move on.
            i += 1

    print(f"\nOpened {opened} file(s).")


def build_parser():
    parser = argparse.ArgumentParser(
        prog="find_phrase.py",
        description=(
            "Search the whole repo for a phrase, starting from any file/folder "
            "path and climbing up to find the repo root ('.git') automatically."
        ),
        epilog=(
            "Examples:\n"
            '  find_phrase.py "NEEDS_MANUAL_REVIEW"\n'
            '  find_phrase.py "TODO" App/API -i -C 2\n'
            '  find_phrase.py "cat_\\d+" --regex --ext .py\n'
            '  find_phrase.py "oldName" --replace "newName" --dry-run   (preview, file by file, asks before each)\n'
            '  find_phrase.py "oldName" --replace "newName"             (applies everywhere immediately, no prompts)\n\n'
            "How opening files works: matches are browsed ONE AT A TIME, never all at\n"
            "once. At each file you choose: open it, open several by number, open every\n"
            "remaining one, skip to the next, or quit. Opening prefers VS Code (jumping\n"
            "straight to the matched line) and only falls back to the OS's default app\n"
            "for that file type if the 'code' command genuinely isn't on PATH.\n"
            "Pass --no-open to skip browsing entirely and just print the match list.\n\n"
            "Matched text is shown in bold+italic in context lines and diffs."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("phrase", nargs="?", help="The phrase (or, with --regex, the pattern) to search for.")
    parser.add_argument("start_path", nargs="?", default=os.getcwd(), help="File or folder to climb up from (default: current directory).")
    parser.add_argument("-i", "--ignore-case", action="store_true", help="Case-insensitive search.")
    parser.add_argument("--regex", action="store_true", help="Treat the phrase as a regular expression instead of literal text.")
    parser.add_argument("-C", "--context", type=int, default=2, metavar="N", help="Lines of context to show around each match (default: 2).")
    parser.add_argument("--replace", metavar="TEXT", help="Replace every match with TEXT (regex backreferences like \\1 work if --regex is set).")
    parser.add_argument("--dry-run", action="store_true", help="With --replace: preview one file at a time and ask (y/n) before applying each file's changes, instead of applying everywhere immediately.")
    parser.add_argument("--no-open", action="store_true", help="Just print the match list - skip the interactive open-files browser entirely.")
    parser.add_argument("--ext", default=None, help="Comma-separated list of extensions to restrict the search to, e.g. .py,.js")
    return parser


def run_search(args):
    """Runs one full search/replace/browse cycle for a parsed `args`.
    Returns nothing - all output is printed directly, same as before
    this was pulled out of main() to let the REPL loop below call it
    repeatedly without re-launching the whole script each time."""
    extensions = None
    if args.ext:
        extensions = tuple(
            e if e.startswith(".") else f".{e}"
            for e in args.ext.split(",") if e.strip()
        )

    flags = re.IGNORECASE if args.ignore_case else 0
    pattern_text = args.phrase if args.regex else re.escape(args.phrase)
    try:
        pattern = re.compile(pattern_text, flags)
    except re.error as e:
        raise SystemExit(f"Invalid regex: {e}")

    repo_root = find_repo_root(args.start_path)
    print(f"Repo root: {repo_root}")
    mode = "regex" if args.regex else "literal"
    print(f"Searching for ({mode}): {args.phrase!r}{' (case-insensitive)' if args.ignore_case else ''}\n")

    matches = []
    total_replacements = 0
    files_changed = 0
    files_skipped = 0

    for path in iter_candidate_files(repo_root, extensions):
        lines = read_lines(path)
        if lines is None:
            continue

        line_numbers = find_matches(lines, pattern)
        if not line_numbers:
            continue

        rel = os.path.relpath(path, repo_root)
        matches.append({"path": path, "rel": rel, "line_numbers": line_numbers, "lines": lines, "pattern": pattern})

        if args.replace is not None:
            print(f"{rel} - line{'s' if len(line_numbers) > 1 else ''} {', '.join(str(n) for n in line_numbers)}")
            print_context(rel, line_numbers, lines, args.context, pattern)
            diffs, new_lines = build_diff(lines, pattern, args.replace)
            if not diffs:
                continue

            if args.dry_run:
                # Interactive preview: show this ONE file's changes,
                # then ask before touching it, then move to the next
                # file - rather than dumping every file's diff first
                # and applying (or not) everything at the end.
                print(f"  {rel} — {len(diffs)} change(s) proposed:")
                print_diff(rel, diffs, pattern, args.replace)
                try:
                    answer = input(f"  Apply these changes to {rel}? (y/n): ").strip().lower()
                except (EOFError, KeyboardInterrupt):
                    print("\n  No more input - leaving remaining files untouched.")
                    files_skipped += 1
                    break
                if answer == "y":
                    write_lines(path, new_lines)
                    total_replacements += len(diffs)
                    files_changed += 1
                    print(f"  Applied.\n")
                else:
                    files_skipped += 1
                    print(f"  Skipped.\n")
            else:
                # No preview requested - just apply immediately.
                label = f"  Changing {len(diffs)} line(s) in {rel}:"
                print(label)
                print_diff(rel, diffs, pattern, args.replace)
                write_lines(path, new_lines)
                total_replacements += len(diffs)
                files_changed += 1
                print()

    if not matches:
        print("No matches found.")
        return

    if args.replace is not None:
        print(f"Total: {total_replacements} line(s) changed across {files_changed} file(s).")
        if args.dry_run and files_skipped:
            print(f"({files_skipped} file(s) skipped - left untouched.)")
        return  # replace mode has its own per-file accept/decline flow above; no separate browse step

    if args.no_open:
        print(f"\nFound matches in {len(matches)} file(s):")
        for idx, m in enumerate(matches, start=1):
            plural = "s" if len(m["line_numbers"]) > 1 else ""
            print(f"  {idx}. {m['rel']} (line{plural} {', '.join(str(n) for n in m['line_numbers'])})")
        return

    browse_matches(matches, args.context)


def main():
    # File content can contain characters outside the terminal's default
    # codepage (e.g. cp1252 on Windows) - re-encode stdout as UTF-8 and
    # substitute anything truly unprintable rather than crashing mid-run.
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass  # older Python without reconfigure() - best effort, skip

    parser = build_parser()
    args = parser.parse_args()

    if args.phrase:
        run_search(args)
    else:
        parser.print_help()

    # Recurring prompt: after one search finishes (or after just seeing
    # the help screen), keep asking for another set of arguments -
    # exactly like re-running the script - until the person quits.
    # This is the ONLY place quitting is required; a blank line, 'q',
    # 'quit', or 'exit' (or Ctrl-C/Ctrl-D) all end the session.
    while True:
        try:
            line = input("\nfind_phrase> (new search, or 'q' to quit): ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            return

        if not line or line.lower() in ("q", "quit", "exit"):
            print("Bye.")
            return

        try:
            next_args = parser.parse_args(shlex.split(line))
        except SystemExit:
            # argparse already printed its own error/usage message -
            # just loop back and prompt again instead of exiting.
            continue

        if not next_args.phrase:
            parser.print_help()
            continue

        run_search(next_args)


if __name__ == "__main__":
    main()
