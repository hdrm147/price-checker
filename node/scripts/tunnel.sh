#!/bin/bash

# ==============================================
# SSH Tunnels for Price Checker Workers
# ==============================================
# Usage:
#   ./scripts/tunnel.sh cyber   # Connect to cyber servers
#   ./scripts/tunnel.sh sqella  # Connect to sqella server
#   ./scripts/tunnel.sh stop    # Stop all tunnels
#   ./scripts/tunnel.sh status  # Show tunnel status

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT="${1:-cyber}"

show_help() {
    echo "SSH Tunnel Helper for Price Checker"
    echo ""
    echo "Usage:"
    echo "  $0 cyber    Start tunnels for Cyber project"
    echo "  $0 sqella   Start tunnels for Sqella project"
    echo "  $0 stop     Stop all tunnels"
    echo "  $0 status   Show tunnel status"
    echo ""
    echo "Then run: PROJECT=cyber npm start"
    echo "      or: PROJECT=sqella npm start"
}

stop_tunnels() {
    echo "Stopping existing tunnels..."
    pkill -f "ssh -L 5433" 2>/dev/null
    pkill -f "ssh -L 5434" 2>/dev/null
    pkill -f "ssh -L 5435" 2>/dev/null
    pkill -f "ssh -L 5436" 2>/dev/null
    sleep 1
    echo -e "${GREEN}All tunnels stopped${NC}"
}

show_status() {
    echo "Active SSH Tunnels:"
    echo ""
    ps aux | grep "ssh -L" | grep -v grep || echo "  No active tunnels"
}

start_cyber() {
    echo -e "${YELLOW}Starting tunnels for CYBER...${NC}"
    echo ""

    # Kill existing tunnels first
    stop_tunnels

    # Tunnel to Prices DB (139.162.189.116:5432 -> localhost:5433)
    echo "Starting tunnel to Prices DB..."
    ssh -L 5433:localhost:5432 root@139.162.189.116 -N -f -o ServerAliveInterval=60 -o ServerAliveCountMax=3
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Prices DB tunnel active on port 5433${NC}"
    else
        echo -e "${RED}✗ Failed to connect to Prices DB${NC}"
        exit 1
    fi

    # Tunnel to Main Backend DB (cyber:5432 -> localhost:5434)
    echo "Starting tunnel to Main Backend DB..."
    ssh -L 5434:localhost:5432 root@cyber -N -f -o ServerAliveInterval=60 -o ServerAliveCountMax=3
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Main Backend DB tunnel active on port 5434${NC}"
    else
        echo -e "${RED}✗ Failed to connect to Main Backend DB${NC}"
        exit 1
    fi

    echo ""
    echo "==================================="
    echo "  CYBER SSH Tunnels Ready!"
    echo "==================================="
    echo "  Prices DB:    localhost:5433"
    echo "  Main DB:      localhost:5434"
    echo ""
    echo "Now run: PROJECT=cyber npm start"
}

start_sqella() {
    echo -e "${YELLOW}Starting tunnels for SQELLA...${NC}"
    echo ""

    # Kill existing tunnels first
    stop_tunnels

    # RDS endpoint (internal to VPC, accessible via EC2)
    RDS_HOST="sqella-testing.cbw42o6a0tbh.eu-north-1.rds.amazonaws.com"

    # Tunnel to Sqella RDS via EC2 bastion (sqella-testing EC2 -> RDS:5432 -> localhost:5435)
    echo "Starting tunnel to Sqella RDS via EC2..."
    echo "  EC2: sqella-testing"
    echo "  RDS: $RDS_HOST"
    ssh -L 5435:${RDS_HOST}:5432 sqella-testing -N -f -o ServerAliveInterval=60 -o ServerAliveCountMax=3
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ RDS tunnel active on port 5435${NC}"
    else
        echo -e "${RED}✗ Failed to connect to Sqella${NC}"
        exit 1
    fi

    echo ""
    echo "==================================="
    echo "  SQELLA SSH Tunnels Ready!"
    echo "==================================="
    echo "  Main DB (RDS): localhost:5435"
    echo "  Prices DB:     SQLite (local)"
    echo ""
    echo "Now run: npm run sqella"
}

case "$PROJECT" in
    cyber)
        start_cyber
        ;;
    sqella)
        start_sqella
        ;;
    stop)
        stop_tunnels
        ;;
    status)
        show_status
        ;;
    -h|--help|help)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown project: $PROJECT${NC}"
        show_help
        exit 1
        ;;
esac
