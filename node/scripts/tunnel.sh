#!/bin/bash

# ==============================================
# SSH Tunnels for Price Checker Workers
# ==============================================
# This script creates SSH tunnels to both databases
# Run this before starting workers on your local PC

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Kill existing tunnels
echo "Stopping existing tunnels..."
pkill -f "ssh -L 5433" 2>/dev/null
pkill -f "ssh -L 5434" 2>/dev/null
sleep 1

# Tunnel to Prices DB (139.162.189.116:5432 -> localhost:5433)
echo "Starting tunnel to Prices DB..."
ssh -L 5433:localhost:5432 root@139.162.189.116 -N -f
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Prices DB tunnel active on port 5433${NC}"
else
    echo -e "${RED}✗ Failed to connect to Prices DB${NC}"
    exit 1
fi

# Tunnel to Main Backend DB (cyber:5432 -> localhost:5434)
echo "Starting tunnel to Main Backend DB..."
ssh -L 5434:localhost:5432 root@cyber -N -f
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Main Backend DB tunnel active on port 5434${NC}"
else
    echo -e "${RED}✗ Failed to connect to Main Backend DB${NC}"
    exit 1
fi

echo ""
echo "==================================="
echo "  SSH Tunnels Ready!"
echo "==================================="
echo "  Prices DB:    localhost:5433"
echo "  Main DB:      localhost:5434"
echo ""
echo "Now run: npm start"
