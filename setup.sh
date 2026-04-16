#!/bin/bash
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  GreenLedger - Carbon Credit Platform"
echo "  Setup Script (Mac / Linux)"
echo "=========================================="
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    echo -e "${RED}[ERROR] python3 not found. Install it first.${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Python3 found${NC}"

# Check MongoDB
if ! pgrep -x mongod &>/dev/null && ! systemctl is-active --quiet mongod 2>/dev/null; then
    echo -e "${YELLOW}[WARN] MongoDB does not appear to be running.${NC}"
    echo "       Start it with: sudo systemctl start mongod"
    echo "       Or install from: https://www.mongodb.com/try/download/community"
    echo "       Then re-run this script."
    exit 1
fi
echo -e "${GREEN}[OK] MongoDB running${NC}"

cd backend

echo ""
echo "[1/4] Installing Python dependencies..."
pip3 install -r requirements.txt
echo -e "${GREEN}[OK] Dependencies installed${NC}"

echo ""
echo "[2/4] Training AI carbon estimation model..."
python3 model/train_model.py
echo -e "${GREEN}[OK] Model trained${NC}"

echo ""
echo "[3/4] Seeding demo data..."
python3 seed_db.py
echo -e "${GREEN}[OK] Database seeded${NC}"

echo ""
echo "[4/4] Starting Flask API..."
python3 app.py &
API_PID=$!
cd ..

sleep 2

echo ""
echo "Starting frontend server..."
cd frontend
python3 -m http.server 8080 &
FE_PID=$!
cd ..

sleep 1

echo ""
echo "=========================================="
echo -e "  ${GREEN}GreenLedger is running!${NC}"
echo "  Dashboard : http://localhost:8080"
echo "  API       : http://localhost:5000"
echo "=========================================="
echo ""
echo "Press Ctrl+C to stop all servers."

# Open browser if possible
if command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:8080
elif command -v open &>/dev/null; then
    open http://localhost:8080
fi

# Wait and cleanup on exit
trap "kill $API_PID $FE_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
