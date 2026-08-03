#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACKEND_DIR="$SCRIPT_DIR/App/API"
FRONTEND_DIR="$SCRIPT_DIR/App/WebUI"

if [ -n "$WINDIR" ]; then
    # We're on Windows either way - but WHICH kind of window to open
    # depends on whether we're actually running inside Git Bash.
    # MSYSTEM is an environment variable Git Bash specifically sets
    # (e.g. "MINGW64") - nothing else sets it, so its presence reliably
    # tells us "this script is running inside a Git Bash session."
    if [ -n "$MSYSTEM" ]; then
        # Running inside Git Bash - open two NEW Git Bash windows.
        # `cmd //c start` is still the actual launcher (since `start`
        # itself is a CMD-only command, not something bash understands
        # directly), but what it launches INSIDE that window is bash
        # itself, which Windows recognizes as "open a Git Bash window"
        # since bash.exe is registered with its own terminal (mintty).
        cmd //c start "" bash -c "cd '$BACKEND_DIR' && python backend.py; exec bash"
        cmd //c start "" bash -c "cd '$FRONTEND_DIR' && npm run dev -- --host; exec bash"
    else
        # Running from a plain Windows terminal (cmd or PowerShell) -
        # open two NATIVE Windows terminal windows instead, running
        # cmd.exe's own /k flag (keeps the window open after the
        # command finishes, same idea as bash's exec bash above).
        cmd //c start "Backend" cmd /k "cd /d $BACKEND_DIR && python backend.py"
        cmd //c start "Frontend" cmd /k "cd /d $FRONTEND_DIR && npm run dev -- --host"
    fi
else
    # macOS/Linux - unchanged from before.
    if command -v osascript >/dev/null 2>&1; then
        osascript -e "tell application \"Terminal\" to do script \"cd '$BACKEND_DIR' && python backend.py\""
        osascript -e "tell application \"Terminal\" to do script \"cd '$FRONTEND_DIR' && npm run dev -- --host\""
    else
        (cd "$BACKEND_DIR" && python backend.py) &
        (cd "$FRONTEND_DIR" && npm run dev -- --host) &
        wait
    fi
fi

# bash start-dev.sh