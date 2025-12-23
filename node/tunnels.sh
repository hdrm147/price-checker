#!/bin/bash

# ==============================================
# SSH Tunnel Helper for Price Checker
# ==============================================
# Usage:
#   ./tunnels.sh cyber       # Connect to cyber server
#   ./tunnels.sh sqella      # Connect to sqella server
#   ./tunnels.sh stop        # Stop all tunnels
#   ./tunnels.sh status      # Show tunnel status
# ==============================================

set -e

# Default ports (change these if your servers use different ports)
MAIN_LOCAL_PORT=15433
PRICES_LOCAL_PORT=15432
REMOTE_PG_PORT=5432

# PID file for tracking tunnels
PID_FILE="/tmp/price-checker-tunnels.pid"

show_help() {
    echo "SSH Tunnel Helper for Price Checker"
    echo ""
    echo "Usage:"
    echo "  $0 <ssh-config-name>    Start tunnels using SSH config name"
    echo "  $0 cyber                Connect to cyber server"
    echo "  $0 sqella               Connect to sqella server"
    echo "  $0 stop                 Stop all tunnels"
    echo "  $0 status               Show tunnel status"
    echo ""
    echo "SSH Config Names:"
    echo "  Uses Host entries from ~/.ssh/config"
    echo "  Example: 'cyber-server' or 'sqella-server'"
    echo ""
    echo "Environment Variables (set before starting):"
    echo "  MAIN_LOCAL_PORT    Local port for main DB tunnel (default: $MAIN_LOCAL_PORT)"
    echo "  PRICES_LOCAL_PORT  Local port for prices DB tunnel (default: $PRICES_LOCAL_PORT)"
    echo "  REMOTE_PG_PORT     Remote PostgreSQL port (default: $REMOTE_PG_PORT)"
}

start_tunnels() {
    local SSH_CONFIG_NAME="$1"

    if [ -z "$SSH_CONFIG_NAME" ]; then
        echo "Error: SSH config name required"
        show_help
        exit 1
    fi

    # Check if SSH config exists
    if ! grep -q "^Host $SSH_CONFIG_NAME" ~/.ssh/config 2>/dev/null; then
        echo "Warning: Host '$SSH_CONFIG_NAME' not found in ~/.ssh/config"
        echo "Attempting to connect anyway..."
    fi

    echo "Starting SSH tunnels for: $SSH_CONFIG_NAME"

    # Kill any existing tunnels
    stop_tunnels 2>/dev/null || true

    # Start tunnel for main database
    echo "  Creating tunnel: localhost:$MAIN_LOCAL_PORT -> $SSH_CONFIG_NAME:$REMOTE_PG_PORT (main DB)"
    ssh -f -N -L "$MAIN_LOCAL_PORT:localhost:$REMOTE_PG_PORT" "$SSH_CONFIG_NAME"
    MAIN_PID=$!

    # Start tunnel for prices database (same remote, different local port)
    echo "  Creating tunnel: localhost:$PRICES_LOCAL_PORT -> $SSH_CONFIG_NAME:$REMOTE_PG_PORT (prices DB)"
    ssh -f -N -L "$PRICES_LOCAL_PORT:localhost:$REMOTE_PG_PORT" "$SSH_CONFIG_NAME"
    PRICES_PID=$!

    # Save PIDs
    pgrep -f "ssh -f -N -L.*:localhost:$REMOTE_PG_PORT.*$SSH_CONFIG_NAME" > "$PID_FILE" 2>/dev/null || true

    echo ""
    echo "Tunnels started successfully!"
    echo ""
    echo "Update your .env file with:"
    echo "  MAIN_DB_HOST=localhost"
    echo "  MAIN_DB_PORT=$MAIN_LOCAL_PORT"
    echo "  PG_HOST=localhost"
    echo "  PG_PORT=$PRICES_LOCAL_PORT"
    echo ""
    echo "Or enable automatic SSH tunneling in config:"
    echo "  SSH_ENABLED=true"
    echo "  SSH_MAIN_CONFIG_NAME=$SSH_CONFIG_NAME"
    echo "  SSH_PRICES_CONFIG_NAME=$SSH_CONFIG_NAME"
}

stop_tunnels() {
    echo "Stopping SSH tunnels..."

    if [ -f "$PID_FILE" ]; then
        while read pid; do
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                kill "$pid" 2>/dev/null || true
                echo "  Stopped tunnel (PID: $pid)"
            fi
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi

    # Also kill any lingering tunnels
    pkill -f "ssh -f -N -L.*:localhost:$REMOTE_PG_PORT" 2>/dev/null || true

    echo "All tunnels stopped."
}

show_status() {
    echo "SSH Tunnel Status:"
    echo ""

    local count=0
    while read line; do
        echo "  $line"
        ((count++)) || true
    done < <(pgrep -af "ssh -f -N -L" 2>/dev/null || true)

    if [ $count -eq 0 ]; then
        echo "  No active tunnels"
    else
        echo ""
        echo "Total active tunnels: $count"
    fi
}

# Main
case "$1" in
    stop)
        stop_tunnels
        ;;
    status)
        show_status
        ;;
    -h|--help|help)
        show_help
        ;;
    "")
        show_help
        ;;
    *)
        start_tunnels "$1"
        ;;
esac
