#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BACKEND_DIR="$SCRIPT_DIR/App/API"
FRONTEND_DIR="$SCRIPT_DIR/App/WebUI"
ENV_FILE="$SCRIPT_DIR/App/.env"

# ── Detect local WiFi IP ──────────────────────────────────────────────────────
if [ -n "$WINDIR" ]; then
    # Windows: strip \r first so awk patterns match cleanly, then
    # try WiFi adapter block first, fall back to Ethernet.
    IPCONFIG=$(ipconfig | tr -d '\r')

    echo "[debug] ipconfig adapter lines:"
    echo "$IPCONFIG" | grep -i "adapter\|IPv4"

    # Key fix: use a "just entered" flag so the adapter line itself
    # doesn't immediately trigger the "new adapter seen" reset.
    WIFI_IP=$(echo "$IPCONFIG" | awk '
        /adapter WiFi|adapter Wi-Fi/ { in_block=1; next }
        in_block && /IPv4/ { split($0, a, ": "); print a[2]; exit }
        in_block && /adapter / { in_block=0 }
    ')
    ETHERNET_IP=$(echo "$IPCONFIG" | awk '
        /adapter Ethernet:/ { in_block=1; next }
        in_block && /IPv4/ { split($0, a, ": "); print a[2]; exit }
        in_block && /adapter / { in_block=0 }
    ')

    echo "[debug] WIFI_IP='$WIFI_IP'"
    echo "[debug] ETHERNET_IP='$ETHERNET_IP'"

    LOCAL_IP="${WIFI_IP:-$ETHERNET_IP}"
else
    # macOS: en0 is WiFi, en1 is Ethernet on most Macs.
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
fi

if [ -z "$LOCAL_IP" ]; then
    echo ""
    echo "ERROR: Could not detect a WiFi IP address."
    echo "Make sure you are connected to WiFi and try again."
    echo ""
    read -p "Press Enter to close..."
    exit 1
fi

echo "[config] Detected WiFi IP: $LOCAL_IP"

# ── Write App/.env ────────────────────────────────────────────────────────────
# Fully auto-generated on every launch - never edit this file by hand.
cat > "$ENV_FILE" << EOF
VITE_LOCAL_DEV=true
VITE_LOCAL_IP=$LOCAL_IP
LOCAL_IP=$LOCAL_IP
EOF

echo "[config] Written $ENV_FILE"

# ── Launch servers ────────────────────────────────────────────────────────────
if [ -n "$WINDIR" ]; then
    if [ -n "$MSYSTEM" ]; then
        cmd //c start "" bash -c "cd '$BACKEND_DIR' && python backend.py; exec bash"
        cmd //c start "" bash -c "cd '$FRONTEND_DIR' && npm run dev -- --host; exec bash"
    else
        cmd //c start "Backend" cmd /k "cd /d $BACKEND_DIR && python backend.py"
        cmd //c start "Frontend" cmd /k "cd /d $FRONTEND_DIR && npm run dev -- --host"
    fi
else
    if command -v osascript >/dev/null 2>&1; then
        osascript -e "tell application \"Terminal\" to do script \"cd '$BACKEND_DIR' && python backend.py\""
        osascript -e "tell application \"Terminal\" to do script \"cd '$FRONTEND_DIR' && npm run dev -- --host\""
    else
        (cd "$BACKEND_DIR" && python backend.py) &
        (cd "$FRONTEND_DIR" && npm run dev -- --host) &
        wait
    fi
fi